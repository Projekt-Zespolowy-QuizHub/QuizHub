"""
Logika achievementów QuizArena.

Wywoływana po zakończeniu każdej gry (send_game_over w consumers.py).
"""
from django.db import models as django_models

ACHIEVEMENT_DEFINITIONS = [
    {
        'condition_type': 'first_blood',
        'name': 'First Blood',
        'description': 'Wygraj swoją pierwszą grę.',
        'icon': '🩸',
    },
    {
        'condition_type': 'perfect_round',
        'name': 'Perfect Round',
        'description': 'Odpowiedz poprawnie na wszystkie pytania w jednej grze.',
        'icon': '⭐',
    },
    {
        'condition_type': 'hot_streak_10',
        'name': 'On Fire',
        'description': 'Uzyskaj serię 10 poprawnych odpowiedzi.',
        'icon': '💥',
    },
    {
        'condition_type': 'hot_streak_20',
        'name': 'Unstoppable',
        'description': 'Uzyskaj serię 20 poprawnych odpowiedzi.',
        'icon': '⚡',
    },
    {
        'condition_type': 'hot_streak_50',
        'name': 'Legendary',
        'description': 'Uzyskaj serię 50 poprawnych odpowiedzi.',
        'icon': '🌟',
    },
    {
        'condition_type': 'veteran',
        'name': 'Veteran',
        'description': 'Rozegraj 25 gier.',
        'icon': '🎖️',
    },
    {
        'condition_type': 'addict',
        'name': 'Addict',
        'description': 'Rozegraj 100 gier.',
        'icon': '🏆',
    },
    {
        'condition_type': 'no_lifer',
        'name': 'No-Lifer',
        'description': 'Rozegraj 500 gier.',
        'icon': '💀',
    },
    {
        'condition_type': 'social_butterfly',
        'name': 'Social Butterfly',
        'description': 'Dodaj 10 znajomych.',
        'icon': '🦋',
    },
    {
        'condition_type': 'speed_demon',
        'name': 'Speed Demon',
        'description': 'Odpowiedz poprawnie w czasie poniżej 2 sekund.',
        'icon': '🏎️',
    },
    {
        'condition_type': 'lightning',
        'name': 'Lightning',
        'description': 'Odpowiedz poprawnie w czasie poniżej 1 sekundy.',
        'icon': '⚡',
    },
    {
        'condition_type': 'comeback_king',
        'name': 'Comeback King',
        'description': 'Wygraj grę, będąc ostatnim w połowie rozgrywki.',
        'icon': '👑',
    },
    {
        'condition_type': 'flawless_victory',
        'name': 'Flawless Victory',
        'description': 'Wygraj z 100% poprawnością i najszybszym średnim czasem odpowiedzi.',
        'icon': '💎',
    },
    {
        'condition_type': 'rich',
        'name': 'Rich',
        'description': 'Zgromadź 1000 monet na koncie.',
        'icon': '💰',
    },
    {
        'condition_type': 'whale',
        'name': 'Whale',
        'description': 'Zgromadź 5000 monet na koncie.',
        'icon': '🐋',
    },
    {
        'condition_type': 'collector',
        'name': 'Collector',
        'description': 'Posiadaj 10 przedmiotów ze sklepu.',
        'icon': '🎁',
    },
    {
        'condition_type': 'tournament_champion',
        'name': 'Tournament Champion',
        'description': 'Wygraj turniej.',
        'icon': '🥇',
    },
    {
        'condition_type': 'clan_leader',
        'name': 'Clan Leader',
        'description': 'Stwórz klan z 10 lub więcej członkami.',
        'icon': '⚔️',
    },
    {
        'condition_type': 'survivor',
        'name': 'Survivor',
        'description': 'Przeżyj 25 rund w trybie survival.',
        'icon': '🛡️',
    },
    {
        'condition_type': 'duelist',
        'name': 'Duelist',
        'description': 'Wygraj 10 pojedynków 1v1.',
        'icon': '🗡️',
    },
]


