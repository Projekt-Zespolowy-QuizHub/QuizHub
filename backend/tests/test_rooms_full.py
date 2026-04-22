"""
Comprehensive room tests for QuizHub.

Covers: create room (classic/duel/survival/with pack), join room (valid, invalid code,
in-progress, duplicate nickname), room detail, room history, public next endpoint.
"""
import pytest
from django.test import Client
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile
from apps.rooms.models import Room, Player, QuestionPack


# ─── Fixtures ────────────────────────────────────────────────────────


@pytest.fixture
def host_client(db):
    user = User.objects.create_user('host@test.com', 'host@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='HostUser')
    client = Client()
    client.force_login(user)
    return client, user


@pytest.fixture
def guest_client(db):
    user = User.objects.create_user('guest@test.com', 'guest@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='GuestUser')
    client = Client()
    client.force_login(user)
    return client, user


@pytest.fixture
def lobby_room(db, host_client):
    """A room in lobby status with one host player."""
    client, user = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Historia'], 'total_rounds': 5},
        content_type='application/json',
    )
    assert resp.status_code == 201
    return Room.objects.get(code=resp.json()['room_code'])


# ─── Create room ─────────────────────────────────────────────────────


def test_create_room_classic_returns_201(host_client):
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Sport'], 'total_rounds': 10, 'game_mode': 'classic'},
        content_type='application/json',
    )
    assert resp.status_code == 201


def test_create_room_classic_has_room_code(host_client):
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Sport'], 'total_rounds': 10, 'game_mode': 'classic'},
        content_type='application/json',
    )
    assert 'room_code' in resp.json()


def test_create_room_classic_mode_stored(host_client):
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Historia'], 'total_rounds': 5, 'game_mode': 'classic'},
        content_type='application/json',
    )
    room = Room.objects.get(code=resp.json()['room_code'])
    assert room.game_mode == Room.GameMode.CLASSIC


def test_create_room_duel_mode_stored(host_client):
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Nauka'], 'total_rounds': 5, 'game_mode': 'duel'},
        content_type='application/json',
    )
    room = Room.objects.get(code=resp.json()['room_code'])
    assert room.game_mode == Room.GameMode.DUEL


def test_create_room_survival_mode_stored(host_client):
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Geografia'], 'total_rounds': 5, 'game_mode': 'survival'},
        content_type='application/json',
    )
    room = Room.objects.get(code=resp.json()['room_code'])
    assert room.game_mode == Room.GameMode.SURVIVAL


def test_create_room_default_game_mode_is_classic(host_client):
    """game_mode defaults to classic when not provided."""
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Sport'], 'total_rounds': 5},
        content_type='application/json',
    )
    room = Room.objects.get(code=resp.json()['room_code'])
    assert room.game_mode == Room.GameMode.CLASSIC


def test_create_room_host_player_created(host_client):
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Sport'], 'total_rounds': 5},
        content_type='application/json',
    )
    room = Room.objects.get(code=resp.json()['room_code'])
    assert room.players.count() == 1


def test_create_room_host_player_is_host_flag(host_client):
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Sport'], 'total_rounds': 5},
        content_type='application/json',
    )
    room = Room.objects.get(code=resp.json()['room_code'])
    assert room.players.first().is_host is True


def test_create_room_categories_stored(host_client):
    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': ['Historia', 'Nauka'], 'total_rounds': 10},
        content_type='application/json',
    )
    room = Room.objects.get(code=resp.json()['room_code'])
    assert room.categories == ['Historia', 'Nauka']


def test_create_room_with_pack_id(host_client):
    """Creating a room with a valid pack_id belonging to another user should succeed."""
    _, host_user = host_client
    # pack must be owned by a different user
    other_user = User.objects.create_user('packowner@test.com', 'packowner@test.com', 'pass1234')
    pack = QuestionPack.objects.create(name='My Pack', created_by=other_user, is_public=True)

    client, _ = host_client
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'HostUser', 'categories': [], 'total_rounds': 5, 'pack_id': pack.id},
        content_type='application/json',
    )
    assert resp.status_code == 201
    room = Room.objects.get(code=resp.json()['room_code'])
    assert room.pack_id == pack.id


@pytest.mark.django_db
def test_create_room_unauthenticated_returns_403():
    client = Client()
    resp = client.post(
        '/api/rooms/',
        {'host_nickname': 'Anon', 'categories': ['Sport'], 'total_rounds': 5},
        content_type='application/json',
    )
    assert resp.status_code == 403


# ─── Join room ───────────────────────────────────────────────────────


def test_join_room_valid_returns_201(host_client, guest_client, lobby_room):
    client, _ = guest_client
    resp = client.post(
        '/api/rooms/join/',
        {'nickname': 'GuestUser', 'room_code': lobby_room.code},
        content_type='application/json',
    )
    assert resp.status_code == 201


def test_join_room_valid_increments_player_count(host_client, guest_client, lobby_room):
    client, _ = guest_client
    client.post(
        '/api/rooms/join/',
        {'nickname': 'GuestUser', 'room_code': lobby_room.code},
        content_type='application/json',
    )
    assert lobby_room.players.count() == 2


def test_join_room_invalid_code_returns_404(guest_client):
    client, _ = guest_client
    resp = client.post(
        '/api/rooms/join/',
        {'nickname': 'GuestUser', 'room_code': 'XXXXXX'},
        content_type='application/json',
    )
    assert resp.status_code == 404


