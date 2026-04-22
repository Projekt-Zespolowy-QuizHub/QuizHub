"""
Comprehensive tests for season endpoints:
  GET /api/seasons/current/          — active season or 404
  GET /api/seasons/                  — list past (inactive) seasons
  GET /api/seasons/<id>/leaderboard/ — season leaderboard ordered by rank
"""
import pytest
from datetime import date
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, Season, SeasonResult


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user_a(db):
    user = User.objects.create_user('seasona@test.com', 'seasona@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='SeasonUserA', total_score=5000)
    return user


@pytest.fixture
def user_b(db):
    user = User.objects.create_user('seasonb@test.com', 'seasonb@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='SeasonUserB', total_score=3000)
    return user


@pytest.fixture
def client_a(user_a):
    c = APIClient()
    c.force_authenticate(user=user_a)
    return c


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def active_season(db):
    return Season.objects.create(
        number=1,
        name='Season One',
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 31),
        is_active=True,
    )


@pytest.fixture
def past_season_a(db):
    return Season.objects.create(
        number=2,
        name='Season Two',
        start_date=date(2023, 7, 1),
        end_date=date(2023, 9, 30),
        is_active=False,
    )


@pytest.fixture
def past_season_b(db):
    return Season.objects.create(
        number=3,
        name='Season Three',
        start_date=date(2023, 10, 1),
        end_date=date(2023, 12, 31),
        is_active=False,
    )


# ---------------------------------------------------------------------------
# GET /api/seasons/current/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_current_season_returns_200_when_active(active_season):
    c = APIClient()
    response = c.get('/api/seasons/current/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_current_season_returns_active_season_data(active_season):
    c = APIClient()
    response = c.get('/api/seasons/current/')
    data = response.json()
    assert data['id'] == active_season.id
    assert data['name'] == 'Season One'
    assert data['is_active'] is True


@pytest.mark.django_db
def test_current_season_contains_required_fields(active_season):
    c = APIClient()
    response = c.get('/api/seasons/current/')
    data = response.json()
    for field in ('id', 'number', 'name', 'start_date', 'end_date', 'is_active'):
        assert field in data, f"Field '{field}' missing from current season response"


@pytest.mark.django_db
def test_current_season_returns_404_when_no_active_season(db):
    """When no season has is_active=True, the endpoint returns 404."""
    response = APIClient().get('/api/seasons/current/')
    assert response.status_code == 404


@pytest.mark.django_db
def test_current_season_404_with_only_past_seasons(past_season_a, past_season_b):
    response = APIClient().get('/api/seasons/current/')
    assert response.status_code == 404


@pytest.mark.django_db
def test_current_season_accessible_without_auth(active_season):
    response = APIClient().get('/api/seasons/current/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_current_season_number_matches(active_season):
    response = APIClient().get('/api/seasons/current/')
    assert response.json()['number'] == active_season.number


# ---------------------------------------------------------------------------
# GET /api/seasons/  (past / all inactive seasons)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_seasons_list_returns_200(past_season_a):
    response = APIClient().get('/api/seasons/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_seasons_list_returns_list(past_season_a):
    response = APIClient().get('/api/seasons/')
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_seasons_list_includes_inactive_seasons(past_season_a, past_season_b):
    response = APIClient().get('/api/seasons/')
    ids = [s['id'] for s in response.json()]
    assert past_season_a.id in ids
    assert past_season_b.id in ids


@pytest.mark.django_db
def test_seasons_list_excludes_active_season(active_season, past_season_a):
    """PastSeasonsView only returns is_active=False seasons."""
    response = APIClient().get('/api/seasons/')
    ids = [s['id'] for s in response.json()]
    assert active_season.id not in ids


@pytest.mark.django_db
def test_seasons_list_empty_when_no_past_seasons(db):
    response = APIClient().get('/api/seasons/')
    assert response.json() == []


@pytest.mark.django_db
def test_seasons_list_contains_required_fields(past_season_a):
    response = APIClient().get('/api/seasons/')
    data = response.json()
    assert len(data) >= 1
    item = data[0]
    for field in ('id', 'number', 'name', 'start_date', 'end_date'):
        assert field in item, f"Field '{field}' missing from seasons list item"


@pytest.mark.django_db
def test_seasons_list_accessible_without_auth(past_season_a):
    response = APIClient().get('/api/seasons/')
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/seasons/<id>/leaderboard/
# ---------------------------------------------------------------------------

@pytest.fixture
def leaderboard_season(db):
    return Season.objects.create(
        number=10,
        name='Leaderboard Season',
        start_date=date(2024, 1, 1),
        end_date=date(2024, 3, 31),
        is_active=False,
    )


@pytest.fixture
def season_result_a(db, leaderboard_season, user_a):
    return SeasonResult.objects.create(
        season=leaderboard_season,
        user=user_a,
        final_rank=1,
        total_score=5000,
        games_played=20,
        wins=10,
    )


@pytest.fixture
def season_result_b(db, leaderboard_season, user_b):
    return SeasonResult.objects.create(
        season=leaderboard_season,
        user=user_b,
        final_rank=2,
        total_score=3000,
        games_played=15,
        wins=5,
    )


@pytest.mark.django_db
def test_season_leaderboard_returns_200(leaderboard_season, season_result_a):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_season_leaderboard_contains_season_info(leaderboard_season, season_result_a):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    data = response.json()
    assert 'season' in data
    assert data['season']['id'] == leaderboard_season.id
    assert data['season']['name'] == 'Leaderboard Season'


@pytest.mark.django_db
def test_season_leaderboard_contains_leaderboard_key(leaderboard_season, season_result_a):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    data = response.json()
    assert 'leaderboard' in data
    assert isinstance(data['leaderboard'], list)


@pytest.mark.django_db
def test_season_leaderboard_empty_list_when_no_results(leaderboard_season):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    data = response.json()
    assert data['leaderboard'] == []


@pytest.mark.django_db
def test_season_leaderboard_shows_results_ordered_by_rank(
    leaderboard_season, season_result_a, season_result_b
):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    leaderboard = response.json()['leaderboard']
    assert len(leaderboard) == 2
    assert leaderboard[0]['rank'] == 1
    assert leaderboard[1]['rank'] == 2


@pytest.mark.django_db
def test_season_leaderboard_first_place_has_correct_display_name(
    leaderboard_season, season_result_a, season_result_b
):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    leaderboard = response.json()['leaderboard']
    assert leaderboard[0]['display_name'] == 'SeasonUserA'


@pytest.mark.django_db
def test_season_leaderboard_result_has_required_fields(leaderboard_season, season_result_a):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    leaderboard = response.json()['leaderboard']
    assert len(leaderboard) >= 1
    item = leaderboard[0]
    for field in ('rank', 'display_name', 'total_score', 'games_played', 'wins'):
        assert field in item, f"Field '{field}' missing from leaderboard entry"


@pytest.mark.django_db
def test_season_leaderboard_correct_scores(leaderboard_season, season_result_a, season_result_b):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    leaderboard = response.json()['leaderboard']
    assert leaderboard[0]['total_score'] == 5000
    assert leaderboard[1]['total_score'] == 3000


@pytest.mark.django_db
def test_season_leaderboard_nonexistent_season_returns_404():
    response = APIClient().get('/api/seasons/99999/leaderboard/')
    assert response.status_code == 404


@pytest.mark.django_db
def test_season_leaderboard_accessible_without_auth(leaderboard_season, season_result_a):
    response = APIClient().get(f'/api/seasons/{leaderboard_season.id}/leaderboard/')
    assert response.status_code == 200
