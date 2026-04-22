import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile, Friendship


@pytest.fixture
def user_a(db):
    user = User.objects.create_user('a@test.com', 'a@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='UserA')
    return user


@pytest.fixture
def user_b(db):
    user = User.objects.create_user('b@test.com', 'b@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='UserB')
    return user


@pytest.fixture
def user_c(db):
    user = User.objects.create_user('c@test.com', 'c@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='UserC')
    return user


def test_search_users(user_a, user_b):
    client = APIClient()
    client.force_authenticate(user=user_a)
    resp = client.get('/api/friends/search/?q=UserB')
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]['display_name'] == 'UserB'


def test_search_excludes_self(user_a):
    client = APIClient()
    client.force_authenticate(user=user_a)
    resp = client.get('/api/friends/search/?q=UserA')
    assert resp.status_code == 200
    assert len(resp.data) == 0


def test_search_min_length(user_a):
    client = APIClient()
    client.force_authenticate(user=user_a)
    resp = client.get('/api/friends/search/?q=U')
    assert resp.status_code == 200
    assert len(resp.data) == 0


def test_send_friend_request(user_a, user_b):
    client = APIClient()
    client.force_authenticate(user=user_a)
    profile_b = user_b.profile
    resp = client.post('/api/friends/request/', {'user_id': profile_b.id}, format='json')
    assert resp.status_code == 201
    assert Friendship.objects.filter(from_user=user_a, to_user=user_b, status='pending').exists()


def test_cannot_add_self(user_a):
    client = APIClient()
    client.force_authenticate(user=user_a)
    resp = client.post('/api/friends/request/', {'user_id': user_a.profile.id}, format='json')
    assert resp.status_code == 400


def test_duplicate_request_rejected(user_a, user_b):
    Friendship.objects.create(from_user=user_a, to_user=user_b)
    client = APIClient()
    client.force_authenticate(user=user_a)
    resp = client.post('/api/friends/request/', {'user_id': user_b.profile.id}, format='json')
    assert resp.status_code == 400


def test_pending_requests(user_a, user_b):
    Friendship.objects.create(from_user=user_a, to_user=user_b)
    client = APIClient()
    client.force_authenticate(user=user_b)
    resp = client.get('/api/friends/pending/')
    assert resp.status_code == 200
    assert len(resp.data) == 1
    assert resp.data[0]['from_display_name'] == 'UserA'


def test_accept_request(user_a, user_b):
    fr = Friendship.objects.create(from_user=user_a, to_user=user_b)
    client = APIClient()
    client.force_authenticate(user=user_b)
    resp = client.post('/api/friends/respond/', {'request_id': fr.id, 'action': 'accept'}, format='json')
    assert resp.status_code == 200
    fr.refresh_from_db()
    assert fr.status == 'accepted'


def test_reject_request(user_a, user_b):
    fr = Friendship.objects.create(from_user=user_a, to_user=user_b)
    client = APIClient()
    client.force_authenticate(user=user_b)
    resp = client.post('/api/friends/respond/', {'request_id': fr.id, 'action': 'reject'}, format='json')
    assert resp.status_code == 200
    assert not Friendship.objects.filter(id=fr.id).exists()


def test_friends_list(user_a, user_b, user_c):
    Friendship.objects.create(from_user=user_a, to_user=user_b, status='accepted')
    Friendship.objects.create(from_user=user_c, to_user=user_a, status='accepted')

    client = APIClient()
    client.force_authenticate(user=user_a)
    resp = client.get('/api/friends/')
    assert resp.status_code == 200
    assert len(resp.data) == 2
    names = {f['display_name'] for f in resp.data}
    assert names == {'UserB', 'UserC'}


def test_friends_list_excludes_pending(user_a, user_b):
    Friendship.objects.create(from_user=user_a, to_user=user_b, status='pending')
    client = APIClient()
    client.force_authenticate(user=user_a)
    resp = client.get('/api/friends/')
    assert resp.status_code == 200
    assert len(resp.data) == 0