def ensure_achievements_exist():
    """Tworzy/aktualizuje wpisy Achievement w DB. Bezpieczne do wielokrotnego wywołania."""
    from .models import Achievement
    for defn in ACHIEVEMENT_DEFINITIONS:
        obj, created = Achievement.objects.get_or_create(
            condition_type=defn['condition_type'],
            defaults={
                'name': defn['name'],
                'description': defn['description'],
                'icon': defn['icon'],
            },
        )
        if not created:
            # Aktualizuj nazwę i opis (np. po zmianie "Hot Streak 10" → "On Fire")
            if obj.name != defn['name'] or obj.description != defn['description'] or obj.icon != defn['icon']:
                obj.name = defn['name']
                obj.description = defn['description']
                obj.icon = defn['icon']
                obj.save(update_fields=['name', 'description', 'icon'])


def _try_award(user, condition_type: str, unlocked: list) -> None:
    """Przyznaje achievement jeśli jeszcze nie odblokowany. Dołącza nazwę do listy unlocked."""
    from .models import Achievement, UserAchievement
    try:
        achievement = Achievement.objects.get(condition_type=condition_type)
        _, created = UserAchievement.objects.get_or_create(user=user, achievement=achievement)
        if created:
            unlocked.append(achievement.name)
    except Achievement.DoesNotExist:
        pass


def _is_room_winner(player, all_players: list) -> bool:
    """Zwraca True jeśli gracz jest zwycięzcą (najwyższy wynik w pokoju)."""
    return bool(all_players) and all_players[0].id == player.id


def _check_games_played(user, profile, unlocked: list) -> None:
    if profile.games_played >= 500:
        _try_award(user, 'no_lifer', unlocked)
    if profile.games_played >= 100:
        _try_award(user, 'addict', unlocked)
    if profile.games_played >= 25:
        _try_award(user, 'veteran', unlocked)


def _check_first_blood(user, player, is_winner: bool, unlocked: list) -> None:
    """Przyznaje First Blood za pierwsze zwycięstwo."""
    if not is_winner:
        return
    from apps.rooms.models import Player, Room
    wins = sum(
        1
        for p in Player.objects.filter(user=user).select_related('room')
        if p.room.status == Room.Status.FINISHED
        and not Player.objects.filter(room=p.room, score__gt=p.score).exists()
    )
    if wins == 1:
        _try_award(user, 'first_blood', unlocked)


def _check_perfect_round(user, player, room, unlocked: list) -> None:
    """Przyznaje Perfect Round jeśli wszystkie odpowiedzi poprawne."""
    from apps.rooms.models import Answer
    total_q = room.total_rounds
    answers = Answer.objects.filter(player=player)
    if answers.count() == total_q and answers.filter(is_correct=True).count() == total_q:
        _try_award(user, 'perfect_round', unlocked)


def _check_hot_streaks(user, player, unlocked: list) -> None:
    if player.best_streak >= 50:
        _try_award(user, 'hot_streak_50', unlocked)
    if player.best_streak >= 20:
        _try_award(user, 'hot_streak_20', unlocked)
    if player.best_streak >= 10:
        _try_award(user, 'hot_streak_10', unlocked)


def _check_social_butterfly(user, unlocked: list) -> None:
    from .models import Friendship
    friend_count = Friendship.objects.filter(
        django_models.Q(from_user=user) | django_models.Q(to_user=user),
        status=Friendship.Status.ACCEPTED,
    ).count()
    if friend_count >= 10:
        _try_award(user, 'social_butterfly', unlocked)


def _check_speed(user, player, unlocked: list) -> None:
    from apps.rooms.models import Answer
    if Answer.objects.filter(player=player, is_correct=True, response_time_ms__lte=1000).exists():
        _try_award(user, 'lightning', unlocked)
    if Answer.objects.filter(player=player, is_correct=True, response_time_ms__lte=2000).exists():
        _try_award(user, 'speed_demon', unlocked)


def _check_comeback_king(user, player, room, all_players: list, is_winner: bool, unlocked: list) -> None:
    """Przyznaje Comeback King za wygraną po byciu ostatnim w połowie gry."""
    if not is_winner or len(all_players) <= 1:
        return
    from apps.rooms.models import Answer
    halftime_round = room.total_rounds // 2
    halftime_scores = {
        p.id: Answer.objects.filter(
            player=p,
            question__round_number__lte=halftime_round,
        ).aggregate(total=django_models.Sum('points_earned'))['total'] or 0
        for p in all_players
    }
    my_halftime = halftime_scores.get(player.id, 0)
    min_halftime = min(halftime_scores.values())
    if my_halftime <= min_halftime:
        _try_award(user, 'comeback_king', unlocked)


