import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_next_public_tournament_returns_204_when_none(client):
    """Gdy brak publicznych turniejów — 204 No Content, nigdy 404."""
    res = client.get('/api/tournaments/next-public/')
    assert res.status_code == 204


@pytest.mark.django_db
def test_next_public_tournament_returns_data_when_exists(client):
    """Gdy jest zaplanowany turniej — 200 z polami FE."""
    from datetime import timedelta
    from django.utils import timezone
    from apps.rooms.models import Room, PublicTournamentConfig

    PublicTournamentConfig.get()
    start = timezone.now() + timedelta(minutes=5)
    Room.objects.create(
        categories=['Historia', 'Nauka'],
        is_public=True,
        scheduled_at=start,
    )

    res = client.get('/api/tournaments/next-public/')
    assert res.status_code == 200
    data = res.json()
    assert 'room_id' in data
    assert 'start_time' in data
    assert 'seconds_until_start' in data
    assert 'max_players' in data
    assert 'interval_minutes' in data
    assert data['categories'] == ['Historia', 'Nauka']
