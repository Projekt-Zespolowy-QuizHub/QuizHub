"""
Testy endpointów administracyjnych.

Pokrycie:
- GET /api/tournaments/config/ — dostępny dla wszystkich
- PATCH /api/tournaments/config/ — wymaga is_staff
- POST /api/tournaments/trigger/ — wymaga is_staff
- Walidacja wartości konfiguracji (interval_minutes >= 1, max_players >= 2)
- Admin może aktualizować poszczególne pola
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile
from apps.rooms.models import PublicTournamentConfig, Room


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def staff_user(db):
    u = User.objects.create_user('admin@test.com', 'admin@test.com', 'pass1234')
    u.is_staff = True
    u.save()
    UserProfile.objects.create(user=u, display_name='AdminUser')
    return u


@pytest.fixture
def regular_user(db):
    u = User.objects.create_user('regular@test.com', 'regular@test.com', 'pass1234')
    UserProfile.objects.create(user=u, display_name='RegularUser')
    return u


@pytest.fixture
def staff_client(staff_user):
    c = APIClient()
    c.force_authenticate(user=staff_user)
    return c


@pytest.fixture
def regular_client(regular_user):
    c = APIClient()
    c.force_authenticate(user=regular_user)
    return c


# ─── GET /api/tournaments/config/ ────────────────────────────────────────────

def test_get_tournament_config_anonymous(db):
    c = APIClient()
    resp = c.get('/api/tournaments/config/')
    assert resp.status_code == 200
    assert 'interval_minutes' in resp.data
    assert 'max_players' in resp.data
    assert 'is_enabled' in resp.data


def test_get_tournament_config_default_values(db):
    resp = APIClient().get('/api/tournaments/config/')
    assert resp.data['interval_minutes'] == 30
    assert resp.data['max_players'] == 16
    assert resp.data['is_enabled'] is True


def test_get_tournament_config_regular_user(regular_client):
    resp = regular_client.get('/api/tournaments/config/')
    assert resp.status_code == 200


# ─── PATCH /api/tournaments/config/ ──────────────────────────────────────────

def test_patch_config_requires_staff(regular_client):
    resp = regular_client.patch('/api/tournaments/config/', {
        'interval_minutes': 60
    }, format='json')
    assert resp.status_code == 403


def test_patch_config_requires_auth(db):
    c = APIClient()
    resp = c.patch('/api/tournaments/config/', {
        'interval_minutes': 60
    }, format='json')
    # Może być 403 (IsAuthenticated fail) lub 403 (is_staff check) — zależy od middleware
    assert resp.status_code in (401, 403)


def test_patch_config_update_interval_minutes(staff_client):
    resp = staff_client.patch('/api/tournaments/config/', {
        'interval_minutes': 45
    }, format='json')
    assert resp.status_code == 200
    assert resp.data['interval_minutes'] == 45
    config = PublicTournamentConfig.get()
    assert config.interval_minutes == 45


def test_patch_config_update_max_players(staff_client):
    resp = staff_client.patch('/api/tournaments/config/', {
        'max_players': 32
    }, format='json')
    assert resp.status_code == 200
    assert resp.data['max_players'] == 32


def test_patch_config_disable_tournaments(staff_client):
    resp = staff_client.patch('/api/tournaments/config/', {
        'is_enabled': False
    }, format='json')
    assert resp.status_code == 200
    assert resp.data['is_enabled'] is False


def test_patch_config_interval_must_be_at_least_1(staff_client):
    resp = staff_client.patch('/api/tournaments/config/', {
        'interval_minutes': 0
    }, format='json')
    assert resp.status_code == 400


def test_patch_config_max_players_must_be_at_least_2(staff_client):
    resp = staff_client.patch('/api/tournaments/config/', {
        'max_players': 1
    }, format='json')
    assert resp.status_code == 400


def test_patch_config_partial_update_preserves_other_fields(staff_client):
    """Aktualizacja jednego pola nie nadpisuje pozostałych."""
    # Ustaw initial
    staff_client.patch('/api/tournaments/config/', {
        'interval_minutes': 60, 'max_players': 20, 'is_enabled': True
    }, format='json')
    # Aktualizuj tylko interval
    staff_client.patch('/api/tournaments/config/', {
        'interval_minutes': 15
    }, format='json')
    config = PublicTournamentConfig.get()
    assert config.interval_minutes == 15
    assert config.max_players == 20
    assert config.is_enabled is True


# ─── POST /api/tournaments/trigger/ ─────────────────────────────────────────

def test_trigger_tournament_requires_staff(regular_client):
    resp = regular_client.post('/api/tournaments/trigger/')
    assert resp.status_code == 403


def test_trigger_tournament_creates_public_room(staff_client):
    initial_count = Room.objects.filter(is_public=True).count()
    resp = staff_client.post('/api/tournaments/trigger/')
    assert resp.status_code == 201
    assert 'room_id' in resp.data
    assert 'start_time' in resp.data
    assert Room.objects.filter(is_public=True).count() == initial_count + 1


def test_trigger_tournament_room_has_scheduled_at(staff_client):
    from django.utils import timezone
    resp = staff_client.post('/api/tournaments/trigger/')
    assert resp.status_code == 201
    room = Room.objects.get(code=resp.data['room_id'])
    assert room.scheduled_at is not None
    assert room.scheduled_at > timezone.now()


def test_trigger_tournament_room_is_lobby(staff_client):
    resp = staff_client.post('/api/tournaments/trigger/')
    room = Room.objects.get(code=resp.data['room_id'])
    assert room.status == Room.Status.LOBBY


def test_trigger_tournament_room_has_categories(staff_client):
    resp = staff_client.post('/api/tournaments/trigger/')
    room = Room.objects.get(code=resp.data['room_id'])
    assert len(room.categories) == 3
