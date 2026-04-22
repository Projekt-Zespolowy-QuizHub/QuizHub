"""
Testy statystyk użytkownika.

Pokrycie:
- GET /api/profile/stats/ zwraca poprawną strukturę
- games_played, wins, win_rate
- correct_percentage
- avg_response_time_ms
- best_streak
- category_accuracy
- games_per_day
- performance_trend (ostatnie 10 gier)
- Brak gier → sensowne domyślne wartości (0, [])
- Endpoint wymaga autoryzacji
"""
import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile
from apps.rooms.models import Room, Player, Question, Answer


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_stats_cache():
    """Wyczyść cache przed każdym testem, żeby statystyki nie były stale."""
    cache.clear()
    yield
    cache.clear()

@pytest.fixture
def user(db):
    u = User.objects.create_user('stats@test.com', 'stats@test.com', 'pass1234')
    UserProfile.objects.create(user=u, display_name='StatsPlayer', total_score=5000)
    return u


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_finished_room(categories=None):
    return Room.objects.create(
        categories=categories or ['Historia'],
        total_rounds=5,
        status=Room.Status.FINISHED,
    )


def _make_question(room, round_number, correct_answer='A'):
    return Question.objects.create(
        room=room,
        round_number=round_number,
        content=f'Q{round_number}',
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


# ─── No games ─────────────────────────────────────────────────────────────────

def test_stats_no_games(client, user):
    resp = client.get('/api/profile/stats/')
    assert resp.status_code == 200
    data = resp.data
    assert data['display_name'] == 'StatsPlayer'
    assert data['games_played'] == 0
    assert data['wins'] == 0
    assert data['win_rate'] == 0
    assert data['correct_percentage'] == 0
    assert data['avg_response_time_ms'] == 0
    assert data['best_streak'] == 0
    assert data['category_accuracy'] == []
    assert data['performance_trend'] == []


# ─── Correct percentage ───────────────────────────────────────────────────────

def test_stats_correct_percentage(client, user):
    room = _make_finished_room()
    player = Player.objects.create(room=room, user=user, nickname='StatsPlayer', score=3000, best_streak=2)

    # 2 poprawne, 1 błędna z 3 odpowiedzi → 66.7%
    for i in range(1, 4):
        q = _make_question(room, i)
        _make_answer(player, q, is_correct=(i <= 2))

    resp = client.get('/api/profile/stats/')
    assert resp.status_code == 200
    assert resp.data['correct_percentage'] == pytest.approx(66.7, abs=0.1)


# ─── Win rate ────────────────────────────────────────────────────────────────

def test_stats_win_rate_single_win(client, user):
    """Gracz jest jedynym graczem w pokoju — automatycznie wygrywa."""
    room = _make_finished_room()
    Player.objects.create(room=room, user=user, nickname='StatsPlayer', score=1000, best_streak=0)

    resp = client.get('/api/profile/stats/')
    assert resp.status_code == 200
    assert resp.data['wins'] == 1
    assert resp.data['win_rate'] == 100.0


def test_stats_win_rate_no_wins(client, user):
    room = _make_finished_room()
    player = Player.objects.create(room=room, user=user, nickname='StatsPlayer', score=500)
    # Ktoś inny z wyższym wynikiem
    Player.objects.create(room=room, nickname='Winner', score=9999)

    resp = client.get('/api/profile/stats/')
    assert resp.status_code == 200
    assert resp.data['wins'] == 0
    assert resp.data['win_rate'] == 0


# ─── Best streak ─────────────────────────────────────────────────────────────

def test_stats_best_streak_across_games(client, user):
    room1 = _make_finished_room()
    room2 = _make_finished_room()
    Player.objects.create(room=room1, user=user, nickname='StatsPlayer', score=1000, best_streak=3)
    Player.objects.create(room=room2, user=user, nickname='StatsPlayer', score=2000, best_streak=7)

    resp = client.get('/api/profile/stats/')
    assert resp.status_code == 200
    assert resp.data['best_streak'] == 7


# ─── Avg response time ────────────────────────────────────────────────────────

def test_stats_avg_response_time(client, user):
    room = _make_finished_room()
    player = Player.objects.create(room=room, user=user, nickname='StatsPlayer', score=2000)
    # Dwie odpowiedzi: 4000ms i 6000ms → avg 5000ms
    q1 = _make_question(room, 1)
    q2 = _make_question(room, 2)
    _make_answer(player, q1, response_time_ms=4000)
    _make_answer(player, q2, response_time_ms=6000)

    resp = client.get('/api/profile/stats/')
    assert resp.status_code == 200
    assert resp.data['avg_response_time_ms'] == 5000


# ─── Performance trend ────────────────────────────────────────────────────────

def test_stats_performance_trend_max_10(client, user):
    """performance_trend zawiera max 10 ostatnich gier."""
    for i in range(15):
        room = _make_finished_room()
        Player.objects.create(room=room, user=user, nickname='StatsPlayer', score=i * 100)

    resp = client.get('/api/profile/stats/')
    assert resp.status_code == 200
    assert len(resp.data['performance_trend']) == 10


def test_stats_performance_trend_has_date_and_score(client, user):
    room = _make_finished_room()
    Player.objects.create(room=room, user=user, nickname='StatsPlayer', score=1500)

    resp = client.get('/api/profile/stats/')
    assert resp.status_code == 200
    assert len(resp.data['performance_trend']) == 1
    entry = resp.data['performance_trend'][0]
    assert 'date' in entry
    assert 'score' in entry
    assert entry['score'] == 1500


# ─── Auth ─────────────────────────────────────────────────────────────────────

def test_stats_requires_auth():
    c = APIClient()
    resp = c.get('/api/profile/stats/')
    assert resp.status_code == 403
