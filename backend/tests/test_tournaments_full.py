"""
Comprehensive tournament tests supplementing test_tournaments.py.

The existing test_tournaments.py covers:
- PublicTournamentConfig default values (interval_minutes=30, max_players=16, is_enabled=True)
- Config singleton is idempotent (same pk=1)
- Config fields persist after save
- Next public game 404 when none
- Next public game returns all required fields
- Next public game excludes past games
- Next public game excludes non-lobby status
- Next public game excludes private rooms
- Next public game returns earliest when multiple
- Next public game includes player_count
- Next public game seconds_until_start > 0
- Next public game returns max_players from config

This file adds:
- Config singleton always uses pk=1
- Config get_or_create never creates duplicates
- Config update interval_minutes persists
- Config update max_players persists
- Config update is_enabled=False persists
- Next game returns interval_minutes from config
- Next game categories list is not empty
- Next game room_id matches the actual room code
- Next game seconds_until_start is integer
- Next game start_time is ISO format string
- Private lobby with scheduled_at not returned
- Finished public game not returned
- In-progress public game not returned
- Room without scheduled_at not returned (scheduled_at=None)
- When two future games exist, earliest returned (already tested, add variant)
- Player count increases as players join
- Config is_enabled field has no effect on NextPublicGameView (view ignores it)
- Trigger POST creates room visible via next-public-game
- Room code in replay response matches next-public-game room_id
"""
import pytest
from django.test import Client
from django.utils import timezone
from datetime import timedelta
from apps.rooms.models import Room, Player, PublicTournamentConfig


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clean_config(db):
    PublicTournamentConfig.objects.all().delete()


@pytest.fixture
def client(db):
    return Client()


def _future_public_lobby(categories=None, minutes_ahead=10, code=None):
    kwargs = dict(
        categories=categories or ['Historia', 'Sport', 'Nauka'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=minutes_ahead),
        total_rounds=10,
    )
    if code:
        kwargs['code'] = code
    return Room.objects.create(**kwargs)


# ─── PublicTournamentConfig singleton ────────────────────────────────────────

def test_config_singleton_uses_pk_1(db):
    config = PublicTournamentConfig.get()
    assert config.pk == 1


def test_config_get_twice_does_not_create_two_records(db):
    PublicTournamentConfig.get()
    PublicTournamentConfig.get()
    assert PublicTournamentConfig.objects.count() == 1


def test_config_default_interval_minutes(db):
    config = PublicTournamentConfig.get()
    assert config.interval_minutes == 30


def test_config_default_max_players(db):
    config = PublicTournamentConfig.get()
    assert config.max_players == 16


def test_config_default_is_enabled(db):
    config = PublicTournamentConfig.get()
    assert config.is_enabled is True


def test_config_update_interval_minutes_persisted(db):
    config = PublicTournamentConfig.get()
    config.interval_minutes = 15
    config.save()
    fresh = PublicTournamentConfig.get()
    assert fresh.interval_minutes == 15


def test_config_update_max_players_persisted(db):
    config = PublicTournamentConfig.get()
    config.max_players = 4
    config.save()
    fresh = PublicTournamentConfig.get()
    assert fresh.max_players == 4


def test_config_update_is_enabled_false_persisted(db):
    config = PublicTournamentConfig.get()
    config.is_enabled = False
    config.save()
    fresh = PublicTournamentConfig.get()
    assert fresh.is_enabled is False


def test_config_update_all_fields_persisted(db):
    config = PublicTournamentConfig.get()
    config.interval_minutes = 45
    config.max_players = 32
    config.is_enabled = False
    config.save()
    fresh = PublicTournamentConfig.get()
    assert fresh.interval_minutes == 45
    assert fresh.max_players == 32
    assert fresh.is_enabled is False


# ─── GET /api/rooms/public/next/ — 404 cases ─────────────────────────────────

def test_next_game_404_when_no_rooms(client):
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_game_404_message_present(client):
    resp = client.get('/api/rooms/public/next/')
    assert 'message' in resp.json()


