"""
Testy zarządzania kontem użytkownika.

Pokrycie:
- Zmiana avatara: poprawny klucz, niepoprawny klucz, niezalogowany
- Profil: GET /api/auth/me/ zwraca poprawne dane
- Rejestracja: duplikat emaila, duplikat display_name
- Logowanie: złe hasło, niezarejestrowany email
- Wylogowanie kończy sesję
"""
import pytest
from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile, AVATAR_CHOICES


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Czyści cache przed każdym testem, żeby throttle nie blokował testów."""
    cache.clear()
    yield
    cache.clear()

@pytest.fixture
def user(db):
    u = User.objects.create_user('mgmt@test.com', 'mgmt@test.com', 'pass1234')
    UserProfile.objects.create(user=u, display_name='MgmtUser', avatar='fox')
    return u


@pytest.fixture
def client_auth(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ─── Avatar change ────────────────────────────────────────────────────────────

def test_update_avatar_valid_key(client_auth, user):
    resp = client_auth.patch('/api/profile/avatar/', {'avatar': 'wolf'}, format='json')
    assert resp.status_code == 200
    assert resp.data['avatar'] == 'wolf'
    user.profile.refresh_from_db()
    assert user.profile.avatar == 'wolf'


def test_update_avatar_all_valid_keys(client_auth, user):
    """Każdy klucz z AVATAR_CHOICES powinien być akceptowany."""
    for key, _ in AVATAR_CHOICES:
        resp = client_auth.patch('/api/profile/avatar/', {'avatar': key}, format='json')
        assert resp.status_code == 200, f'Avatar {key!r} powinien być poprawny'


def test_update_avatar_invalid_key(client_auth):
    resp = client_auth.patch('/api/profile/avatar/', {'avatar': 'invalid_avatar'}, format='json')
    assert resp.status_code == 400


def test_update_avatar_empty_key(client_auth):
    resp = client_auth.patch('/api/profile/avatar/', {'avatar': ''}, format='json')
    assert resp.status_code == 400


def test_update_avatar_requires_auth():
    c = APIClient()
    resp = c.patch('/api/profile/avatar/', {'avatar': 'wolf'}, format='json')
    assert resp.status_code == 403


# ─── Me endpoint ──────────────────────────────────────────────────────────────

def test_me_returns_profile(client_auth, user):
    resp = client_auth.get('/api/auth/me/')
    assert resp.status_code == 200
    assert resp.data['display_name'] == 'MgmtUser'
    assert resp.data['email'] == 'mgmt@test.com'
    assert 'total_score' in resp.data
    assert 'games_played' in resp.data
    assert 'avatar' in resp.data


def test_me_unauthenticated():
    c = APIClient()
    resp = c.get('/api/auth/me/')
    assert resp.status_code == 403


# ─── Registration validation ──────────────────────────────────────────────────

def test_register_duplicate_email(db):
    c = APIClient()
    payload = lambda email, name: {
        'email': email, 'password': 'securepass1', 'display_name': name
    }
    c.post('/api/auth/register/', payload('dup@test.com', 'UserA'), format='json')
    resp = c.post('/api/auth/register/', payload('dup@test.com', 'UserB'), format='json')
    assert resp.status_code == 400


def test_register_duplicate_display_name(db):
    c = APIClient()
    c.post('/api/auth/register/', {
        'email': 'x1@test.com', 'password': 'pass1234', 'display_name': 'SharedName'
    }, format='json')
    resp = c.post('/api/auth/register/', {
        'email': 'x2@test.com', 'password': 'pass1234', 'display_name': 'SharedName'
    }, format='json')
    assert resp.status_code == 400


def test_register_too_short_password(db):
    c = APIClient()
    resp = c.post('/api/auth/register/', {
        'email': 'short@test.com', 'password': 'abc', 'display_name': 'ShortPwd'
    }, format='json')
    assert resp.status_code == 400


def test_register_invalid_email(db):
    c = APIClient()
    resp = c.post('/api/auth/register/', {
        'email': 'not-an-email', 'password': 'pass1234', 'display_name': 'BadEmail'
    }, format='json')
    assert resp.status_code == 400


# ─── Login validation ─────────────────────────────────────────────────────────

def test_login_wrong_password(user):
    c = APIClient()
    resp = c.post('/api/auth/login/', {
        'email': 'mgmt@test.com', 'password': 'wrongpassword'
    }, format='json')
    assert resp.status_code == 401


def test_login_nonexistent_email(db):
    c = APIClient()
    resp = c.post('/api/auth/login/', {
        'email': 'nobody@test.com', 'password': 'pass1234'
    }, format='json')
    assert resp.status_code == 401


def test_login_missing_fields(db):
    c = APIClient()
    resp = c.post('/api/auth/login/', {'email': 'test@test.com'}, format='json')
    assert resp.status_code == 400


# ─── Logout ───────────────────────────────────────────────────────────────────

def test_logout_ends_session(db):
    """Po wylogowaniu /me/ zwraca 403."""
    from django.test import Client
    c = Client()
    c.post('/api/auth/register/', {
        'email': 'lgout@test.com', 'password': 'pass1234', 'display_name': 'LogoutTest'
    }, content_type='application/json')
    resp = c.get('/api/auth/me/')
    assert resp.status_code == 200
    c.post('/api/auth/logout/')
    resp = c.get('/api/auth/me/')
    assert resp.status_code == 403


def test_logout_requires_auth():
    c = APIClient()
    resp = c.post('/api/auth/logout/')
    assert resp.status_code == 403
