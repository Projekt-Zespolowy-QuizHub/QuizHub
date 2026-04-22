"""
Comprehensive tests for profile endpoints:
  GET  /api/profile/stats/
  GET  /api/profile/history/
  GET  /api/profile/achievements/
  PATCH /api/profile/avatar/
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user_a(db):
    user = User.objects.create_user('usera@test.com', 'usera@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='UserA', games_played=5, total_score=1000)
    return user


@pytest.fixture
def client_a(user_a):
    c = APIClient()
    c.force_authenticate(user=user_a)
    return c


@pytest.fixture
def anon_client():
    return APIClient()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_stats_authenticated_returns_200(client_a):
    response = client_a.get('/api/profile/stats/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_stats_unauthenticated_returns_403(anon_client):
    response = anon_client.get('/api/profile/stats/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_stats_contains_display_name(client_a, user_a):
    response = client_a.get('/api/profile/stats/')
    assert response.status_code == 200
    data = response.json()
    assert data['display_name'] == 'UserA'


@pytest.mark.django_db
def test_stats_contains_games_played_field(client_a):
    response = client_a.get('/api/profile/stats/')
    assert response.status_code == 200
    data = response.json()
    assert 'games_played' in data


@pytest.mark.django_db
def test_stats_games_played_is_integer(client_a):
    response = client_a.get('/api/profile/stats/')
    data = response.json()
    assert isinstance(data['games_played'], int)


@pytest.mark.django_db
def test_stats_contains_total_score(client_a):
    response = client_a.get('/api/profile/stats/')
    data = response.json()
    assert 'total_score' in data


@pytest.mark.django_db
def test_stats_contains_wins(client_a):
    response = client_a.get('/api/profile/stats/')
    data = response.json()
    assert 'wins' in data


@pytest.mark.django_db
def test_stats_contains_win_rate(client_a):
    response = client_a.get('/api/profile/stats/')
    data = response.json()
    assert 'win_rate' in data


@pytest.mark.django_db
def test_stats_new_user_games_played_zero(db):
    """A fresh user with no finished rooms has games_played=0 from the stats view."""
    user = User.objects.create_user('fresh@test.com', 'fresh@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='FreshUser')
    c = APIClient()
    c.force_authenticate(user=user)
    response = c.get('/api/profile/stats/')
    data = response.json()
    # games_played is computed from finished Player records, not the profile field
    assert data['games_played'] == 0


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_history_authenticated_returns_200(client_a):
    response = client_a.get('/api/profile/history/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_history_unauthenticated_returns_403(anon_client):
    response = anon_client.get('/api/profile/history/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_history_returns_list(client_a):
    response = client_a.get('/api/profile/history/')
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_history_empty_for_new_user(db):
    user = User.objects.create_user('newuser@test.com', 'newuser@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='NewUser')
    c = APIClient()
    c.force_authenticate(user=user)
    response = c.get('/api/profile/history/')
    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_achievements_authenticated_returns_200(client_a):
    response = client_a.get('/api/profile/achievements/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_achievements_unauthenticated_returns_403(anon_client):
    response = anon_client.get('/api/profile/achievements/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_achievements_returns_list(client_a):
    response = client_a.get('/api/profile/achievements/')
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_achievements_items_have_required_fields(client_a):
    response = client_a.get('/api/profile/achievements/')
    data = response.json()
    if data:
        item = data[0]
        assert 'condition_type' in item
        assert 'name' in item
        assert 'description' in item
        assert 'icon' in item
        assert 'unlocked' in item
        assert 'unlocked_at' in item


@pytest.mark.django_db
def test_achievements_unlocked_field_is_bool(client_a):
    response = client_a.get('/api/profile/achievements/')
    data = response.json()
    for item in data:
        assert isinstance(item['unlocked'], bool)


# ---------------------------------------------------------------------------
# Avatar update
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_update_avatar_valid_value_returns_200(client_a):
    response = client_a.patch('/api/profile/avatar/', {'avatar': 'wolf'}, format='json')
    assert response.status_code == 200


@pytest.mark.django_db
def test_update_avatar_persists_change(client_a, user_a):
    client_a.patch('/api/profile/avatar/', {'avatar': 'lion'}, format='json')
    user_a.profile.refresh_from_db()
    assert user_a.profile.avatar == 'lion'


@pytest.mark.django_db
def test_update_avatar_returns_avatar_key(client_a):
    response = client_a.patch('/api/profile/avatar/', {'avatar': 'bear'}, format='json')
    data = response.json()
    assert data['avatar'] == 'bear'


@pytest.mark.django_db
def test_update_avatar_invalid_value_returns_400(client_a):
    response = client_a.patch('/api/profile/avatar/', {'avatar': 'unicorn_invalid'}, format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_update_avatar_empty_string_returns_400(client_a):
    response = client_a.patch('/api/profile/avatar/', {'avatar': ''}, format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_update_avatar_unauthenticated_returns_403(anon_client):
    response = anon_client.patch('/api/profile/avatar/', {'avatar': 'fox'}, format='json')
    assert response.status_code == 403


@pytest.mark.django_db
def test_update_avatar_all_valid_choices(client_a):
    valid_avatars = [
        'fox', 'wolf', 'lion', 'tiger', 'bear', 'raccoon', 'frog',
        'penguin', 'owl', 'butterfly', 'dragon', 'unicorn', 'octopus',
        'shark', 'turtle', 'cat', 'robot', 'alien', 'ninja', 'wizard',
    ]
    for avatar in valid_avatars:
        response = client_a.patch('/api/profile/avatar/', {'avatar': avatar}, format='json')
        assert response.status_code == 200, f"Avatar '{avatar}' should be valid, got {response.status_code}"
