"""
Testy turniejów publicznych.

Pokrycie:
- PublicTournamentConfig: singleton get/create
- GET /api/rooms/public/next/ — zwraca następną publiczną grę
- GET /api/rooms/public/next/ — 404 gdy brak zaplanowanej gry
- Dane odpowiedzi: room_id, start_time, player_count, max_players, seconds_until_start
"""
import pytest
from django.test import Client
from django.utils import timezone
from datetime import timedelta
from apps.rooms.models import Room, PublicTournamentConfig, Player


@pytest.fixture(autouse=True)
def reset_config(db):
    # Usuń singleton jeśli istnieje, żeby każdy test startował z czystą konfiguracją
    PublicTournamentConfig.objects.all().delete()


# ─── PublicTournamentConfig singleton ────────────────────────────────────────

def test_config_get_creates_default(db):
    config = PublicTournamentConfig.get()
    assert config.pk == 1
    assert config.interval_minutes == 30
    assert config.max_players == 16
    assert config.is_enabled is True


def test_config_get_is_idempotent(db):
    c1 = PublicTournamentConfig.get()
    c2 = PublicTournamentConfig.get()
    assert c1.pk == c2.pk


def test_config_fields_persisted(db):
    config = PublicTournamentConfig.get()
    config.interval_minutes = 60
    config.max_players = 8
    config.save()

    fresh = PublicTournamentConfig.get()
    assert fresh.interval_minutes == 60
    assert fresh.max_players == 8


# ─── Next public game ─────────────────────────────────────────────────────────

def test_next_public_game_returns_404_when_none(db):
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_public_game_returns_scheduled_game(db):
    Room.objects.create(
        categories=['Historia', 'Sport', 'Muzyka'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=10),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 200
    data = resp.json()
    assert 'room_id' in data
    assert 'start_time' in data
    assert 'player_count' in data
    assert 'max_players' in data
    assert 'seconds_until_start' in data
    assert 'categories' in data


def test_next_public_game_excludes_past_games(db):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() - timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_public_game_excludes_non_lobby(db):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.IN_PROGRESS,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_public_game_excludes_private(db):
    Room.objects.create(
        categories=['Historia'],
        is_public=False,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404


def test_next_public_game_returns_earliest(db):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=30),
    )
    earlier = Room.objects.create(
        categories=['Sport'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 200
    assert resp.json()['room_id'] == earlier.code


def test_next_public_game_includes_player_count(db):
    room = Room.objects.create(
        categories=['Nauka'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    Player.objects.create(room=room, nickname='A')
    Player.objects.create(room=room, nickname='B')

    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.json()['player_count'] == 2


def test_next_public_game_seconds_until_start_is_positive(db):
    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.json()['seconds_until_start'] > 0


def test_next_public_game_returns_max_players_from_config(db):
    config = PublicTournamentConfig.get()
    config.max_players = 8
    config.save()

    Room.objects.create(
        categories=['Historia'],
        is_public=True,
        status=Room.Status.LOBBY,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.json()['max_players'] == 8