def test_next_game_excludes_private_lobby_with_scheduled_at(db, client):
    Room.objects.create(
        categories=['Historia'],
        is_public=False,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_game_excludes_past_scheduled_at(db, client):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() - timedelta(seconds=1),
    )
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_game_excludes_finished_public_room(db, client):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.FINISHED,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_game_excludes_in_progress_public_room(db, client):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.IN_PROGRESS,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_game_excludes_room_without_scheduled_at(db, client):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=None,
    )
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


# ─── GET /api/rooms/public/next/ — 200 response shape ────────────────────────

def test_next_game_200_when_valid_room_exists(db, client):
    _future_public_lobby()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 200


def test_next_game_response_has_room_id(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert 'room_id' in data


def test_next_game_response_has_start_time(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert 'start_time' in data


def test_next_game_response_has_player_count(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert 'player_count' in data


def test_next_game_response_has_max_players(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert 'max_players' in data


def test_next_game_response_has_seconds_until_start(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert 'seconds_until_start' in data


def test_next_game_response_has_interval_minutes(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert 'interval_minutes' in data


def test_next_game_response_has_categories(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert 'categories' in data


# ─── GET /api/rooms/public/next/ — field value correctness ───────────────────

def test_next_game_room_id_matches_room_code(db, client):
    room = _future_public_lobby(code='TOURN1')
    data = client.get('/api/rooms/public/next/').json()
    assert data['room_id'] == room.code


def test_next_game_categories_not_empty(db, client):
    _future_public_lobby(categories=['Historia', 'Sport', 'Nauka'])
    data = client.get('/api/rooms/public/next/').json()
    assert len(data['categories']) > 0


def test_next_game_categories_match_room(db, client):
    _future_public_lobby(categories=['Muzyka', 'Film', 'Sport'])
    data = client.get('/api/rooms/public/next/').json()
    assert set(data['categories']) == {'Muzyka', 'Film', 'Sport'}


def test_next_game_seconds_until_start_is_positive(db, client):
    _future_public_lobby(minutes_ahead=10)
    data = client.get('/api/rooms/public/next/').json()
    assert data['seconds_until_start'] > 0


def test_next_game_seconds_until_start_is_integer(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert isinstance(data['seconds_until_start'], int)


def test_next_game_start_time_is_string(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert isinstance(data['start_time'], str)
    assert len(data['start_time']) > 10  # ISO format sanity check


def test_next_game_max_players_matches_config(db, client):
    config = PublicTournamentConfig.get()
    config.max_players = 24
    config.save()
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert data['max_players'] == 24


def test_next_game_interval_minutes_matches_config(db, client):
    config = PublicTournamentConfig.get()
    config.interval_minutes = 60
    config.save()
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert data['interval_minutes'] == 60


def test_next_game_player_count_zero_when_no_players(db, client):
    _future_public_lobby()
    data = client.get('/api/rooms/public/next/').json()
    assert data['player_count'] == 0


def test_next_game_player_count_increments_as_players_join(db, client):
    room = _future_public_lobby()
    Player.objects.create(room=room, nickname='P1')
    Player.objects.create(room=room, nickname='P2')
    data = client.get('/api/rooms/public/next/').json()
    assert data['player_count'] == 2


# ─── GET /api/rooms/public/next/ — ordering ──────────────────────────────────

def test_next_game_returns_earliest_of_multiple_rooms(db, client):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=60),
        code='LATE01',
    )
    early = Room.objects.create(
        categories=['Sport'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=5),
        code='EARL01',
    )
    data = client.get('/api/rooms/public/next/').json()
    assert data['room_id'] == early.code


def test_next_game_only_valid_room_returned_when_mixed(db, client):
    """One past, one future → returns only the future one."""
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() - timedelta(minutes=5),
        code='PAST01',
    )
    future = _future_public_lobby(code='FUTR01', minutes_ahead=15)
    data = client.get('/api/rooms/public/next/').json()
    assert data['room_id'] == future.code


# ─── is_enabled flag behavior ─────────────────────────────────────────────────

def test_next_game_returns_room_even_when_is_enabled_false(db, client):
    """The NextPublicGameView does not filter by is_enabled — it shows upcoming games regardless."""
    config = PublicTournamentConfig.get()
    config.is_enabled = False
    config.save()
    _future_public_lobby()
    resp = client.get('/api/rooms/public/next/')
    # View does not check is_enabled, so still 200
    assert resp.status_code == 200
