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
        'condition_type': 'hot_streak_5',
        'name': 'Hot Streak 5',
        'description': 'Uzyskaj serię 5 poprawnych odpowiedzi.',
        'icon': '🔥',
    },
    {
        'condition_type': 'hot_streak_10',
        'name': 'Hot Streak 10',
        'description': 'Uzyskaj serię 10 poprawnych odpowiedzi.',
        'icon': '💥',
    },
    {
        'condition_type': 'hot_streak_20',
        'name': 'Hot Streak 20',
        'description': 'Uzyskaj serię 20 poprawnych odpowiedzi.',
        'icon': '⚡',
    },
    {
        'condition_type': 'veteran',
        'name': 'Veteran',
        'description': 'Rozegraj 10 gier.',
        'icon': '🎖️',
    },
    {
        'condition_type': 'addict',
        'name': 'Addict',
        'description': 'Rozegraj 50 gier.',
        'icon': '🏆',
    },
    {
        'condition_type': 'social_butterfly',
        'name': 'Social Butterfly',
        'description': 'Dodaj 5 znajomych.',
        'icon': '🦋',
    },
    {
        'condition_type': 'speed_demon',
        'name': 'Speed Demon',
        'description': 'Odpowiedz poprawnie w czasie poniżej 3 sekund.',
        'icon': '🏎️',
    },
    {
        'condition_type': 'comeback_king',
        'name': 'Comeback King',
        'description': 'Wygraj grę, będąc ostatnim w połowie rozgrywki.',
        'icon': '👑',
    },
]


def ensure_achievements_exist():
    """Tworzy wpisy Achievement w DB jeśli nie istnieją. Bezpieczne do wielokrotnego wywołania."""
    from .models import Achievement
    for defn in ACHIEVEMENT_DEFINITIONS:
        Achievement.objects.get_or_create(
            condition_type=defn['condition_type'],
            defaults={
                'name': defn['name'],
                'description': defn['description'],
                'icon': defn['icon'],
            },
        )


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
    if profile.games_played >= 50:
        _try_award(user, 'addict', unlocked)
    if profile.games_played >= 10:
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
    if player.best_streak >= 5:
        _try_award(user, 'hot_streak_5', unlocked)
    if player.best_streak >= 10:
        _try_award(user, 'hot_streak_10', unlocked)
    if player.best_streak >= 20:
        _try_award(user, 'hot_streak_20', unlocked)


def _check_social_butterfly(user, unlocked: list) -> None:
    from .models import Friendship
    friend_count = Friendship.objects.filter(
        django_models.Q(from_user=user) | django_models.Q(to_user=user),
        status=Friendship.Status.ACCEPTED,
    ).count()
    if friend_count >= 5:
        _try_award(user, 'social_butterfly', unlocked)


def _check_speed_demon(user, player, unlocked: list) -> None:
    from apps.rooms.models import Answer
    if Answer.objects.filter(player=player, is_correct=True, response_time_ms__lte=3000).exists():
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
    _check_speed_demon(user, player, unlocked)
    _check_comeback_king(user, player, room, all_players, is_winner, unlocked)

    return unlocked
