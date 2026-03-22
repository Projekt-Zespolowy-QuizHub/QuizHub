"""
Comprehensive tests for daily challenges endpoints:
  GET  /api/daily-challenges/        — list today's challenges with user progress
  POST /api/daily-challenges/claim/  — claim reward for a completed challenge
"""
import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, DailyChallenge, UserChallengeProgress


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user_a(db):
    user = User.objects.create_user('challenger@test.com', 'challenger@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='Challenger', coins=0)
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
def today():
    return timezone.now().date()


@pytest.fixture
def play_games_challenge(db, today):
    return DailyChallenge.objects.create(
        description='Zagraj 3 gry',
        challenge_type='play_games',
        target_value=3,
        coin_reward=50,
        date=today,
    )


@pytest.fixture
def win_games_challenge(db, today):
    return DailyChallenge.objects.create(
        description='Wygraj 2 gry',
        challenge_type='win_games',
        target_value=2,
        coin_reward=75,
        date=today,
    )


@pytest.fixture
def yesterday_challenge(db, today):
    yesterday = today - timezone.timedelta(days=1)
    return DailyChallenge.objects.create(
        description='Wczorajsze wyzwanie',
        challenge_type='play_games',
        target_value=1,
        coin_reward=10,
        date=yesterday,
    )


# ---------------------------------------------------------------------------
# GET /api/daily-challenges/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_challenges_requires_auth(anon_client):
    response = anon_client.get('/api/daily-challenges/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_challenges_returns_200(client_a, play_games_challenge):
    response = client_a.get('/api/daily-challenges/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_challenges_returns_list(client_a, play_games_challenge):
    response = client_a.get('/api/daily-challenges/')
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_challenges_empty_when_no_challenges_today(client_a):
    response = client_a.get('/api/daily-challenges/')
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_challenges_today_appear_in_list(client_a, play_games_challenge):
    response = client_a.get('/api/daily-challenges/')
    ids = [c['id'] for c in response.json()]
    assert play_games_challenge.id in ids


@pytest.mark.django_db
def test_challenges_yesterday_not_in_list(client_a, yesterday_challenge):
    response = client_a.get('/api/daily-challenges/')
    ids = [c['id'] for c in response.json()]
    assert yesterday_challenge.id not in ids


@pytest.mark.django_db
def test_challenges_multiple_today(client_a, play_games_challenge, win_games_challenge):
    response = client_a.get('/api/daily-challenges/')
    ids = [c['id'] for c in response.json()]
    assert play_games_challenge.id in ids
    assert win_games_challenge.id in ids


@pytest.mark.django_db
def test_challenge_has_required_fields(client_a, play_games_challenge):
    response = client_a.get('/api/daily-challenges/')
    data = response.json()
    assert len(data) >= 1
    item = data[0]
    for field in ('id', 'description', 'challenge_type', 'target_value', 'coin_reward',
                  'current_value', 'completed', 'reward_claimed'):
        assert field in item, f"Field '{field}' missing from challenge response"


@pytest.mark.django_db
def test_challenge_with_no_progress_shows_current_value_zero(client_a, play_games_challenge):
    """When the user has no progress record, current_value must be 0."""
    response = client_a.get('/api/daily-challenges/')
    data = response.json()
    challenge_data = next(c for c in data if c['id'] == play_games_challenge.id)
    assert challenge_data['current_value'] == 0


@pytest.mark.django_db
def test_challenge_with_no_progress_shows_completed_false(client_a, play_games_challenge):
    response = client_a.get('/api/daily-challenges/')
    data = response.json()
    challenge_data = next(c for c in data if c['id'] == play_games_challenge.id)
    assert challenge_data['completed'] is False


@pytest.mark.django_db
def test_challenge_with_no_progress_shows_reward_claimed_false(client_a, play_games_challenge):
    response = client_a.get('/api/daily-challenges/')
    data = response.json()
    challenge_data = next(c for c in data if c['id'] == play_games_challenge.id)
    assert challenge_data['reward_claimed'] is False


@pytest.mark.django_db
def test_challenge_with_progress_shows_current_value(client_a, user_a, play_games_challenge):
    UserChallengeProgress.objects.create(
        user=user_a,
        challenge=play_games_challenge,
        current_value=2,
        completed=False,
    )
    response = client_a.get('/api/daily-challenges/')
    data = response.json()
    challenge_data = next(c for c in data if c['id'] == play_games_challenge.id)
    assert challenge_data['current_value'] == 2


@pytest.mark.django_db
def test_challenge_completed_progress_shows_completed_true(client_a, user_a, play_games_challenge):
    UserChallengeProgress.objects.create(
        user=user_a,
        challenge=play_games_challenge,
        current_value=3,
        completed=True,
        reward_claimed=False,
    )
    response = client_a.get('/api/daily-challenges/')
    data = response.json()
    challenge_data = next(c for c in data if c['id'] == play_games_challenge.id)
    assert challenge_data['completed'] is True


# ---------------------------------------------------------------------------
# POST /api/daily-challenges/claim/
# ---------------------------------------------------------------------------

@pytest.fixture
def completed_progress(db, user_a, play_games_challenge):
    return UserChallengeProgress.objects.create(
        user=user_a,
        challenge=play_games_challenge,
        current_value=3,
        completed=True,
        reward_claimed=False,
    )


@pytest.fixture
def already_claimed_progress(db, user_a, win_games_challenge):
    return UserChallengeProgress.objects.create(
        user=user_a,
        challenge=win_games_challenge,
        current_value=2,
        completed=True,
        reward_claimed=True,
    )


@pytest.mark.django_db
def test_claim_completed_challenge_returns_200(client_a, play_games_challenge, completed_progress):
    response = client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_claim_gives_coins(client_a, user_a, play_games_challenge, completed_progress):
    client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    user_a.profile.refresh_from_db()
    assert user_a.profile.coins == play_games_challenge.coin_reward  # was 0, now 50


@pytest.mark.django_db
def test_claim_response_contains_coins_awarded(client_a, play_games_challenge, completed_progress):
    response = client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    data = response.json()
    assert 'coins_awarded' in data
    assert data['coins_awarded'] == play_games_challenge.coin_reward


@pytest.mark.django_db
def test_claim_response_contains_total_coins(client_a, play_games_challenge, completed_progress):
    response = client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    data = response.json()
    assert 'total_coins' in data


@pytest.mark.django_db
def test_claim_marks_reward_claimed(client_a, play_games_challenge, completed_progress):
    client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    completed_progress.refresh_from_db()
    assert completed_progress.reward_claimed is True


@pytest.mark.django_db
def test_claim_uncompleted_challenge_returns_400(client_a, user_a, play_games_challenge):
    """Trying to claim a challenge that isn't finished yet returns 400."""
    UserChallengeProgress.objects.create(
        user=user_a,
        challenge=play_games_challenge,
        current_value=1,
        completed=False,
        reward_claimed=False,
    )
    response = client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_claim_uncompleted_challenge_does_not_award_coins(client_a, user_a, play_games_challenge):
    UserChallengeProgress.objects.create(
        user=user_a,
        challenge=play_games_challenge,
        current_value=1,
        completed=False,
        reward_claimed=False,
    )
    client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    user_a.profile.refresh_from_db()
    assert user_a.profile.coins == 0


@pytest.mark.django_db
def test_claim_already_claimed_returns_400(client_a, win_games_challenge, already_claimed_progress):
    response = client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': win_games_challenge.id},
        format='json',
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_claim_no_progress_record_returns_404(client_a, play_games_challenge):
    """If the user never started the challenge there is no progress row."""
    response = client_a.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_claim_requires_auth(anon_client, play_games_challenge):
    response = anon_client.post(
        '/api/daily-challenges/claim/',
        {'challenge_id': play_games_challenge.id},
        format='json',
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_claim_without_challenge_id_returns_400(client_a):
    response = client_a.post('/api/daily-challenges/claim/', {}, format='json')
    assert response.status_code == 400
