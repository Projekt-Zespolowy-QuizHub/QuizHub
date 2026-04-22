import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, serializers as drf_serializers
from django.core.cache import cache
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from .models import Room, Player, QuestionPack, CustomQuestion, PublicTournamentConfig
from .serializers import (
    CreateRoomSerializer, JoinRoomSerializer,
    RoomSerializer, LeaderboardSerializer
)

CACHE_TTL_ROOM_HISTORY = 60  # 1 minuta

logger = logging.getLogger(__name__)


class CreateRoomView(APIView):
    """
    POST /api/rooms/
    Tworzy nowy pokój i dodaje hosta jako pierwszego gracza.
    Wymaga zalogowania.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Utwórz pokój gry',
        description=(
            'Tworzy nowy pokój quizowy i dodaje twórcę jako hosta. '
            'Zwraca kod pokoju, który należy przekazać innym graczom. '
            'Kategorii może być od 1 do 3, liczba rund od 5 do 20.'
        ),
        request=CreateRoomSerializer,
        responses={
            201: inline_serializer('CreateRoomResponse', fields={
                'room_code': drf_serializers.CharField(),
                'message': drf_serializers.CharField(),
            }),
            400: inline_serializer('CreateRoomError', fields={'error': drf_serializers.DictField()}),
        },
        tags=['rooms'],
    )
    def post(self, request):
        serializer = CreateRoomSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning('CreateRoom validation error: user=%s errors=%s', request.user, serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        pack = None
        pack_id = data.get('pack_id')
        if pack_id:
            try:
                pack = QuestionPack.objects.get(pk=pack_id)
            except QuestionPack.DoesNotExist:
                return Response({'error': 'Paczka nie istnieje'}, status=status.HTTP_404_NOT_FOUND)

            # Twórca paczki nie może grać w pokoju korzystającym z jego paczki
            if pack.created_by_id == request.user.id:
                return Response(
                    {'error': 'Nie możesz grać używając własnej paczki pytań'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        categories = data['categories'] if not pack else []
        room = Room.objects.create(
            categories=categories,
            total_rounds=data['total_rounds'],
            pack=pack,
            game_mode=data.get('game_mode', 'classic'),
        )
        Player.objects.create(
            room=room,
            nickname=data['host_nickname'],
            is_host=True,
            user=request.user if request.user.is_authenticated else None,
        )

        logger.info('Pokój utworzony: code=%s user=%s pack=%s', room.code, request.user, pack_id)
        return Response({
            'room_code': room.code,
            'message': f"Pokój {room.code} utworzony!"
        }, status=status.HTTP_201_CREATED)


class JoinRoomView(APIView):
    """
    POST /api/rooms/join/
    Dołącza gracza do istniejącego pokoju. Wymaga zalogowania.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Dołącz do pokoju gry',
        description=(
            'Dodaje gracza do istniejącego pokoju na podstawie kodu pokoju i wybranego nicku. '
            'Nie można dołączyć do pokoju, w którym gra już trwa lub który jest zakończony. '
            'Nick musi być unikalny w obrębie danego pokoju.'
        ),
        request=JoinRoomSerializer,
        responses={
            201: inline_serializer('JoinRoomResponse', fields={
                'room_code': drf_serializers.CharField(),
                'player_id': drf_serializers.IntegerField(),
                'nickname': drf_serializers.CharField(),
            }),
            400: inline_serializer('JoinRoomError', fields={'error': drf_serializers.CharField()}),
            404: inline_serializer('JoinRoomNotFound', fields={'error': drf_serializers.CharField()}),
            409: inline_serializer('JoinRoomConflict', fields={'error': drf_serializers.CharField()}),
        },
        tags=['rooms'],
    )
    def post(self, request):
        serializer = JoinRoomSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning('JoinRoom validation error: user=%s errors=%s', request.user, serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            room = Room.objects.get(code=data['room_code'].upper())
        except Room.DoesNotExist:
            logger.warning('JoinRoom: pokój nie istnieje code=%s user=%s', data['room_code'], request.user)
            return Response({'error': 'Pokój nie istnieje.'}, status=status.HTTP_404_NOT_FOUND)

        if not room.is_joinable():
            logger.warning('JoinRoom: pokój niedostępny code=%s status=%s', room.code, room.status)
            return Response(
                {'error': 'Gra już trwa lub jest zakończona.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Twórca paczki nie może dołączyć do pokoju używającego jego paczki
        if room.pack_id and request.user.is_authenticated:
            if room.pack.created_by_id == request.user.id:
                return Response(
                    {'error': 'Nie możesz grać w pokoju korzystającym z Twojej paczki pytań'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if Player.objects.filter(room=room, nickname=data['nickname']).exists():
            logger.warning('JoinRoom: nick zajęty code=%s nick=%s', room.code, data['nickname'])
            return Response({'error': 'Nick jest już zajęty w tym pokoju.'}, status=status.HTTP_409_CONFLICT)

        player = Player.objects.create(
            room=room,
            nickname=data['nickname'],
            user=request.user if request.user.is_authenticated else None,
        )

        logger.info('Gracz dołączył: code=%s nick=%s user=%s', room.code, player.nickname, request.user)
        return Response({
            'room_code': room.code,
            'player_id': player.id,
            'nickname': player.nickname,
        }, status=status.HTTP_201_CREATED)


class RoomDetailView(APIView):
    """
    GET /api/rooms/<code>/
    Zwraca szczegóły pokoju z listą graczy.
    """
    @extend_schema(
        summary='Szczegóły pokoju',
        description='Zwraca informacje o pokoju (status, kategorie, rundy) wraz z aktualną listą graczy i ich wynikami.',
        responses={
            200: RoomSerializer,
            404: inline_serializer('RoomNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['rooms'],
    )
    def get(self, request, code):
        try:
            room = Room.objects.prefetch_related('players__user__profile').get(code=code.upper())
        except Room.DoesNotExist:
            logger.warning('RoomDetail: pokój nie istnieje code=%s', code)
            return Response({'error': 'Pokój nie istnieje.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(RoomSerializer(room).data)


class RoomHistoryView(APIView):
    """
    GET /api/rooms/<code>/history/
    Zwraca historię pytań i wyniki po zakończeniu gry.
    """
    @extend_schema(
        summary='Historia zakończonej gry',
        description=(
            'Zwraca tablicę wyników (leaderboard) i pełną historię pytań z poprawnymi odpowiedziami '
            'dla zakończonego pokoju. Dostępne po zakończeniu gry.'
        ),
        responses={
            200: inline_serializer('RoomHistory', fields={
                'room_code': drf_serializers.CharField(),
                'categories': drf_serializers.ListField(child=drf_serializers.CharField()),
                'total_rounds': drf_serializers.IntegerField(),
                'leaderboard': LeaderboardSerializer(many=True),
                'questions': drf_serializers.ListField(child=drf_serializers.DictField()),
            }),
            404: inline_serializer('RoomHistoryNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['rooms'],
    )
    def get(self, request, code):
        cache_key = f'room_history_{code.upper()}'
        data = cache.get(cache_key)
        if data is not None:
            return Response(data)

        try:
            room = Room.objects.prefetch_related('players', 'questions').get(code=code.upper())
        except Room.DoesNotExist:
            logger.warning('RoomHistory: pokój nie istnieje code=%s', code)
            return Response({'error': 'Pokój nie istnieje.'}, status=status.HTTP_404_NOT_FOUND)

        leaderboard = room.players.order_by('-score')
        questions = room.questions.order_by('round_number')

        data = {
            'room_code': room.code,
            'categories': room.categories,
            'total_rounds': room.total_rounds,
            'leaderboard': LeaderboardSerializer(leaderboard, many=True).data,
            'questions': [
                {
                    'round': q.round_number,
                    'content': q.content,
                    'options': q.options,
                    'correct': q.correct_answer,
                    'explanation': q.explanation,
                }
                for q in questions
            ]
        }
        cache.set(cache_key, data, CACHE_TTL_ROOM_HISTORY)
        return Response(data)


class RoomReplayView(APIView):
    """
    GET /api/rooms/<code>/replay/
    Zwraca wszystkie pytania z odpowiedziami wszystkich graczy.
    """
    @extend_schema(
        summary='Replay gry',
        description='Zwraca każde pytanie z odpowiedziami wszystkich graczy, poprawnymi odpowiedziami i czasami.',
        responses={
            200: inline_serializer('RoomReplay', fields={
                'room_code': drf_serializers.CharField(),
                'questions': drf_serializers.ListField(child=drf_serializers.DictField()),
            }),
            404: inline_serializer('ReplayNotFound', fields={'error': drf_serializers.CharField()}),
        },
        tags=['rooms'],
    )
    def get(self, request, code):
        try:
            room = Room.objects.prefetch_related(
                'questions__answers__player'
            ).get(code=code.upper())
        except Room.DoesNotExist:
            return Response({'error': 'Pokój nie istnieje.'}, status=status.HTTP_404_NOT_FOUND)

        questions_data = []
        for q in room.questions.order_by('round_number'):
            answers = []
            fastest_time = None
            fastest_nick = None
            sorted_answers = sorted(q.answers.all(), key=lambda a: a.response_time_ms)
            for a in sorted_answers:
                if a.is_correct and (fastest_time is None or a.response_time_ms < fastest_time):
                    fastest_time = a.response_time_ms
                    fastest_nick = a.player.nickname
                answers.append({
                    'nickname': a.player.nickname,
                    'chosen_option': a.chosen_option,
                    'is_correct': a.is_correct,
                    'response_time_ms': a.response_time_ms,
                    'points_earned': a.points_earned,
                })
            questions_data.append({
                'round': q.round_number,
                'content': q.content,
                'options': q.options,
                'correct': q.correct_answer,
                'explanation': q.explanation,
                'fastest_nick': fastest_nick,
                'answers': answers,
            })

        return Response({'room_code': room.code, 'questions': questions_data})


# ─── Question Packs ────────────────────────────────────────────────────

class PackListView(APIView):
    """GET /api/packs/ — lista paczek użytkownika + publiczne"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Lista paczek pytań',
        tags=['packs'],
        responses={200: inline_serializer('PackList', fields={
            'id': drf_serializers.IntegerField(),
            'name': drf_serializers.CharField(),
            'description': drf_serializers.CharField(),
            'is_public': drf_serializers.BooleanField(),
            'question_count': drf_serializers.IntegerField(),
            'is_mine': drf_serializers.BooleanField(),
        }, many=True)},
    )
    def get(self, request):
        from django.db.models import Count, Q
        packs = QuestionPack.objects.annotate(
            question_count=Count('questions')
        ).filter(
            Q(created_by=request.user) | Q(is_public=True)
        ).order_by('-created_at')
        return Response([
            {
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'is_public': p.is_public,
                'question_count': p.question_count,
                'is_mine': p.created_by_id == request.user.id,
            }
            for p in packs
        ])


class PackCreateView(APIView):
    """POST /api/packs/ — utwórz nową paczkę"""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Utwórz paczkę pytań',
        tags=['packs'],
        request=inline_serializer('PackCreateBody', fields={
            'name': drf_serializers.CharField(),
            'description': drf_serializers.CharField(required=False),
            'is_public': drf_serializers.BooleanField(required=False),
        }),
        responses={
            201: inline_serializer('PackCreated', fields={
                'id': drf_serializers.IntegerField(),
                'name': drf_serializers.CharField(),
            }),
        },
    )
    def post(self, request):
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'error': 'Nazwa jest wymagana'}, status=status.HTTP_400_BAD_REQUEST)
        pack = QuestionPack.objects.create(
            name=name,
            description=request.data.get('description', ''),
            is_public=bool(request.data.get('is_public', False)),
            created_by=request.user,
        )
        return Response({'id': pack.id, 'name': pack.name}, status=status.HTTP_201_CREATED)


class PackDetailView(APIView):
    """GET/PATCH/DELETE /api/packs/<id>/"""
    permission_classes = [IsAuthenticated]

    def _get_pack(self, pk, user):
        try:
            return QuestionPack.objects.prefetch_related('questions').get(pk=pk)
        except QuestionPack.DoesNotExist:
            return None

    @extend_schema(summary='Szczegóły paczki pytań', tags=['packs'])
    def get(self, request, pk):
        pack = self._get_pack(pk, request.user)
        if not pack:
            return Response({'error': 'Nie znaleziono'}, status=status.HTTP_404_NOT_FOUND)
        if not pack.is_public and pack.created_by_id != request.user.id:
            return Response({'error': 'Brak dostępu'}, status=status.HTTP_403_FORBIDDEN)
        return Response({
            'id': pack.id,
            'name': pack.name,
            'description': pack.description,
            'is_public': pack.is_public,
            'is_mine': pack.created_by_id == request.user.id,
            'questions': [
                {
                    'id': q.id,
                    'question_text': q.question_text,
                    'answers': q.answers,
                    'correct_index': q.correct_index,
                    'image_emoji': q.image_emoji,
                }
                for q in pack.questions.all()
            ],
        })

    @extend_schema(summary='Aktualizuj paczkę pytań', tags=['packs'])
    def patch(self, request, pk):
        pack = self._get_pack(pk, request.user)
        if not pack:
            return Response({'error': 'Nie znaleziono'}, status=status.HTTP_404_NOT_FOUND)
        if pack.created_by_id != request.user.id:
            return Response({'error': 'Brak dostępu'}, status=status.HTTP_403_FORBIDDEN)
        if 'name' in request.data:
            pack.name = request.data['name'].strip() or pack.name
        if 'description' in request.data:
            pack.description = request.data['description']
        if 'is_public' in request.data:
            pack.is_public = bool(request.data['is_public'])
        pack.save()
        return Response({'id': pack.id, 'name': pack.name})

    @extend_schema(summary='Usuń paczkę pytań', tags=['packs'])
    def delete(self, request, pk):
        pack = self._get_pack(pk, request.user)
        if not pack:
            return Response({'error': 'Nie znaleziono'}, status=status.HTTP_404_NOT_FOUND)
        if pack.created_by_id != request.user.id:
            return Response({'error': 'Brak dostępu'}, status=status.HTTP_403_FORBIDDEN)
        pack.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PackQuestionCreateView(APIView):
    """POST /api/packs/<id>/questions/ — dodaj pytanie do paczki"""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary='Dodaj pytanie do paczki', tags=['packs'])
    def post(self, request, pk):
        try:
            pack = QuestionPack.objects.get(pk=pk, created_by=request.user)
        except QuestionPack.DoesNotExist:
            return Response({'error': 'Nie znaleziono lub brak dostępu'}, status=status.HTTP_404_NOT_FOUND)

        answers = request.data.get('answers', [])
        if not isinstance(answers, list) or len(answers) != 4:
            return Response({'error': 'answers musi być listą 4 odpowiedzi'}, status=status.HTTP_400_BAD_REQUEST)

        correct_index = request.data.get('correct_index')
        if correct_index not in [0, 1, 2, 3]:
            return Response({'error': 'correct_index musi być 0–3'}, status=status.HTTP_400_BAD_REQUEST)

        question_text = request.data.get('question_text', '').strip()
        if not question_text:
            return Response({'error': 'question_text jest wymagany'}, status=status.HTTP_400_BAD_REQUEST)

        q = CustomQuestion.objects.create(
            pack=pack,
            question_text=question_text,
            answers=answers,
            correct_index=correct_index,
            image_emoji=request.data.get('image_emoji', ''),
        )
        return Response({
            'id': q.id,
            'question_text': q.question_text,
            'answers': q.answers,
            'correct_index': q.correct_index,
            'image_emoji': q.image_emoji,
        }, status=status.HTTP_201_CREATED)


class PackQuestionDetailView(APIView):
    """PATCH/DELETE /api/packs/<pack_id>/questions/<q_id>/"""
    permission_classes = [IsAuthenticated]

    def _get_question(self, pack_id, q_id, user):
        try:
            return CustomQuestion.objects.select_related('pack').get(
                id=q_id, pack_id=pack_id, pack__created_by=user
            )
        except CustomQuestion.DoesNotExist:
            return None

    @extend_schema(summary='Aktualizuj pytanie', tags=['packs'])
    def patch(self, request, pk, q_id):
        q = self._get_question(pk, q_id, request.user)
        if not q:
            return Response({'error': 'Nie znaleziono'}, status=status.HTTP_404_NOT_FOUND)
        if 'question_text' in request.data:
            q.question_text = request.data['question_text']
        if 'answers' in request.data:
            q.answers = request.data['answers']
        if 'correct_index' in request.data:
            q.correct_index = request.data['correct_index']
        if 'image_emoji' in request.data:
            q.image_emoji = request.data['image_emoji']
        q.save()
        return Response({'id': q.id, 'question_text': q.question_text})

    @extend_schema(summary='Usuń pytanie', tags=['packs'])
    def delete(self, request, pk, q_id):
        q = self._get_question(pk, q_id, request.user)
        if not q:
            return Response({'error': 'Nie znaleziono'}, status=status.HTTP_404_NOT_FOUND)
        q.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NextPublicGameView(APIView):
    """GET /api/rooms/public/next/ — nastepna zaplanowana gra publiczna."""

    @extend_schema(
        summary='Następna publiczna gra',
        description=(
            'Zwraca informacje o następnej zaplanowanej publicznej grze quizowej. '
            'Publiczne gry są tworzone automatycznie przez scheduler.'
        ),
        responses={
            200: inline_serializer('NextPublicGame', fields={
                'room_id': drf_serializers.CharField(),
                'start_time': drf_serializers.CharField(),
                'player_count': drf_serializers.IntegerField(),
                'max_players': drf_serializers.IntegerField(),
                'seconds_until_start': drf_serializers.IntegerField(),
                'interval_minutes': drf_serializers.IntegerField(),
                'categories': drf_serializers.ListField(child=drf_serializers.CharField()),
            }),
            404: inline_serializer('NoPublicGame', fields={'message': drf_serializers.CharField()}),
        },
        tags=['rooms'],
    )
    def get(self, request):
        now = timezone.now()
        game = Room.objects.filter(
            is_public=True,
            status=Room.Status.LOBBY,
            scheduled_at__gt=now,
        ).order_by('scheduled_at').first()
        if not game:
            return Response({'message': 'No upcoming public game'}, status=status.HTTP_404_NOT_FOUND)
        config = PublicTournamentConfig.get()
        seconds_until_start = max(0, int((game.scheduled_at - now).total_seconds()))
        return Response({
            'room_id': game.code,
            'start_time': game.scheduled_at.isoformat(),
            'player_count': game.players.count(),
            'max_players': config.max_players,
            'seconds_until_start': seconds_until_start,
            'interval_minutes': config.interval_minutes,
            'categories': game.categories,
        })


class NextPublicTournamentView(APIView):
    """
    GET /api/tournaments/next-public/
    Alias dla bannera turniejowego — 204 No Content gdy brak zaplanowanego turnieju.
    """

    @extend_schema(
        summary='Następny publiczny turniej (dla banera)',
        description='Zwraca dane najbliższego zaplanowanego turnieju publicznego lub 204 gdy brak.',
        responses={
            200: inline_serializer('NextPublicTournament', fields={
                'room_id': drf_serializers.CharField(),
                'start_time': drf_serializers.CharField(),
                'player_count': drf_serializers.IntegerField(),
                'max_players': drf_serializers.IntegerField(),
                'seconds_until_start': drf_serializers.IntegerField(),
                'interval_minutes': drf_serializers.IntegerField(),
                'categories': drf_serializers.ListField(child=drf_serializers.CharField()),
            }),
            204: None,
        },
        tags=['tournaments'],
    )
    def get(self, request):
        now = timezone.now()
        game = Room.objects.filter(
            is_public=True,
            status=Room.Status.LOBBY,
            scheduled_at__gt=now,
        ).order_by('scheduled_at').first()
        if not game:
            return Response(status=status.HTTP_204_NO_CONTENT)
        config = PublicTournamentConfig.get()
        seconds_until_start = max(0, int((game.scheduled_at - now).total_seconds()))
        return Response({
            'room_id': game.code,
            'start_time': game.scheduled_at.isoformat(),
            'player_count': game.players.count(),
            'max_players': config.max_players,
            'seconds_until_start': seconds_until_start,
            'interval_minutes': config.interval_minutes,
            'categories': game.categories,
        })


class PublicTournamentConfigView(APIView):
    """GET/PATCH /api/tournaments/config/ — konfiguracja turniejów publicznych."""

    @extend_schema(
        summary='Pobierz konfigurację turniejów publicznych',
        tags=['tournaments'],
        responses={200: inline_serializer('TournamentConfig', fields={
            'interval_minutes': drf_serializers.IntegerField(),
            'max_players': drf_serializers.IntegerField(),
            'is_enabled': drf_serializers.BooleanField(),
        })},
    )
    def get(self, request):
        config = PublicTournamentConfig.get()
        return Response({
            'interval_minutes': config.interval_minutes,
            'max_players': config.max_players,
            'is_enabled': config.is_enabled,
        })

    @extend_schema(
        summary='Aktualizuj konfigurację turniejów publicznych',
        tags=['tournaments'],
        request=inline_serializer('TournamentConfigUpdate', fields={
            'interval_minutes': drf_serializers.IntegerField(required=False),
            'max_players': drf_serializers.IntegerField(required=False),
            'is_enabled': drf_serializers.BooleanField(required=False),
        }),
        responses={200: inline_serializer('TournamentConfigUpdated', fields={
            'interval_minutes': drf_serializers.IntegerField(),
            'max_players': drf_serializers.IntegerField(),
            'is_enabled': drf_serializers.BooleanField(),
        })},
    )
    def patch(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Brak uprawnień'}, status=status.HTTP_403_FORBIDDEN)
        config = PublicTournamentConfig.get()
        if 'interval_minutes' in request.data:
            val = int(request.data['interval_minutes'])
            if val < 1:
                return Response({'error': 'interval_minutes musi być >= 1'}, status=status.HTTP_400_BAD_REQUEST)
            config.interval_minutes = val
        if 'max_players' in request.data:
            val = int(request.data['max_players'])
            if val < 2:
                return Response({'error': 'max_players musi być >= 2'}, status=status.HTTP_400_BAD_REQUEST)
            config.max_players = val
        if 'is_enabled' in request.data:
            config.is_enabled = bool(request.data['is_enabled'])
        config.save()
        return Response({
            'interval_minutes': config.interval_minutes,
            'max_players': config.max_players,
            'is_enabled': config.is_enabled,
        })


class TriggerPublicTournamentView(APIView):
    """POST /api/tournaments/trigger/ — ręcznie uruchom turniej publiczny."""

    @extend_schema(
        summary='Ręcznie utwórz turniej publiczny',
        tags=['tournaments'],
        responses={
            201: inline_serializer('TournamentTriggered', fields={
                'room_id': drf_serializers.CharField(),
                'start_time': drf_serializers.CharField(),
            }),
        },
    )
    def post(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Brak uprawnień'}, status=status.HTTP_403_FORBIDDEN)
        import random
        from datetime import timedelta
        from apps.rooms.constants import QUIZ_CATEGORIES
        now = timezone.now()
        start_time = now + timedelta(minutes=5)
        categories = random.sample(QUIZ_CATEGORIES, 3)
        room = Room.objects.create(
            categories=categories,
            is_public=True,
            scheduled_at=start_time,
            total_rounds=10,
        )
        logger.info('Ręcznie uruchomiono turniej publiczny: code=%s start=%s', room.code, start_time)
        return Response({
            'room_id': room.code,
            'start_time': start_time.isoformat(),
        }, status=status.HTTP_201_CREATED)
