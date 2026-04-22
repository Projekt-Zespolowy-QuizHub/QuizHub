import json
import asyncio
import random
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from apps.ai.generator import QuestionGenerator, get_category_for_round
from apps.game.logic import calculate_points, get_streak_multiplier
from quizarena.throttles import WebSocketConnectThrottle
from .constants import (
    MIN_PLAYERS_AUTO_START, EXTRA_TIME_SECONDS,
)
from .validators import (
    validate_message_type, validate_nickname, validate_chat_message,
    validate_answer, validate_powerup,
)

logger = logging.getLogger(__name__)

# Keyed by (room_code, nickname) → asyncio.Task that will broadcast player_left
_disconnect_tasks: dict[tuple[str, str], asyncio.Task] = {}

# Keyed by (room_code, nickname) → set of used powerup names
_powerups_used: dict[tuple[str, str], set[str]] = {}

# Keyed by (room_code, nickname) → True jeśli double points aktywny
_double_points_active: dict[tuple[str, str], bool] = {}

# Keyed by (room_code, nickname) → True jeśli gracz odpadł w survival
_survival_eliminated: dict[tuple[str, str], bool] = {}


def _update_profile_after_game(player, is_winner: bool = False):
    """Aktualizuje statystyki UserProfile po zakończonej grze. Wywołanie synchroniczne."""
    from .models import Answer

    profile = player.user.profile
    profile.games_played += 1
    profile.total_score += player.score
    profile.weekly_score += player.score

    coins = 50 if is_winner else 10
    answers = list(Answer.objects.filter(player=player))
    if answers and all(a.is_correct for a in answers):
        coins += 25
    profile.coins += coins

    profile.save()


def _update_challenge_progress(player, room, player_rank: int) -> None:
    """Aktualizuje postęp wyzwań dziennych gracza po zakończeniu gry. Wywołanie synchroniczne."""
    from datetime import date
    from .models import Answer
    from apps.accounts.models import DailyChallenge, UserChallengeProgress

    today = date.today()
    challenges = list(DailyChallenge.objects.filter(date=today))
    if not challenges:
        return

    is_winner = (player_rank == 1)
    correct_count = Answer.objects.filter(player=player, is_correct=True).count()
    best_streak = player.best_streak
    total_rounds = room.total_rounds

    for challenge in challenges:
        progress, _ = UserChallengeProgress.objects.get_or_create(
            user=player.user,
            challenge=challenge,
        )
        if progress.completed:
            continue

        ct = challenge.challenge_type
        if ct == 'play_games':
            progress.current_value += 1
        elif ct == 'win_games':
            if is_winner:
                progress.current_value += 1
        elif ct == 'correct_answers':
            progress.current_value += correct_count
        elif ct == 'streak':
            progress.current_value = max(progress.current_value, best_streak)
        elif ct == 'survival_rounds':
            progress.current_value += total_rounds

        if progress.current_value >= challenge.target_value:
            from django.utils import timezone
            progress.completed = True
            progress.completed_at = timezone.now()

        progress.save()


def _clear_powerup_state(room_code: str) -> None:
    """Usuwa stan power-upów i survival dla danego pokoju."""
    for store in (_powerups_used, _double_points_active, _survival_eliminated):
        for key in [k for k in store if k[0] == room_code]:
            del store[key]


class GameConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer dla jednego pokoju gry.

    Eventy wysyłane do klientów:
      - player_joined     → ktoś dołączył do lobby
      - player_left       → ktoś opuścił (po grace period)
      - game_start        → host zaczął grę
      - question          → nowe pytanie (bez correct_answer!)
      - answer_result     → wynik po odpowiedzi (twój wynik)
      - game_over         → koniec gry, finalny leaderboard
      - game_state        → aktualny stan gry wysyłany po rejoin
    """

    GRACE_PERIOD_SECONDS = 30
    LOBBY_GRACE_SECONDS = 3

    @classmethod
    async def _get_grace_period_for(cls, room_code: str) -> int:
        """Zwraca grace period zależny od statusu pokoju.

        LOBBY — krótki (3s), bo reconnect w lobby nie ma sensu i długa lista
        „duchów" myli graczy. IN_PROGRESS — długi (30s), bo gracz może chcieć
        wrócić po rozłączeniu w trakcie rundy.
        """
        from .models import Room
        try:
            room = await database_sync_to_async(Room.objects.get)(code=room_code)
        except Room.DoesNotExist:
            return cls.LOBBY_GRACE_SECONDS
        if room.status == Room.Status.LOBBY:
            return cls.LOBBY_GRACE_SECONDS
        return cls.GRACE_PERIOD_SECONDS

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.room_code = None
        self.group_name = None
        self.nickname = None
        self.avatar = 'fox'
        self.room = None

    # ─── Connect / Disconnect ─────────────────────────────────────────────

    async def connect(self):
        throttle = WebSocketConnectThrottle()
        if not await throttle.is_allowed(self.scope):
            await self.close(code=4029)
            return

        self.room_code = self.scope['url_route']['kwargs']['room_code'].upper()
        self.group_name = f'room_{self.room_code}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('WS connect: pokój=%s channel=%s', self.room_code, self.channel_name)

    async def disconnect(self, close_code):
        logger.info(
            'WS disconnect: pokój=%s nick=%s code=%s',
            self.room_code, self.nickname, close_code,
        )
        if self.nickname:
            grace = await self._get_grace_period_for(self.room_code)
            key = (self.room_code, self.nickname)
            existing = _disconnect_tasks.get(key)
            if existing and not existing.done():
                existing.cancel()
            task = asyncio.create_task(self._delayed_player_left(key, grace))
            _disconnect_tasks[key] = task
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def _delayed_player_left(self, key: tuple[str, str], grace_seconds: float):
        """Broadcast player_left po grace period, chyba że anulowany przez rejoin."""
        await asyncio.sleep(grace_seconds)
        room_code, nickname = key
        _disconnect_tasks.pop(key, None)
        await self.channel_layer.group_send(f'room_{room_code}', {
            'type': 'player_left',
            'nickname': nickname,
        })

    # ─── Receive ──────────────────────────────────────────────────────────

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, ValueError):
            logger.warning('WS invalid JSON: pokój=%s', self.room_code)
            await self._send_error('Nieprawidłowy format danych.')
            return

        event = data.get('type')
        ok, msg = validate_message_type(event)
        if not ok:
            logger.warning('WS unknown type %r: pokój=%s', event, self.room_code)
            await self._send_error(msg)
            return

        handlers = {
            'join':         self.handle_join,
            'rejoin':       self.handle_rejoin,
            'start_game':   self.handle_start_game,
            'answer':       self.handle_answer,
            'use_powerup':  self.handle_powerup,
            'chat_message': self.handle_chat_message,
        }

        handler = handlers.get(event)
        if handler:
            await handler(data)

    # ─── Handlers ─────────────────────────────────────────────────────────

    async def _send_error(self, message: str) -> None:
        """Wysyła komunikat błędu do klienta."""
        await self.send(json.dumps({'type': 'error', 'message': message}))

    async def handle_join(self, data):
        """Gracz podaje swój nick po połączeniu WS."""
        from .models import Room

        ok, result = validate_nickname(data.get('nickname'))
        if not ok:
            logger.warning('WS join validation error: pokój=%s błąd=%s', self.room_code, result)
            await self._send_error(result)
            return

        self.nickname = result
        self.avatar = data.get('avatar', 'fox')
        logger.debug('WS join: pokój=%s nick=%s', self.room_code, self.nickname)
        await self.channel_layer.group_send(self.group_name, {
            'type': 'player_joined',
            'nickname': self.nickname,
            'avatar': self.avatar,
        })

        try:
            room = await database_sync_to_async(Room.objects.get)(code=self.room_code)
        except Room.DoesNotExist:
            return

        if room.is_public and room.status == Room.Status.LOBBY:
            player_count = await database_sync_to_async(room.players.count)()
            if player_count >= MIN_PLAYERS_AUTO_START:
                await self._do_start_game(self.room_code)

    async def handle_rejoin(self, data):
        """Gracz reconnectuje w trakcie grace period — anuluj timer, odeślij stan gry."""
        from .models import Room, Player, Question

        ok, result = validate_nickname(data.get('nickname'))
        if not ok:
            logger.warning('WS rejoin validation error: pokój=%s błąd=%s', self.room_code, result)
            await self._send_error(result)
            return

        nickname = result
        self.nickname = nickname
        logger.info('WS rejoin: pokój=%s nick=%s', self.room_code, self.nickname)

        key = (self.room_code, nickname)
        task = _disconnect_tasks.pop(key, None)
        if task and not task.done():
            task.cancel()

        try:
            room = await database_sync_to_async(Room.objects.get)(code=self.room_code)
            player = await database_sync_to_async(
                Player.objects.get)(room=room, nickname=nickname)
        except Exception:
            return

        current_question = await self._get_current_question_data(room, Question)

        await self.send(json.dumps({
            'type': 'game_state',
            'room_status': room.status,
            'current_round': room.current_round,
            'total_rounds': room.total_rounds,
            'score': player.score,
            'current_question': current_question,
        }))

    async def _get_current_question_data(self, room, Question) -> dict | None:
        """Pobiera dane aktualnego pytania jeśli gra jest w toku."""
        if room.status != room.Status.IN_PROGRESS or room.current_round == 0:
            return None
        try:
            question = await database_sync_to_async(
                Question.objects.get)(room=room, round_number=room.current_round)
            return {
                'round_number': question.round_number,
                'total_rounds': room.total_rounds,
                'question': question.content,
                'options': question.options,
            }
        except Exception:
            return None

    async def handle_start_game(self, data):
        """Host startuje grę."""
        logger.info('WS start_game: pokój=%s nick=%s', self.room_code, self.nickname)
        await self._do_start_game(self.room_code)

    async def _do_start_game(self, room_code: str) -> bool:
        """Atomicznie startuje grę. Zwraca True jeśli ta instancja faktycznie ją uruchomiła."""
        from .models import Room

        updated = await database_sync_to_async(
            Room.objects.filter(code=room_code, status=Room.Status.LOBBY).update
        )(status=Room.Status.IN_PROGRESS)
        if not updated:
            return False

        logger.info('Gra uruchomiona: pokój=%s', room_code)

        _clear_powerup_state(room_code)

        room = await database_sync_to_async(Room.objects.get)(code=room_code)

        # Tryb duel: 5 rund
        if room.game_mode == 'duel':
            room.total_rounds = 5
            await database_sync_to_async(room.save)()

        await self.channel_layer.group_send(self.group_name, {
            'type': 'game_start',
            'total_rounds': room.total_rounds,
            'categories': room.categories,
            'game_mode': room.game_mode,
        })

        await asyncio.sleep(2)
        await self.send_next_question(room)
        return True

    async def handle_answer(self, data):
        """Gracz przysłał odpowiedź."""
        from .models import Player, Question, Answer, Room

        ok, result = validate_answer(data.get('answer'))
        if not ok:
            logger.warning('WS answer validation error: pokój=%s błąd=%s', self.room_code, result)
            await self._send_error(result)
            return

        nickname = data.get('nickname')
        chosen = result
        response_time_ms = data.get('response_time_ms', 30000)
        round_number = data.get('round_number')

        try:
            room = await database_sync_to_async(Room.objects.get)(code=self.room_code)
            player = await database_sync_to_async(
                Player.objects.get)(room=room, nickname=nickname)
            question = await database_sync_to_async(
                Question.objects.get)(room=room, round_number=round_number)
        except Exception:
            return

        is_correct = chosen == question.correct_answer
        points, multiplier, new_streak = self._compute_score(
            is_correct, response_time_ms, player.current_streak,
        )

        key = (self.room_code, nickname)
        if is_correct and _double_points_active.pop(key, False):
            points *= 2

        await database_sync_to_async(Answer.objects.get_or_create)(
            player=player,
            question=question,
            defaults={
                'chosen_option': chosen,
                'response_time_ms': response_time_ms,
                'points_earned': points,
                'is_correct': is_correct,
                'streak_at_answer': new_streak,
                'multiplier_applied': multiplier,
            }
        )

        player.current_streak = new_streak
        player.best_streak = max(player.best_streak, new_streak)
        player.score += points
        await database_sync_to_async(player.save)()

        # Survival: jeśli błędna odpowiedź — eliminuj gracza
        if room.game_mode == 'survival' and not is_correct:
            _survival_eliminated[(self.room_code, nickname)] = True
            await self.send(json.dumps({
                'type': 'answer_result',
                'is_correct': False,
                'correct_answer': question.correct_answer,
                'explanation': question.explanation,
                'points_earned': 0,
                'total_score': player.score,
                'streak': 0,
                'multiplier': 1.0,
                'eliminated': True,
            }))
            # Sprawdź czy wszyscy odpadli (lub tylko 1 pozostał)
            all_players = await database_sync_to_async(
                lambda: list(room.players.all())
            )()
            alive = [
                p for p in all_players
                if not _survival_eliminated.get((self.room_code, p.nickname), False)
            ]
            if len(alive) <= 1:
                await self.send_game_over(room)
            return

        await self.send(json.dumps({
            'type': 'answer_result',
            'is_correct': is_correct,
            'correct_answer': question.correct_answer,
            'explanation': question.explanation,
            'points_earned': points,
            'total_score': player.score,
            'streak': new_streak,
            'multiplier': multiplier,
        }))

    @staticmethod
    def _compute_score(
        is_correct: bool, response_time_ms: int, streak_before: int,
    ) -> tuple[int, float, int]:
        """
        Oblicza punkty, mnożnik i nowy streak.

        Returns:
            (points, multiplier, new_streak)
        """
        if not is_correct:
            return 0, 1.0, 0
        new_streak = streak_before + 1
        multiplier = get_streak_multiplier(streak_before)
        points = calculate_points(True, response_time_ms, streak_before)
        return points, multiplier, new_streak

    async def handle_powerup(self, data):
        """Gracz używa power-upa."""
        from .models import Room, Question

        ok, result = validate_powerup(data.get('powerup'))
        if not ok:
            logger.warning('WS powerup validation error: pokój=%s błąd=%s', self.room_code, result)
            await self._send_error(result)
            return

        powerup = result
        nickname = data.get('nickname')
        round_number = data.get('round_number')

        key = (self.room_code, nickname)
        used = _powerups_used.setdefault(key, set())

        if powerup in used:
            return

        logger.debug('WS powerup: pokój=%s nick=%s powerup=%s', self.room_code, nickname, powerup)

        used.add(powerup)

        if powerup == 'fifty_fifty':
            await self._handle_fifty_fifty(round_number, Room, Question)
        elif powerup == 'extra_time':
            await self.send(json.dumps({
                'type': 'powerup_result',
                'powerup': 'extra_time',
                'extra_seconds': EXTRA_TIME_SECONDS,
            }))
        elif powerup == 'double_points':
            _double_points_active[key] = True
            await self.send(json.dumps({'type': 'powerup_result', 'powerup': 'double_points'}))

    async def _handle_fifty_fifty(self, round_number: int, Room, Question) -> None:
        """Usuwa 2 błędne opcje dla power-upu fifty-fifty."""
        try:
            room = await database_sync_to_async(Room.objects.get)(code=self.room_code)
            question = await database_sync_to_async(
                Question.objects.get)(room=room, round_number=round_number)
        except Exception:
            return

        correct = question.correct_answer
        wrong = [letter for letter in ['A', 'B', 'C', 'D'] if letter != correct]
        to_remove = random.sample(wrong, 2)

        await self.send(json.dumps({
            'type': 'powerup_result',
            'powerup': 'fifty_fifty',
            'removed_options': to_remove,
        }))

    async def handle_chat_message(self, data):
        """Gracz wysłał wiadomość na czacie lobby."""
        if not self.nickname:
            return
        ok, result = validate_chat_message(data.get('text', ''))
        if not ok:
            logger.warning(
                'WS chat validation error: pokój=%s nick=%s błąd=%s',
                self.room_code, self.nickname, result,
            )
            await self._send_error(result)
            return
        logger.debug('WS chat: pokój=%s nick=%s', self.room_code, self.nickname)
        await self.channel_layer.group_send(self.group_name, {
            'type': 'chat_message',
            'nickname': self.nickname,
            'text': result,
        })

    # ─── Helpers ──────────────────────────────────────────────────────────

    async def send_next_question(self, room):
        """Generuje następne pytanie (AI lub z paczki) i rozsyła do grupy."""
        from .models import Question

        room.current_round += 1
        await database_sync_to_async(room.save)()

        # Classic i duel mają limit rund; survival nie
        if room.game_mode != 'survival' and room.current_round > room.total_rounds:
            await self.send_game_over(room)
            return

        if room.pack_id:
            await self._send_pack_question(room, Question)
        else:
            await self._send_ai_question(room, Question)

    async def _send_ai_question(self, room, Question):
        """Generuje pytanie przez AI."""
        used = await database_sync_to_async(
            lambda: list(room.questions.values_list('content', flat=True))
        )()

        category = get_category_for_round(room.categories, room.current_round)
        generator = QuestionGenerator()
        question_data = await generator.generate(category, used)

        question = await database_sync_to_async(Question.objects.create)(
            room=room,
            round_number=room.current_round,
            content=question_data['question'],
            options=question_data['options'],
            correct_answer=question_data['correct'],
            explanation=question_data.get('explanation', ''),
        )

        await self.channel_layer.group_send(self.group_name, {
            'type': 'question',
            'round_number': room.current_round,
            'total_rounds': room.total_rounds,
            'question': question.content,
            'options': question.options,
        })

    async def _send_pack_question(self, room, Question):
        """Pobiera pytanie z paczki użytkownika."""
        from .models import CustomQuestion

        OPTION_LETTERS = ['A', 'B', 'C', 'D']

        used_texts = await database_sync_to_async(
            lambda: set(room.questions.values_list('content', flat=True))
        )()

        pack_questions = await database_sync_to_async(
            lambda: list(
                CustomQuestion.objects.filter(pack_id=room.pack_id)
                .exclude(question_text__in=used_texts)
            )
        )()

        if not pack_questions:
            # Wszystkie pytania z paczki zostały użyte — zapętl od początku
            pack_questions = await database_sync_to_async(
                lambda: list(CustomQuestion.objects.filter(pack_id=room.pack_id))
            )()

        if not pack_questions:
            logger.warning('Paczka %s jest pusta — pokój=%s', room.pack_id, room.code)
            await self.send_game_over(room)
            return

        cq = random.choice(pack_questions)
        correct_letter = OPTION_LETTERS[cq.correct_index]

        question = await database_sync_to_async(Question.objects.create)(
            room=room,
            round_number=room.current_round,
            content=cq.question_text,
            options=cq.answers,
            correct_answer=correct_letter,
            explanation=cq.image_emoji,
        )

        await self.channel_layer.group_send(self.group_name, {
            'type': 'question',
            'round_number': room.current_round,
            'total_rounds': room.total_rounds,
            'question': question.content,
            'options': question.options,
        })

    async def send_game_over(self, room):
        """Gra skończona — wyślij finalny leaderboard, zaktualizuj profile i sprawdź achievementy."""
        logger.info('Gra zakończona: pokój=%s', room.code)
        from .models import Player, Room
        from apps.accounts.models import AVATAR_EMOJI
        from apps.accounts.achievements import check_and_award_achievements
        from django.core.cache import cache

        player_objs = await database_sync_to_async(
            lambda: list(
                Player.objects.filter(room=room)
                .select_related('user__profile')
                .order_by('-score')
            )
        )()

        leaderboard = [
            {
                'nickname': p.nickname,
                'score': p.score,
                'avatar': AVATAR_EMOJI.get(p.user.profile.avatar, '🦊') if p.user else '🦊',
            }
            for p in player_objs
        ]

        # Tryb duel: bonus coins dla zwycięzcy
        if room.game_mode == 'duel' and player_objs:
            winner = player_objs[0]
            if winner.user:
                winner_profile = await database_sync_to_async(lambda: winner.user.profile)()
                winner_profile.total_score += 50  # bonus za wygraną w duel
                await database_sync_to_async(winner_profile.save)()

        room.status = Room.Status.FINISHED
        await database_sync_to_async(room.save)()

        for rank, player in enumerate(player_objs, start=1):
            if player.user:
                await database_sync_to_async(_update_profile_after_game)(player, is_winner=(rank == 1))
                await database_sync_to_async(check_and_award_achievements)(
                    player.user, player, room
                )
                await database_sync_to_async(_update_challenge_progress)(player, room, rank)
                # Unieważnij cache statystyk gracza po aktualizacji wyników
                await database_sync_to_async(cache.delete)(f'user_stats_{player.user.id}')

        # Unieważnij rankingi globalne — wyniki zmieniły się po grze
        await database_sync_to_async(cache.delete_many)(['ranking_global', 'ranking_weekly'])

        await self.channel_layer.group_send(self.group_name, {
            'type': 'game_over',
            'leaderboard': leaderboard,
        })

    # ─── Group message handlers (wysyłanie do klientów) ───────────────────

    async def player_joined(self, event):
        await self.send(json.dumps({
            'type': 'player_joined',
            'nickname': event['nickname'],
            'avatar': event.get('avatar', '🦊'),
        }))

    async def player_left(self, event):
        await self.send(json.dumps({'type': 'player_left', 'nickname': event['nickname']}))

    async def game_start(self, event):
        await self.send(json.dumps({
            'type': 'game_start',
            'total_rounds': event['total_rounds'],
            'categories': event['categories'],
            'game_mode': event.get('game_mode', 'classic'),
        }))

    async def question(self, event):
        await self.send(json.dumps({
            'type': 'question',
            'round_number': event['round_number'],
            'total_rounds': event['total_rounds'],
            'question': event['question'],
            'options': event['options'],
        }))

    async def game_over(self, event):
        await self.send(json.dumps({
            'type': 'game_over',
            'leaderboard': event['leaderboard'],
        }))

    async def chat_message(self, event):
        await self.send(json.dumps({
            'type': 'chat_message',
            'nickname': event['nickname'],
            'text': event['text'],
        }))

    async def auto_start(self, event):
        """Wyzwolony przez scheduler — atomicznie startuje grę publiczną."""
        await self._do_start_game(self.room_code)
