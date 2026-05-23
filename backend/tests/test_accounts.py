import asyncio
import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError
from apps.accounts.models import UserProfile


async def _recv(layer, channel, timeout: float = 2.0):
    return await asyncio.wait_for(layer.receive(channel), timeout=timeout)


@pytest.mark.django_db
def test_create_profile():
    user = User.objects.create_user(username="testuser", password="testpass123")
    profile = UserProfile.objects.create(user=user, display_name="TestPlayer")
    assert profile.display_name == "TestPlayer"
    assert profile.total_score == 0
    assert profile.games_played == 0
    assert profile.created_at is not None


@pytest.mark.django_db
def test_display_name_unique():
    user1 = User.objects.create_user(username="user1", password="testpass123")
    user2 = User.objects.create_user(username="user2", password="testpass123")
    UserProfile.objects.create(user=user1, display_name="SameName")
    with pytest.raises(IntegrityError):
        UserProfile.objects.create(user=user2, display_name="SameName")


@pytest.mark.django_db(transaction=True)
def test_send_friend_request_broadcasts_ws_event(channel_layers):
    """POST /api/friends/request/ wysyła event friend_request_received do odbiorcy."""
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    from rest_framework.test import APIClient

    sender = User.objects.create_user(username='sender@x.pl', email='sender@x.pl', password='x')
    UserProfile.objects.create(user=sender, display_name='Sender')
    receiver = User.objects.create_user(username='receiver@x.pl', email='receiver@x.pl', password='x')
    receiver_profile = UserProfile.objects.create(user=receiver, display_name='Receiver')

    layer = get_channel_layer()
    async_to_sync(layer.group_add)(f'user_notifications_{receiver.id}', 'test-channel')

    client = APIClient()
    client.force_authenticate(user=sender)
    res = client.post('/api/friends/request/', {'user_id': receiver_profile.id}, format='json')
    assert res.status_code == 201

    msg = async_to_sync(_recv)(layer, 'test-channel')
    assert msg['type'] == 'friend_request_received'
    assert msg['from_display_name'] == 'Sender'
    assert 'request_id' in msg
    assert msg['from_user_id'] == sender.profile.id


@pytest.mark.django_db(transaction=True)
def test_accept_friend_request_broadcasts_ws_event(channel_layers):
    """POST /api/friends/respond/ z action=accept wysyła friend_request_accepted do nadawcy."""
    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    from apps.accounts.models import Friendship
    from rest_framework.test import APIClient

    sender = User.objects.create_user(username='sender2@x.pl', email='sender2@x.pl', password='x')
    UserProfile.objects.create(user=sender, display_name='Sender2')
    receiver = User.objects.create_user(username='receiver2@x.pl', email='receiver2@x.pl', password='x')
    UserProfile.objects.create(user=receiver, display_name='Receiver2')

    friendship = Friendship.objects.create(from_user=sender, to_user=receiver)

    layer = get_channel_layer()
    async_to_sync(layer.group_add)(f'user_notifications_{sender.id}', 'test-channel')

    client = APIClient()
    client.force_authenticate(user=receiver)
    res = client.post('/api/friends/respond/', {'request_id': friendship.id, 'action': 'accept'}, format='json')
    assert res.status_code == 200

    msg = async_to_sync(_recv)(layer, 'test-channel')
    assert msg['type'] == 'friend_request_accepted'
    assert msg['by_display_name'] == 'Receiver2'
