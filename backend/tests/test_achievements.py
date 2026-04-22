"""
Testy logiki osiągnięć (achievements).

Pokrycie:
- first_blood: pierwsze zwycięstwo
- perfect_round: wszystkie odpowiedzi poprawne
- hot_streak_5/10/20: seria 5/10/20 poprawnych odpowiedzi
- veteran: 10 rozegranych gier
- addict: 50 rozegranych gier
- social_butterfly: 5 znajomych
- speed_demon: poprawna odpowiedź < 3 sekundy
- comeback_king: wygrana po byciu ostatnim w połowie
- Brak duplikatów (ten sam achievement przyznawany tylko raz)
- GET /api/profile/achievements/ zwraca pełną listę
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile, Friendship, Achievement, UserAchievement
from apps.accounts.achievements import (
    check_and_award_achievements,
    ensure_achievements_exist,
    _try_award,
    _check_hot_streaks,
    _check_social_butterfly,
    _check_speed_demon,
    _check_comeback_king,
    _check_perfect_round,
    _check_first_blood,
    _check_games_played,
)
from apps.rooms.models import Room, Player, Question, Answer


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def user(db):
    u = User.objects.create_user('ach@test.com', 'ach@test.com', 'pass1234')
    UserProfile.objects.create(user=u, display_name='AchPlayer')
    return u


@pytest.fixture
def finished_room(db):
    room = Room.objects.create(
        categories=['Historia'],
        total_rounds=10,
        status=Room.Status.FINISHED,
    )
    return room


@pytest.fixture
def player(user, finished_room):
    return Player.objects.create(
        room=finished_room,
        user=user,
        nickname='AchPlayer',
        score=5000,
        is_host=True,
    )


def _make_question(room, round_number, correct_answer='A'):
    return Question.objects.create(
        room=room,
        round_number=round_number,
        content=f'Pytanie {round_number}',
        options={'A': 'O1', 'B': 'O2', 'C': 'O3', 'D': 'O4'},
        correct_answer=correct_answer,
    )


def _make_answer(player, question, is_correct=True, response_time_ms=5000, points=1000):
    return Answer.objects.create(
        player=player,
        question=question,
        chosen_option=question.correct_answer if is_correct else 'B',
        response_time_ms=response_time_ms,
        points_earned=points if is_correct else 0,
        is_correct=is_correct,
    )


# ─── ensure_achievements_exist ────────────────────────────────────────────────

def test_ensure_achievements_exist_creates_all(db):
    ensure_achievements_exist()
    from apps.accounts.achievements import ACHIEVEMENT_DEFINITIONS
    assert Achievement.objects.count() == len(ACHIEVEMENT_DEFINITIONS)


def test_ensure_achievements_exist_idempotent(db):
    ensure_achievements_exist()
    ensure_achievements_exist()
    from apps.accounts.achievements import ACHIEVEMENT_DEFINITIONS
    assert Achievement.objects.count() == len(ACHIEVEMENT_DEFINITIONS)


# ─── first_blood ─────────────────────────────────────────────────────────────

def test_first_blood_awarded_for_first_win(user, finished_room, player):
    ensure_achievements_exist()
    # Gracz wygrywa (tylko on w pokoju → jest zwycięzcą)
    unlocked = check_and_award_achievements(user, player, finished_room)
    assert 'First Blood' in unlocked


def test_first_blood_not_awarded_on_loss(user, finished_room, player):
    ensure_achievements_exist()
    # Dodaj gracza z wyższym wynikiem
    Player.objects.create(room=finished_room, nickname='Winner', score=99999)
    unlocked = check_and_award_achievements(user, player, finished_room)
    assert 'First Blood' not in unlocked


def test_first_blood_not_duplicated(user, finished_room, player):
    ensure_achievements_exist()
    check_and_award_achievements(user, player, finished_room)
    # Drugie wywołanie
    room2 = Room.objects.create(
        categories=['Nauka'], total_rounds=5, status=Room.Status.FINISHED
    )
    p2 = Player.objects.create(room=room2, user=user, nickname='AchPlayer', score=1000)
    unlocked2 = check_and_award_achievements(user, p2, room2)
    assert 'First Blood' not in unlocked2


# ─── perfect_round ────────────────────────────────────────────────────────────

def test_perfect_round_awarded_when_all_correct(user, finished_room, player):
    ensure_achievements_exist()
    # Utwórz 10 pytań i wszystkie poprawne odpowiedzi
    for i in range(1, 11):
        q = _make_question(finished_room, i)
        _make_answer(player, q, is_correct=True)

    unlocked = check_and_award_achievements(user, player, finished_room)
    assert 'Perfect Round' in unlocked


def test_perfect_round_not_awarded_when_one_wrong(user, finished_room, player):
    ensure_achievements_exist()
    questions = [_make_question(finished_room, i) for i in range(1, 11)]
    for i, q in enumerate(questions):
        _make_answer(player, q, is_correct=(i != 5))

    unlocked = check_and_award_achievements(user, player, finished_room)
    assert 'Perfect Round' not in unlocked


# ─── hot_streak ───────────────────────────────────────────────────────────────

def test_hot_streak_5_awarded(user, finished_room, player):
    ensure_achievements_exist()
    player.best_streak = 5
    player.save()
    unlocked = []
    _check_hot_streaks(user, player, unlocked)
    assert 'Hot Streak 5' in unlocked


def test_hot_streak_10_awarded(user, finished_room, player):
    ensure_achievements_exist()
    player.best_streak = 10
    player.save()
    unlocked = []
    _check_hot_streaks(user, player, unlocked)
    assert 'Hot Streak 10' in unlocked
    assert 'Hot Streak 5' in unlocked


def test_hot_streak_20_awarded(user, finished_room, player):
    ensure_achievements_exist()
    player.best_streak = 20
    player.save()
    unlocked = []
    _check_hot_streaks(user, player, unlocked)
    assert 'Hot Streak 20' in unlocked


def test_hot_streak_5_not_awarded_below_threshold(user, finished_room, player):
    ensure_achievements_exist()
    player.best_streak = 4
    player.save()
    unlocked = []
    _check_hot_streaks(user, player, unlocked)
    assert 'Hot Streak 5' not in unlocked


# ─── veteran / addict ────────────────────────────────────────────────────────

def test_veteran_awarded_at_10_games(user, finished_room, player):
    ensure_achievements_exist()
    user.profile.games_played = 10
    user.profile.save()
    unlocked = []
    _check_games_played(user, user.profile, unlocked)
    assert 'Veteran' in unlocked


def test_veteran_not_awarded_below_10_games(user, finished_room, player):
    ensure_achievements_exist()
    user.profile.games_played = 9
    user.profile.save()
    unlocked = []
    _check_games_played(user, user.profile, unlocked)
    assert 'Veteran' not in unlocked


def test_addict_awarded_at_50_games(user, finished_room, player):
    ensure_achievements_exist()
    user.profile.games_played = 50
    user.profile.save()
    unlocked = []
    _check_games_played(user, user.profile, unlocked)
    assert 'Addict' in unlocked


# ─── social_butterfly ────────────────────────────────────────────────────────

def test_social_butterfly_awarded_at_5_friends(user, db):
    ensure_achievements_exist()
    for i in range(5):
        friend = User.objects.create_user(f'f{i}@sb.com', f'f{i}@sb.com', 'pass')
        Friendship.objects.create(
            from_user=user, to_user=friend, status=Friendship.Status.ACCEPTED
        )
    unlocked = []
    _check_social_butterfly(user, unlocked)
    assert 'Social Butterfly' in unlocked


def test_social_butterfly_not_awarded_below_5_friends(user, db):
    ensure_achievements_exist()
    for i in range(4):
        friend = User.objects.create_user(f'g{i}@sb.com', f'g{i}@sb.com', 'pass')
        Friendship.objects.create(
            from_user=user, to_user=friend, status=Friendship.Status.ACCEPTED
        )
    unlocked = []
    _check_social_butterfly(user, unlocked)
    assert 'Social Butterfly' not in unlocked


def test_social_butterfly_counts_both_directions(user, db):
    """Znajomości inicjowane przez innego użytkownika też liczą się."""
    ensure_achievements_exist()
    for i in range(5):
        friend = User.objects.create_user(f'h{i}@sb.com', f'h{i}@sb.com', 'pass')
        Friendship.objects.create(
            from_user=friend, to_user=user, status=Friendship.Status.ACCEPTED
        )
    unlocked = []
    _check_social_butterfly(user, unlocked)
    assert 'Social Butterfly' in unlocked


# ─── speed_demon ─────────────────────────────────────────────────────────────

def test_speed_demon_awarded_for_fast_correct_answer(user, finished_room, player):
    ensure_achievements_exist()
    q = _make_question(finished_room, 1)
    _make_answer(player, q, is_correct=True, response_time_ms=2999)
    unlocked = []
    _check_speed_demon(user, player, unlocked)
    assert 'Speed Demon' in unlocked


def test_speed_demon_not_awarded_if_too_slow(user, finished_room, player):
    ensure_achievements_exist()
    q = _make_question(finished_room, 1)
    _make_answer(player, q, is_correct=True, response_time_ms=5000)
    unlocked = []
    _check_speed_demon(user, player, unlocked)
    assert 'Speed Demon' not in unlocked


def test_speed_demon_not_awarded_for_wrong_fast_answer(user, finished_room, player):
    ensure_achievements_exist()
    q = _make_question(finished_room, 1)
    _make_answer(player, q, is_correct=False, response_time_ms=1000)
    unlocked = []
    _check_speed_demon(user, player, unlocked)
    assert 'Speed Demon' not in unlocked


# ─── comeback_king ────────────────────────────────────────────────────────────

def test_comeback_king_awarded_when_last_at_halftime_but_wins(user, finished_room, player):
    ensure_achievements_exist()
    opponent = Player.objects.create(
        room=finished_room, nickname='Opponent', score=3000
    )

    # Halftime = runda 5. Gracz miał 0 punktów w połowie, rywale mieli więcej.
    for i in range(1, 11):
        q = _make_question(finished_room, i)
        if i <= 5:
            # Gracz odpowiadał źle w pierwszej połowie
            _make_answer(player, q, is_correct=False, response_time_ms=5000, points=0)
            Answer.objects.create(
                player=opponent, question=q,
                chosen_option='A', response_time_ms=2000,
                points_earned=1000, is_correct=True,
            )
        else:
            # W drugiej połowie gracz odpowiadał świetnie
            _make_answer(player, q, is_correct=True, response_time_ms=1000, points=1500)

    player.score = 9000  # finalna wygrana
    player.save()
    all_players = list(Player.objects.filter(room=finished_room).order_by('-score'))
    unlocked = []
    _check_comeback_king(user, player, finished_room, all_players, is_winner=True, unlocked=unlocked)
    assert 'Comeback King' in unlocked


def test_comeback_king_not_awarded_if_not_winner(user, finished_room, player):
    ensure_achievements_exist()
    Player.objects.create(room=finished_room, nickname='Opponent', score=player.score + 1)
    all_players = list(Player.objects.filter(room=finished_room).order_by('-score'))
    unlocked = []
    _check_comeback_king(user, player, finished_room, all_players, is_winner=False, unlocked=unlocked)
    assert 'Comeback King' not in unlocked


# ─── API endpoint ────────────────────────────────────────────────────────────

def test_achievements_endpoint_returns_all(user):
    c = APIClient()
    c.force_authenticate(user=user)
    resp = c.get('/api/profile/achievements/')
    assert resp.status_code == 200
    from apps.accounts.achievements import ACHIEVEMENT_DEFINITIONS
    assert len(resp.data) == len(ACHIEVEMENT_DEFINITIONS)


def test_achievements_endpoint_marks_unlocked(user):
    ensure_achievements_exist()
    ach = Achievement.objects.get(condition_type='first_blood')
    UserAchievement.objects.create(user=user, achievement=ach)

    c = APIClient()
    c.force_authenticate(user=user)
    resp = c.get('/api/profile/achievements/')
    fb = next(a for a in resp.data if a['condition_type'] == 'first_blood')
    assert fb['unlocked'] is True
    assert fb['unlocked_at'] is not None


def test_achievements_endpoint_requires_auth():
    c = APIClient()
    resp = c.get('/api/profile/achievements/')
    assert resp.status_code == 403