def test_join_room_in_progress_returns_400(host_client, guest_client, lobby_room):
    lobby_room.status = Room.Status.IN_PROGRESS
    lobby_room.save()

    client, _ = guest_client
    resp = client.post(
        '/api/rooms/join/',
        {'nickname': 'LatePlayer', 'room_code': lobby_room.code},
        content_type='application/json',
    )
    assert resp.status_code == 400


def test_join_room_finished_returns_400(host_client, guest_client, lobby_room):
    lobby_room.status = Room.Status.FINISHED
    lobby_room.save()

    client, _ = guest_client
    resp = client.post(
        '/api/rooms/join/',
        {'nickname': 'LatePlayer', 'room_code': lobby_room.code},
        content_type='application/json',
    )
    assert resp.status_code == 400


def test_join_room_duplicate_nickname_returns_409(host_client, guest_client, lobby_room):
    """The host's nickname is already 'HostUser'; trying to join with the same nick returns 409."""
    client, _ = guest_client
    resp = client.post(
        '/api/rooms/join/',
        {'nickname': 'HostUser', 'room_code': lobby_room.code},
        content_type='application/json',
    )
    assert resp.status_code == 409


# ─── Room detail ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_room_detail_returns_200():
    room = Room.objects.create(categories=['Historia'], total_rounds=10)
    Player.objects.create(room=room, nickname='Host', is_host=True)

    client = Client()
    resp = client.get(f'/api/rooms/{room.code}/')
    assert resp.status_code == 200


@pytest.mark.django_db
def test_room_detail_returns_correct_code():
    room = Room.objects.create(categories=['Historia'], total_rounds=10)
    Player.objects.create(room=room, nickname='Host', is_host=True)

    client = Client()
    resp = client.get(f'/api/rooms/{room.code}/')
    assert resp.json()['code'] == room.code


@pytest.mark.django_db
def test_room_detail_includes_players():
    room = Room.objects.create(categories=['Historia'], total_rounds=10)
    Player.objects.create(room=room, nickname='Host', is_host=True)
    Player.objects.create(room=room, nickname='Player2')

    client = Client()
    resp = client.get(f'/api/rooms/{room.code}/')
    assert len(resp.json()['players']) == 2


@pytest.mark.django_db
def test_room_detail_nonexistent_returns_404():
    client = Client()
    resp = client.get('/api/rooms/ZZZZZZ/')
    assert resp.status_code == 404


# ─── Room history ────────────────────────────────────────────────────


@pytest.mark.django_db
def test_room_history_returns_200():
    room = Room.objects.create(categories=['Sport'], total_rounds=5, status='finished')
    Player.objects.create(room=room, nickname='Host', is_host=True)

    client = Client()
    resp = client.get(f'/api/rooms/{room.code}/history/')
    assert resp.status_code == 200


@pytest.mark.django_db
def test_room_history_includes_room_code():
    room = Room.objects.create(categories=['Sport'], total_rounds=5, status='finished')
    Player.objects.create(room=room, nickname='Host', is_host=True)

    client = Client()
    resp = client.get(f'/api/rooms/{room.code}/history/')
    assert resp.json()['room_code'] == room.code


@pytest.mark.django_db
def test_room_history_includes_leaderboard():
    room = Room.objects.create(categories=['Sport'], total_rounds=5, status='finished')
    Player.objects.create(room=room, nickname='Host', is_host=True)

    client = Client()
    resp = client.get(f'/api/rooms/{room.code}/history/')
    assert 'leaderboard' in resp.json()


@pytest.mark.django_db
def test_room_history_nonexistent_returns_404():
    client = Client()
    resp = client.get('/api/rooms/ZZZZZZ/history/')
    assert resp.status_code == 404


# ─── Public next endpoint ────────────────────────────────────────────


@pytest.mark.django_db
def test_public_next_no_game_returns_404():
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


@pytest.mark.django_db
def test_public_next_with_future_game_returns_200():
    from django.utils import timezone
    from datetime import timedelta

    Room.objects.create(
        categories=['Sport', 'Muzyka'],
        is_public=True,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 200


@pytest.mark.django_db
def test_public_next_returns_room_id():
    from django.utils import timezone
    from datetime import timedelta

    Room.objects.create(
        categories=['Sport'],
        is_public=True,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert 'room_id' in resp.json()


@pytest.mark.django_db
def test_public_next_returns_start_time():
    from django.utils import timezone
    from datetime import timedelta

    Room.objects.create(
        categories=['Sport'],
        is_public=True,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert 'start_time' in resp.json()


@pytest.mark.django_db
def test_public_next_excludes_past_games():
    """A public game scheduled in the past should not be returned."""
    from django.utils import timezone
    from datetime import timedelta

    Room.objects.create(
        categories=['Sport'],
        is_public=True,
        scheduled_at=timezone.now() - timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


@pytest.mark.django_db
def test_public_next_excludes_in_progress_games():
    """A public game already in-progress should not be returned by the next endpoint."""
    from django.utils import timezone
    from datetime import timedelta

    Room.objects.create(
        categories=['Sport'],
        is_public=True,
        status=Room.Status.IN_PROGRESS,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404