def _check_flawless_victory(user, player, room, all_players: list, is_winner: bool, unlocked: list) -> None:
    """Przyznaje Flawless Victory za wygraną z 100% poprawnością i najszybszym średnim czasem."""
    if not is_winner or len(all_players) <= 1:
        return
    from apps.rooms.models import Answer
    answers = Answer.objects.filter(player=player)
    total_q = room.total_rounds
    if answers.count() != total_q or answers.filter(is_correct=False).exists():
        return
    my_avg = answers.aggregate(avg=django_models.Avg('response_time_ms'))['avg'] or 0
    for other in all_players:
        if other.id == player.id:
            continue
        other_avg = Answer.objects.filter(player=other).aggregate(
            avg=django_models.Avg('response_time_ms')
        )['avg'] or float('inf')
        if other_avg <= my_avg:
            return
    _try_award(user, 'flawless_victory', unlocked)


def _check_coins(user, profile, unlocked: list) -> None:
    if profile.coins >= 5000:
        _try_award(user, 'whale', unlocked)
    if profile.coins >= 1000:
        _try_award(user, 'rich', unlocked)


def _check_collector(user, unlocked: list) -> None:
    from .models import UserItem
    count = UserItem.objects.filter(user=user).count()
    if count >= 10:
        _try_award(user, 'collector', unlocked)


def _check_clan_leader(user, unlocked: list) -> None:
    from .models import ClanMembership
    leader_clans = ClanMembership.objects.filter(
        user=user, role=ClanMembership.Role.LEADER
    ).values_list('clan_id', flat=True)
    for clan_id in leader_clans:
        member_count = ClanMembership.objects.filter(clan_id=clan_id).count()
        if member_count >= 10:
            _try_award(user, 'clan_leader', unlocked)
            break


def _check_survivor(user, player, room, unlocked: list) -> None:
    """Przyznaje Survivor za przeżycie 25 rund w trybie survival."""
    from apps.rooms.models import Room
    if room.game_mode != Room.GameMode.SURVIVAL:
        return
    if player.best_streak >= 25:
        _try_award(user, 'survivor', unlocked)


def _check_duelist(user, unlocked: list) -> None:
    """Przyznaje Duelist za wygranie 10 pojedynków 1v1."""
    from apps.rooms.models import Player, Room
    duel_wins = 0
    duel_players = Player.objects.filter(
        user=user,
        room__game_mode=Room.GameMode.DUEL,
        room__status=Room.Status.FINISHED,
    ).select_related('room')
    for p in duel_players:
        if not Player.objects.filter(room=p.room, score__gt=p.score).exists():
            duel_wins += 1
    if duel_wins >= 10:
        _try_award(user, 'duelist', unlocked)


def check_and_award_achievements(user, player, room) -> list:
    """
    Sprawdza i przyznaje achievementy graczowi po zakończeniu gry.

    Args:
        user: obiekt Django User
        player: instancja Player (z score, best_streak itp.)
        room: instancja Room (z total_rounds)

    Returns:
        Lista nazw nowo odblokowanych achievementów.
    """
    from apps.rooms.models import Player
    ensure_achievements_exist()

    unlocked: list = []
    profile = user.profile
    all_players = list(Player.objects.filter(room=room).order_by('-score'))
    is_winner = _is_room_winner(player, all_players)

    _check_games_played(user, profile, unlocked)
    _check_first_blood(user, player, is_winner, unlocked)
    _check_perfect_round(user, player, room, unlocked)
    _check_hot_streaks(user, player, unlocked)
    _check_social_butterfly(user, unlocked)
    _check_speed(user, player, unlocked)
    _check_comeback_king(user, player, room, all_players, is_winner, unlocked)
    _check_flawless_victory(user, player, room, all_players, is_winner, unlocked)
    _check_coins(user, profile, unlocked)
    _check_collector(user, unlocked)
    _check_clan_leader(user, unlocked)
    _check_survivor(user, player, room, unlocked)
    _check_duelist(user, unlocked)

    return unlocked
