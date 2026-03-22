"""
Comprehensive tests for admin-required endpoints.

The existing test_admin_api.py covers the basic PATCH config and trigger flow.
This file adds deeper coverage:

Tournament config (GET/PATCH /api/tournaments/config/):
- GET is publicly accessible (no auth required)
- GET returns correct field names
- GET is idempotent (same singleton returned)
- PATCH by anonymous user returns 401 or 403
- PATCH by regular authenticated user returns 403
- PATCH by staff user returns 200
- PATCH only interval_minutes
- PATCH only max_players
- PATCH only is_enabled
- PATCH partial update leaves other fields unchanged
- PATCH with interval_minutes=0 returns 400
- PATCH with interval_minutes=-5 returns 400
- PATCH with max_players=1 returns 400
- PATCH with max_players=0 returns 400
- After PATCH, GET reflects updated values

Tournament trigger (POST /api/tournaments/trigger/):
- POST by anonymous returns 403
- POST by regular user returns 403
- POST by staff returns 201
- POST response contains room_id and start_time
- POST creates a Room with is_public=True
- POST created room has LOBBY status
- POST created room has scheduled_at in the future
- POST created room has exactly 3 categories
- POST created room has total_rounds=10
- Multiple triggers create multiple distinct rooms
"""
import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile
from apps.rooms.models import PublicTournamentConfig, Room


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clean_config(db):
    """Ensure each test starts with a fresh config singleton."""
    PublicTournamentConfig.objects.all().delete()


@pytest.fixture
def admin_user(db):
    user = User.objects.create_user('admin@full-admin.com', 'admin@full-admin.com', 'adminpass')
    user.is_staff = True
    user.save()
    UserProfile.objects.create(user=user, display_name='AdminUser')
    return user


@pytest.fixture
def regular_user(db):
    user = User.objects.create_user('user@full-admin.com', 'user@full-admin.com', 'userpass')
    UserProfile.objects.create(user=user, display_name='RegularUser')
    return user


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.fixture
def regular_client(regular_user):
    c = APIClient()
    c.force_authenticate(user=regular_user)
    return c


@pytest.fixture
def anon_client():
    return APIClient()


# ─── GET /api/tournaments/config/ ────────────────────────────────────────────

def test_config_get_anonymous_returns_200(anon_client):
    resp = anon_client.get('/api/tournaments/config/')
    assert resp.status_code == 200


def test_config_get_regular_user_returns_200(regular_client):
    resp = regular_client.get('/api/tournaments/config/')
    assert resp.status_code == 200


def test_config_get_admin_returns_200(admin_client):
    resp = admin_client.get('/api/tournaments/config/')
    assert resp.status_code == 200


def test_config_get_returns_interval_minutes(anon_client):
    resp = anon_client.get('/api/tournaments/config/')
    assert 'interval_minutes' in resp.data


def test_config_get_returns_max_players(anon_client):
    resp = anon_client.get('/api/tournaments/config/')
    assert 'max_players' in resp.data


def test_config_get_returns_is_enabled(anon_client):
    resp = anon_client.get('/api/tournaments/config/')
    assert 'is_enabled' in resp.data


def test_config_get_default_interval_minutes(anon_client):
    resp = anon_client.get('/api/tournaments/config/')
    assert resp.data['interval_minutes'] == 30


def test_config_get_default_max_players(anon_client):
    resp = anon_client.get('/api/tournaments/config/')
    assert resp.data['max_players'] == 16


def test_config_get_default_is_enabled(anon_client):
    resp = anon_client.get('/api/tournaments/config/')
    assert resp.data['is_enabled'] is True


def test_config_get_is_idempotent(anon_client):
    resp1 = anon_client.get('/api/tournaments/config/')
    resp2 = anon_client.get('/api/tournaments/config/')
    assert resp1.data['interval_minutes'] == resp2.data['interval_minutes']
    assert resp1.data['max_players'] == resp2.data['max_players']
    assert resp1.data['is_enabled'] == resp2.data['is_enabled']
    # Singleton stays pk=1
    assert PublicTournamentConfig.objects.count() == 1


def test_config_get_reflects_updated_values(admin_client, anon_client):
    admin_client.patch('/api/tournaments/config/', {
        'interval_minutes': 45,
        'max_players': 32,
        'is_enabled': False,
    }, format='json')
    resp = anon_client.get('/api/tournaments/config/')
    assert resp.data['interval_minutes'] == 45
    assert resp.data['max_players'] == 32
    assert resp.data['is_enabled'] is False


# ─── PATCH /api/tournaments/config/ — access control ─────────────────────────

def test_config_patch_by_anonymous_returns_403_or_401(anon_client):
    resp = anon_client.patch('/api/tournaments/config/', {'interval_minutes': 60}, format='json')
    assert resp.status_code in (401, 403)


def test_config_patch_by_regular_user_returns_403(regular_client):
    resp = regular_client.patch('/api/tournaments/config/', {'interval_minutes': 60}, format='json')
    assert resp.status_code == 403


def test_config_patch_by_staff_returns_200(admin_client):
    resp = admin_client.patch('/api/tournaments/config/', {'interval_minutes': 60}, format='json')
    assert resp.status_code == 200


# ─── PATCH /api/tournaments/config/ — field updates ──────────────────────────

def test_config_patch_interval_minutes_only(admin_client):
    resp = admin_client.patch('/api/tournaments/config/', {'interval_minutes': 45}, format='json')
    assert resp.status_code == 200
    assert resp.data['interval_minutes'] == 45
    # Other defaults unchanged
    assert resp.data['max_players'] == 16
    assert resp.data['is_enabled'] is True


