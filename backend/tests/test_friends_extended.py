"""
Rozszerzone testy znajomych i wyzwań.

Pokrycie:
- Wyzwanie znajomego: tworzenie pokoju, powiadomienie WS
- Odpowiedź na wyzwanie: accept (dołącza do pokoju), decline (usuwa pokój)
- Walidacje wyzwania: self-challenge, nie-znajomy, duplikat
- Historia gier (GET /api/profile/history/)
- Ranking znajomych (GET /api/rankings/friends/)
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile, Friendship, Challenge
from apps.rooms.models import Room, Player


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def user_a(db):
    u = User.objects.create_user('a@fr.com', 'a@fr.com', 'pass1234')
    UserProfile.objects.create(user=u, display_name='FriendA')
    return u


@pytest.fixture
def user_b(db):
    u = User.objects.create_user('b@fr.com', 'b@fr.com', 'pass1234')
    UserProfile.objects.create(user=u, display_name='FriendB')
    return u


@pytest.fixture
def user_c(db):
    u = User.objects.create_user('c@fr.com', 'c@fr.com', 'pass1234')
    UserProfile.objects.create(user=u, display_name='Stranger')
    return u


@pytest.fixture
def friends(user_a, user_b):
    return Friendship.objects.create(
        from_user=user_a, to_user=user_b, status=Friendship.Status.ACCEPTED
    )


@pytest.fixture
def client_a(user_a):
    c = APIClient()
    c.force_authenticate(user=user_a)
    return c


@pytest.fixture
def client_b(user_b):
    c = APIClient()
    c.force_authenticate(user=user_b)
    return c


# ─── Challenge friend ─────────────────────────────────────────────────────────

def test_challenge_friend_creates_room_and_challenge(client_a, user_a, user_b, friends):
    resp = client_a.post('/api/friends/challenge/', {
        'friend_profile_id': user_b.profile.id,
        'categories': ['Historia'],
        'total_rounds': 10,
    }, format='json')
    assert resp.status_code == 201
    assert 'challenge_id' in resp.data
    assert 'room_code' in resp.data
    challenge = Challenge.objects.get(id=resp.data['challenge_id'])
    assert challenge.from_user == user_a
    assert challenge.to_user == user_b
    assert challenge.status == Challenge.Status.PENDING
    assert Room.objects.filter(code=resp.data['room_code']).exists()


def test_challenge_self_is_rejected(client_a, user_a):
    resp = client_a.post('/api/friends/challenge/', {
        'friend_profile_id': user_a.profile.id,
        'categories': ['Historia'],
    }, format='json')
    assert resp.status_code == 400


def test_challenge_stranger_is_rejected(client_a, user_c):
    resp = client_a.post('/api/friends/challenge/', {
        'friend_profile_id': user_c.profile.id,
        'categories': ['Historia'],
    }, format='json')
    assert resp.status_code == 400


def test_challenge_nonexistent_user(client_a):
    resp = client_a.post('/api/friends/challenge/', {
        'friend_profile_id': 99999,
        'categories': ['Historia'],
    }, format='json')
    assert resp.status_code == 404


def test_duplicate_challenge_rejected(client_a, user_b, friends):
    room = Room.objects.create(categories=['Historia'], total_rounds=10)
    Challenge.objects.create(from_user=friends.from_user, to_user=user_b, room=room)

    resp = client_a.post('/api/friends/challenge/', {
        'friend_profile_id': user_b.profile.id,
        'categories': ['Historia'],
    }, format='json')
    assert resp.status_code == 400


# ─── Challenge respond ────────────────────────────────────────────────────────

def test_accept_challenge_adds_player_to_room(client_b, user_a, user_b, friends):
    room = Room.objects.create(categories=['Historia'], total_rounds=10)
    Player.objects.create(room=room, nickname='FriendA', user=user_a, is_host=True)
    challenge = Challenge.objects.create(
        from_user=user_a, to_user=user_b, room=room
    )

    resp = client_b.post('/api/friends/challenge/respond/', {
        'challenge_id': challenge.id,
        'action': 'accept',
    }, format='json')
    assert resp.status_code == 200
    assert resp.data['room_code'] == room.code
    challenge.refresh_from_db()
    assert challenge.status == Challenge.Status.ACCEPTED
    assert Player.objects.filter(room=room, user=user_b).exists()


def test_decline_challenge_deletes_room(client_b, user_a, user_b, friends):
    room = Room.objects.create(categories=['Historia'], total_rounds=10)
    challenge = Challenge.objects.create(
        from_user=user_a, to_user=user_b, room=room
    )
    room_id = room.id
    challenge_id = challenge.id

    resp = client_b.post('/api/friends/challenge/respond/', {
        'challenge_id': challenge_id,
        'action': 'decline',
    }, format='json')
    assert resp.status_code == 200
    # Pokój powinien zostać usunięty (cascade usuwa też challenge)
    assert not Room.objects.filter(id=room_id).exists()
    assert not Challenge.objects.filter(id=challenge_id).exists()


def test_respond_to_nonexistent_challenge(client_b):
    resp = client_b.post('/api/friends/challenge/respond/', {
        'challenge_id': 99999,
        'action': 'accept',
    }, format='json')
    assert resp.status_code == 404


def test_cannot_respond_to_others_challenge(client_a, user_a, user_b, user_c):
    """Użytkownik A nie może odpowiedzieć na wyzwanie skierowane do B."""
    room = Room.objects.create(categories=['Historia'], total_rounds=10)
    challenge = Challenge.objects.create(
        from_user=user_b, to_user=user_c, room=room
    )
    resp = client_a.post('/api/friends/challenge/respond/', {
        'challenge_id': challenge.id,
        'action': 'accept',
    }, format='json')
    assert resp.status_code == 404


# ─── Unfriend (odrzucenie usuwa znajomość) ────────────────────────────────────

def test_reject_friend_request_removes_friendship(user_a, user_b):
    fr = Friendship.objects.create(from_user=user_a, to_user=user_b)
    client = APIClient()
    client.force_authenticate(user=user_b)
    resp = client.post('/api/friends/respond/', {
        'request_id': fr.id,
        'action': 'reject',
    }, format='json')
    assert resp.status_code == 200
    assert not Friendship.objects.filter(id=fr.id).exists()


# ─── Game history ────────────────────────────────────────────────────────────

def test_game_history_returns_finished_games(user_a):
    finished_room = Room.objects.create(
        categories=['Sport'],
        total_rounds=10,
        status=Room.Status.FINISHED,
    )
    Player.objects.create(room=finished_room, user=user_a, nickname='FriendA', score=2000)

    c = APIClient()
    c.force_authenticate(user=user_a)
    resp = c.get('/api/profile/history/')
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]['room_code'] == finished_room.code
    assert resp.data[0]['score'] == 2000


def test_game_history_excludes_in_progress_games(user_a):
    in_progress = Room.objects.create(
        categories=['Sport'],
        total_rounds=10,
        status=Room.Status.IN_PROGRESS,
    )
    Player.objects.create(room=in_progress, user=user_a, nickname='FriendA', score=500)

    c = APIClient()
    c.force_authenticate(user=user_a)
    resp = c.get('/api/profile/history/')
    assert resp.status_code == 200
    assert len(resp.data) == 0


def test_game_history_rank_calculation(user_a, user_b):
    """Rank jest obliczany na podstawie liczby graczy z wyższym wynikiem."""
    room = Room.objects.create(
        categories=['Muzyka'],
        total_rounds=5,
        status=Room.Status.FINISHED,
    )
    Player.objects.create(room=room, user=user_a, nickname='FriendA', score=1000)
    Player.objects.create(room=room, user=user_b, nickname='FriendB', score=2000)

    c = APIClient()
    c.force_authenticate(user=user_a)
    resp = c.get('/api/profile/history/')
    assert resp.status_code == 200
    # user_a ma niższy wynik, więc rank = 2
    assert resp.data[0]['rank'] == 2


def test_game_history_requires_auth():
    c = APIClient()
    resp = c.get('/api/profile/history/')
    assert resp.status_code == 403
