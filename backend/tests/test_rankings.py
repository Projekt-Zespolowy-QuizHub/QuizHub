import pytest
from django.test import Client
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile, Friendship


@pytest.mark.django_db
def test_global_ranking():
    for i in range(3):
        user = User.objects.create_user(f'u{i}@test.com', f'u{i}@test.com', 'pass')
        UserProfile.objects.create(user=user, display_name=f'Player{i}', total_score=(3 - i) * 1000)

    client = Client()
    resp = client.get('/api/rankings/global/')
    assert resp.status_code == 200
    assert len(resp.data) == 3
    assert resp.data[0]['display_name'] == 'Player0'
    assert resp.data[0]['total_score'] == 3000
    assert resp.data[0]['rank'] == 1


@pytest.mark.django_db
def test_weekly_ranking():
    for i in range(3):
        user = User.objects.create_user(f'w{i}@test.com', f'w{i}@test.com', 'pass')
        UserProfile.objects.create(user=user, display_name=f'Weekly{i}', weekly_score=(3 - i) * 500)

    client = Client()
    resp = client.get('/api/rankings/weekly/')
    assert resp.status_code == 200
    assert len(resp.data) == 3
    assert resp.data[0]['display_name'] == 'Weekly0'


@pytest.mark.django_db
def test_friends_ranking():
    users = []
    for i in range(3):
        user = User.objects.create_user(f'f{i}@test.com', f'f{i}@test.com', 'pass')
        UserProfile.objects.create(user=user, display_name=f'Friend{i}', total_score=(3 - i) * 1000)
        users.append(user)

    # user0 i user1 są znajomymi, user2 nie
    Friendship.objects.create(from_user=users[0], to_user=users[1], status='accepted')

    client = Client()
    client.force_login(users[0])
    resp = client.get('/api/rankings/friends/')
    assert resp.status_code == 200
    names = {e['display_name'] for e in resp.data}
    assert 'Friend0' in names
    assert 'Friend1' in names
    assert 'Friend2' not in names


@pytest.mark.django_db
def test_friends_ranking_unauthenticated():
    client = Client()
    resp = client.get('/api/rankings/friends/')
    assert resp.status_code == 403