def test_config_patch_max_players_only(admin_client):
    resp = admin_client.patch('/api/tournaments/config/', {'max_players': 8}, format='json')
    assert resp.status_code == 200
    assert resp.data['max_players'] == 8
    assert resp.data['interval_minutes'] == 30


def test_config_patch_is_enabled_false(admin_client):
    resp = admin_client.patch('/api/tournaments/config/', {'is_enabled': False}, format='json')
    assert resp.status_code == 200
    assert resp.data['is_enabled'] is False


def test_config_patch_is_enabled_true(admin_client):
    # Disable first, then re-enable
    admin_client.patch('/api/tournaments/config/', {'is_enabled': False}, format='json')
    resp = admin_client.patch('/api/tournaments/config/', {'is_enabled': True}, format='json')
    assert resp.status_code == 200
    assert resp.data['is_enabled'] is True


def test_config_patch_persisted_to_db(admin_client):
    admin_client.patch('/api/tournaments/config/', {
        'interval_minutes': 20,
        'max_players': 12,
    }, format='json')
    config = PublicTournamentConfig.get()
    assert config.interval_minutes == 20
    assert config.max_players == 12


def test_config_patch_partial_update_preserves_other_fields(admin_client):
    # Set all fields
    admin_client.patch('/api/tournaments/config/', {
        'interval_minutes': 60,
        'max_players': 20,
        'is_enabled': True,
    }, format='json')
    # Update only one
    admin_client.patch('/api/tournaments/config/', {'interval_minutes': 15}, format='json')
    config = PublicTournamentConfig.get()
    assert config.interval_minutes == 15
    assert config.max_players == 20
    assert config.is_enabled is True


# ─── PATCH /api/tournaments/config/ — validation ─────────────────────────────

def test_config_patch_interval_minutes_zero_returns_400(admin_client):
    resp = admin_client.patch('/api/tournaments/config/', {'interval_minutes': 0}, format='json')
    assert resp.status_code == 400


def test_config_patch_interval_minutes_negative_returns_400(admin_client):
    resp = admin_client.patch('/api/tournaments/config/', {'interval_minutes': -5}, format='json')
    assert resp.status_code == 400


def test_config_patch_max_players_one_returns_400(admin_client):
    resp = admin_client.patch('/api/tournaments/config/', {'max_players': 1}, format='json')
    assert resp.status_code == 400


def test_config_patch_max_players_zero_returns_400(admin_client):
    resp = admin_client.patch('/api/tournaments/config/', {'max_players': 0}, format='json')
    assert resp.status_code == 400


def test_config_patch_validation_error_does_not_change_config(admin_client):
    # Set a known state
    admin_client.patch('/api/tournaments/config/', {'interval_minutes': 30}, format='json')
    # Try invalid update
    admin_client.patch('/api/tournaments/config/', {'interval_minutes': 0}, format='json')
    config = PublicTournamentConfig.get()
    assert config.interval_minutes == 30


# ─── POST /api/tournaments/trigger/ — access control ─────────────────────────

def test_trigger_by_anonymous_returns_403(anon_client):
    resp = anon_client.post('/api/tournaments/trigger/')
    assert resp.status_code == 403


def test_trigger_by_regular_user_returns_403(regular_client):
    resp = regular_client.post('/api/tournaments/trigger/')
    assert resp.status_code == 403


def test_trigger_by_staff_returns_201(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    assert resp.status_code == 201


# ─── POST /api/tournaments/trigger/ — response shape ─────────────────────────

def test_trigger_response_contains_room_id(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    assert 'room_id' in resp.data


def test_trigger_response_contains_start_time(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    assert 'start_time' in resp.data


def test_trigger_response_room_id_is_string(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    assert isinstance(resp.data['room_id'], str)
    assert len(resp.data['room_id']) > 0


# ─── POST /api/tournaments/trigger/ — created room properties ────────────────

def test_trigger_creates_public_room(admin_client):
    before = Room.objects.filter(is_public=True).count()
    admin_client.post('/api/tournaments/trigger/')
    after = Room.objects.filter(is_public=True).count()
    assert after == before + 1


def test_trigger_room_has_lobby_status(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    room = Room.objects.get(code=resp.data['room_id'])
    assert room.status == Room.Status.LOBBY


def test_trigger_room_scheduled_at_is_in_future(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    room = Room.objects.get(code=resp.data['room_id'])
    assert room.scheduled_at is not None
    assert room.scheduled_at > timezone.now()


def test_trigger_room_has_exactly_3_categories(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    room = Room.objects.get(code=resp.data['room_id'])
    assert isinstance(room.categories, list)
    assert len(room.categories) == 3


def test_trigger_room_has_total_rounds_10(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    room = Room.objects.get(code=resp.data['room_id'])
    assert room.total_rounds == 10


def test_trigger_room_is_public_flag(admin_client):
    resp = admin_client.post('/api/tournaments/trigger/')
    room = Room.objects.get(code=resp.data['room_id'])
    assert room.is_public is True


def test_trigger_multiple_times_creates_distinct_rooms(admin_client):
    resp1 = admin_client.post('/api/tournaments/trigger/')
    resp2 = admin_client.post('/api/tournaments/trigger/')
    assert resp1.status_code == 201
    assert resp2.status_code == 201
    assert resp1.data['room_id'] != resp2.data['room_id']
    assert Room.objects.filter(is_public=True).count() >= 2


def test_trigger_room_appears_in_next_public_game(admin_client, anon_client):
    """After triggering, the next-public-game endpoint should find the new room."""
    admin_client.post('/api/tournaments/trigger/')
    resp = anon_client.get('/api/rooms/public/next/')
    assert resp.status_code == 200
    assert 'room_id' in resp.data
