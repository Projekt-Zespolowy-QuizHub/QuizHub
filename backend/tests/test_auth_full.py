"""
Comprehensive auth tests for QuizHub.

Covers: register, login, logout, /api/auth/me/ including daily coin bonus.
"""
import pytest
from django.test import Client
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile


# ─── Fixtures ────────────────────────────────────────────────────────


@pytest.fixture
def registered_client(db):
    """Returns a Client that has already registered and is logged in."""
    client = Client()
    client.post(
        '/api/auth/register/',
        {'email': 'player@example.com', 'password': 'securepass1', 'display_name': 'TestPlayer'},
        content_type='application/json',
    )
    return client


# ─── Register ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_register_valid_returns_201():
    client = Client()
    resp = client.post(
        '/api/auth/register/',
        {'email': 'new@example.com', 'password': 'securepass1', 'display_name': 'NewPlayer'},
        content_type='application/json',
    )
    assert resp.status_code == 201


@pytest.mark.django_db
def test_register_valid_returns_display_name():
    client = Client()
    resp = client.post(
        '/api/auth/register/',
        {'email': 'new@example.com', 'password': 'securepass1', 'display_name': 'NewPlayer'},
        content_type='application/json',
    )
    assert resp.json()['display_name'] == 'NewPlayer'


@pytest.mark.django_db
def test_register_valid_returns_email():
    client = Client()
    resp = client.post(
        '/api/auth/register/',
        {'email': 'new@example.com', 'password': 'securepass1', 'display_name': 'NewPlayer'},
        content_type='application/json',
    )
    assert resp.json()['email'] == 'new@example.com'


@pytest.mark.django_db
def test_register_creates_user_profile():
    client = Client()
    client.post(
        '/api/auth/register/',
        {'email': 'new@example.com', 'password': 'securepass1', 'display_name': 'NewPlayer'},
        content_type='application/json',
    )
    assert UserProfile.objects.filter(display_name='NewPlayer').exists()


@pytest.mark.django_db
def test_register_missing_email_returns_400():
    client = Client()
    resp = client.post(
        '/api/auth/register/',
        {'password': 'securepass1', 'display_name': 'NoEmail'},
        content_type='application/json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_register_missing_password_returns_400():
    client = Client()
    resp = client.post(
        '/api/auth/register/',
        {'email': 'nopass@example.com', 'display_name': 'NoPass'},
        content_type='application/json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_register_missing_display_name_returns_400():
    client = Client()
    resp = client.post(
        '/api/auth/register/',
        {'email': 'nodisplay@example.com', 'password': 'securepass1'},
        content_type='application/json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_register_duplicate_email_returns_400():
    client = Client()
    client.post(
        '/api/auth/register/',
        {'email': 'dup@example.com', 'password': 'securepass1', 'display_name': 'FirstUser'},
        content_type='application/json',
    )
    resp = client.post(
        '/api/auth/register/',
        {'email': 'dup@example.com', 'password': 'securepass1', 'display_name': 'SecondUser'},
        content_type='application/json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_register_duplicate_display_name_returns_400():
    client = Client()
    client.post(
        '/api/auth/register/',
        {'email': 'first@example.com', 'password': 'securepass1', 'display_name': 'Taken'},
        content_type='application/json',
    )
    resp = client.post(
        '/api/auth/register/',
        {'email': 'second@example.com', 'password': 'securepass1', 'display_name': 'Taken'},
        content_type='application/json',
    )
    assert resp.status_code == 400


# ─── Login ───────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_login_valid_returns_200():
    client = Client()
    client.post(
        '/api/auth/register/',
        {'email': 'login@example.com', 'password': 'securepass1', 'display_name': 'LoginPlayer'},
        content_type='application/json',
    )
    # Log out first so we can test login independently
    client.post('/api/auth/logout/')

    resp = client.post(
        '/api/auth/login/',
        {'email': 'login@example.com', 'password': 'securepass1'},
        content_type='application/json',
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_login_valid_returns_display_name():
    client = Client()
    client.post(
        '/api/auth/register/',
        {'email': 'login2@example.com', 'password': 'securepass1', 'display_name': 'LoginPlayer2'},
        content_type='application/json',
    )
    client.post('/api/auth/logout/')

    resp = client.post(
        '/api/auth/login/',
        {'email': 'login2@example.com', 'password': 'securepass1'},
        content_type='application/json',
    )
    assert resp.json()['display_name'] == 'LoginPlayer2'


@pytest.mark.django_db
def test_login_wrong_password_returns_401():
    client = Client()
    client.post(
        '/api/auth/register/',
        {'email': 'wrongpass@example.com', 'password': 'securepass1', 'display_name': 'WrongPassUser'},
        content_type='application/json',
    )
    client.post('/api/auth/logout/')

    resp = client.post(
        '/api/auth/login/',
        {'email': 'wrongpass@example.com', 'password': 'badpassword'},
        content_type='application/json',
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_login_missing_email_returns_400():
    client = Client()
    resp = client.post(
        '/api/auth/login/',
        {'password': 'securepass1'},
        content_type='application/json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_login_missing_password_returns_400():
    client = Client()
    resp = client.post(
        '/api/auth/login/',
        {'email': 'someone@example.com'},
        content_type='application/json',
    )
    assert resp.status_code == 400


# ─── Logout ──────────────────────────────────────────────────────────


def test_logout_authenticated_returns_200(registered_client):
    resp = registered_client.post('/api/auth/logout/')
    assert resp.status_code == 200


def test_logout_invalidates_session(registered_client):
    registered_client.post('/api/auth/logout/')
    resp = registered_client.get('/api/auth/me/')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_logout_unauthenticated_returns_403():
    client = Client()
    resp = client.post('/api/auth/logout/')
    assert resp.status_code == 403


# ─── Me endpoint ─────────────────────────────────────────────────────


def test_me_authenticated_returns_200(registered_client):
    resp = registered_client.get('/api/auth/me/')
    assert resp.status_code == 200


def test_me_authenticated_returns_display_name(registered_client):
    resp = registered_client.get('/api/auth/me/')
    assert resp.json()['display_name'] == 'TestPlayer'


@pytest.mark.django_db
def test_me_unauthenticated_returns_403():
    client = Client()
    resp = client.get('/api/auth/me/')
    assert resp.status_code == 403


def test_me_first_call_grants_daily_coins(registered_client):
    """
    UserProfile starts with coins=0 and last_daily_bonus=None.
    First call to /api/auth/me/ should add 20 coins.
    """
    resp = registered_client.get('/api/auth/me/')
    assert resp.status_code == 200
    assert resp.json()['coins'] == 20


def test_me_second_call_same_day_does_not_add_more_coins(registered_client):
    """
    Calling /api/auth/me/ twice on the same day should not grant coins twice.
    """
    registered_client.get('/api/auth/me/')  # first call — grants 20 coins
    resp = registered_client.get('/api/auth/me/')  # second call — no additional coins
    assert resp.json()['coins'] == 20


def test_me_daily_bonus_updates_last_daily_bonus(registered_client):
    """last_daily_bonus should be set to today after calling /api/auth/me/."""
    from django.utils import timezone

    registered_client.get('/api/auth/me/')
    user = User.objects.get(username='player@example.com')
    profile = user.profile
    assert profile.last_daily_bonus == timezone.now().date()
