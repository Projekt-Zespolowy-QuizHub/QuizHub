import pytest
from django.test import Client
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile
from apps.rooms.models import Room, Player


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user('host@test.com', 'host@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='HostUser')
    client = Client()
    client.force_login(user)
    return client, user


@pytest.fixture
def auth_client2(db):
    user = User.objects.create_user('player2@test.com', 'player2@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='Player2')
    client = Client()
    client.force_login(user)
    return client, user


@pytest.mark.django_db
def test_create_room(auth_client):
    client, user = auth_client
    resp = client.post('/api/rooms/', {
        'host_nickname': 'HostUser',
        'categories': ['Historia', 'Nauka'],
        'total_rounds': 10,
    }, content_type='application/json')
    assert resp.status_code == 201
    data = resp.json()
    assert 'room_code' in data
    room = Room.objects.get(code=data['room_code'])
    assert room.categories == ['Historia', 'Nauka']
    assert room.total_rounds == 10
    assert room.players.count() == 1
    assert room.players.first().is_host is True


@pytest.mark.django_db
def test_create_room_unauthenticated():
    client = Client()
    resp = client.post('/api/rooms/', {
        'host_nickname': 'Anon',
        'categories': ['Sport'],
        'total_rounds': 5,
    }, content_type='application/json')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_join_room(auth_client, auth_client2):
    client1, _ = auth_client
    client2, _ = auth_client2

    resp = client1.post('/api/rooms/', {
        'host_nickname': 'HostUser',
        'categories': ['Sport'],
        'total_rounds': 5,
    }, content_type='application/json')
    code = resp.json()['room_code']

    resp = client2.post('/api/rooms/join/', {
        'nickname': 'Player2',
        'room_code': code,
    }, content_type='application/json')
    assert resp.status_code == 201
    assert Room.objects.get(code=code).players.count() == 2


@pytest.mark.django_db
def test_join_nonexistent_room(auth_client):
    client, _ = auth_client
    resp = client.post('/api/rooms/join/', {
        'nickname': 'Player',
        'room_code': 'XXXXXX',
    }, content_type='application/json')
    assert resp.status_code == 404


@pytest.mark.django_db
def test_join_duplicate_nickname(auth_client, auth_client2):
    client1, _ = auth_client
    client2, _ = auth_client2

    resp = client1.post('/api/rooms/', {
        'host_nickname': 'Taken',
        'categories': ['Nauka'],
        'total_rounds': 5,
    }, content_type='application/json')
    code = resp.json()['room_code']

    resp = client2.post('/api/rooms/join/', {
        'nickname': 'Taken',
        'room_code': code,
    }, content_type='application/json')
    assert resp.status_code == 409


@pytest.mark.django_db
def test_join_in_progress_room(auth_client, auth_client2):
    client1, _ = auth_client
    client2, _ = auth_client2

    resp = client1.post('/api/rooms/', {
        'host_nickname': 'Host',
        'categories': ['Nauka'],
        'total_rounds': 5,
    }, content_type='application/json')
    code = resp.json()['room_code']
    room = Room.objects.get(code=code)
    room.status = 'in_progress'
    room.save()

    resp = client2.post('/api/rooms/join/', {
        'nickname': 'Late',
        'room_code': code,
    }, content_type='application/json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_room_detail():
    room = Room.objects.create(categories=['Historia'], total_rounds=10)
    Player.objects.create(room=room, nickname='Host', is_host=True)
    Player.objects.create(room=room, nickname='Player2')

    client = Client()
    resp = client.get(f'/api/rooms/{room.code}/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['code'] == room.code
    assert len(data['players']) == 2


@pytest.mark.django_db
def test_create_room_links_user(auth_client):
    client, user = auth_client
    resp = client.post('/api/rooms/', {
        'host_nickname': 'HostUser',
        'categories': ['Nauka'],
        'total_rounds': 5,
    }, content_type='application/json')
    assert resp.status_code == 201
    code = resp.json()['room_code']
    player = Player.objects.get(room__code=code)
    assert player.user == user


@pytest.mark.django_db
def test_public_game_endpoint():
    from django.utils import timezone
    from datetime import timedelta

    client = Client()
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 404

    Room.objects.create(
        categories=['Sport', 'Muzyka'],
        is_public=True,
        scheduled_at=timezone.now() + timedelta(minutes=5),
    )
    resp = client.get('/api/rooms/public/next/')
    assert resp.status_code == 200
    data = resp.json()
    assert 'code' in data
    assert 'scheduled_at' in data
