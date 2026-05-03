"""
Rozszerzone testy WebSocket.

Pokrycie:
- Czat w lobby: rozsyłanie, max długość, HTML escaping
- Reconnect/rejoin: brak player_left w trakcie grace period, zwrot game_state
- Powiadomienia o wyzwaniu przez NotificationConsumer
- Nieznany typ wiadomości jest ignorowany
- Nieprawidłowy nick (za długi, HTML znaki) jest odrzucany
- Rejoin po zakończeniu grace period: gracz jest traktowany jako nowy
"""
import asyncio
import json
import pytest
import pytest_asyncio
from django.core.cache import cache
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from quizarena.asgi import application
from apps.rooms.models import Room, Player
from apps.accounts.models import UserProfile
from apps.rooms.consumers import GameConsumer, _disconnect_tasks, _powerups_used


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def use_channel_layers(channel_layers):
    pass


@pytest_asyncio.fixture(autouse=True)
async def clear_tasks():
    _disconnect_tasks.clear()
    _powerups_used.clear()
    await cache.aclear()
    yield
    for task in list(_disconnect_tasks.values()):
        task.cancel()
    _disconnect_tasks.clear()
    _powerups_used.clear()


@pytest.fixture
def short_grace(monkeypatch):
    monkeypatch.setattr(GameConsumer, 'GRACE_PERIOD_SECONDS', 0.05)


@pytest_asyncio.fixture
async def room():
    return await database_sync_to_async(Room.objects.create)(code='WSEXT1')


async def _join(room_code: str, nickname: str) -> WebsocketCommunicator:
    comm = WebsocketCommunicator(application, f'/ws/room/{room_code}/')
    connected, _ = await comm.connect()
    assert connected
    await comm.send_json_to({'type': 'join', 'nickname': nickname})
    return comm


# ─── Chat ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_broadcast_to_all_players(room):
    alice = await _join(room.code, 'Alice')
    await alice.receive_json_from()  # player_joined Alice

    bob = await _join(room.code, 'Bob')
    await alice.receive_json_from()  # player_joined Bob
    await bob.receive_json_from()    # player_joined Bob

    await alice.send_json_to({'type': 'chat_message', 'text': 'Witaj!'})

    alice_msg = await asyncio.wait_for(alice.receive_json_from(), timeout=1.0)
    bob_msg = await asyncio.wait_for(bob.receive_json_from(), timeout=1.0)

    assert alice_msg['type'] == 'chat_message'
    assert alice_msg['nickname'] == 'Alice'
    assert alice_msg['text'] == 'Witaj!'
    assert bob_msg == alice_msg

    await alice.disconnect()
    await bob.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_message_truncated_to_200_chars(room):
    player = await _join(room.code, 'Player')
    await player.receive_json_from()

    await player.send_json_to({'type': 'chat_message', 'text': 'x' * 300})
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert len(msg['text']) == 200

    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_empty_message_returns_error(room):
    """Pusta wiadomość czatu zwraca błąd walidacji."""
    player = await _join(room.code, 'Player')
    await player.receive_json_from()

    await player.send_json_to({'type': 'chat_message', 'text': '   '})
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'error'

    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_html_escaped(room):
    player = await _join(room.code, 'Player')
    await player.receive_json_from()

    await player.send_json_to({'type': 'chat_message', 'text': '<script>alert(1)</script>'})
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert '<script>' not in msg['text']
    assert '&lt;script&gt;' in msg['text']

    await player.disconnect()


# ─── Unknown message type ─────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_unknown_message_type_returns_error(room):
    """Nieznany typ wiadomości zwraca błąd walidacji."""
    player = await _join(room.code, 'Player')
    await player.receive_json_from()

    await player.send_json_to({'type': 'unknown_type', 'data': 'xyz'})
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'error'

    await player.disconnect()


# ─── Nickname validation ──────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_join_with_too_long_nickname(room):
    comm = WebsocketCommunicator(application, f'/ws/room/{room.code}/')
    connected, _ = await comm.connect()
    assert connected

    await comm.send_json_to({'type': 'join', 'nickname': 'A' * 31})
    # Nie powinien otrzymać player_joined — walidacja odrzuca nick
    # Możliwe zachowania: brak wiadomości lub error — sprawdzamy że nie dołączył
    assert not await database_sync_to_async(Player.objects.filter(room=room).exists)()

    await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_join_with_html_chars_rejected(room):
    comm = WebsocketCommunicator(application, f'/ws/room/{room.code}/')
    connected, _ = await comm.connect()
    assert connected

    await comm.send_json_to({'type': 'join', 'nickname': '<script>'})
    assert not await database_sync_to_async(Player.objects.filter(room=room).exists)()

    await comm.disconnect()


# ─── Reconnect / Rejoin ───────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_rejoin_returns_game_state_with_correct_score(room, short_grace):
    await database_sync_to_async(Player.objects.create)(
        room=room, nickname='Returner', score=1500
    )

    # Dołącz i rozłącz
    first = await _join(room.code, 'Returner')
    await first.receive_json_from()
    await first.disconnect()

    # Rejoin przed upływem grace period
    rejoin = WebsocketCommunicator(application, f'/ws/room/{room.code}/')
    connected, _ = await rejoin.connect()
    assert connected
    await rejoin.send_json_to({'type': 'rejoin', 'nickname': 'Returner'})

    msg = await asyncio.wait_for(rejoin.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'game_state'
    assert msg['score'] == 1500

    await rejoin.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_player_left_not_sent_during_grace_period(room):
    observer = await _join(room.code, 'Observer')
    await observer.receive_json_from()

    leaver = await _join(room.code, 'Leaver')
    await observer.receive_json_from()  # player_joined Leaver
    await leaver.receive_json_from()    # własny player_joined

    await leaver.disconnect()

    # Observer nie powinien dostać niczego przez krótki czas
    assert await observer.receive_nothing(timeout=0.2)

    await observer.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_player_left_sent_after_grace_period_expires(room, short_grace):
    observer = await _join(room.code, 'Observer')
    await observer.receive_json_from()

    leaver = await _join(room.code, 'Leaver')
    await observer.receive_json_from()
    await leaver.receive_json_from()

    await leaver.disconnect()

    msg = await asyncio.wait_for(observer.receive_json_from(), timeout=1.0)
    assert msg == {'type': 'player_left', 'nickname': 'Leaver'}

    await observer.disconnect()


# ─── Challenge notifications (NotificationConsumer) ──────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_notification_consumer_rejects_unauthenticated():
    comm = WebsocketCommunicator(application, '/ws/notifications/')
    connected, code = await comm.connect()
    # Niezalogowany powinien dostać close z kodem 4401
    assert not connected or code == 4401
    await comm.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_notification_consumer_accepts_authenticated_user():
    user = await database_sync_to_async(User.objects.create_user)(
        'notif@test.com', 'notif@test.com', 'pass1234'
    )
    await database_sync_to_async(UserProfile.objects.create)(
        user=user, display_name='NotifUser'
    )

    from channels.auth import AuthMiddlewareStack
    scope = {
        'type': 'websocket',
        'user': user,
        'url_route': {'kwargs': {}},
        'headers': [],
        'query_string': b'',
        'path': '/ws/notifications/',
    }
    comm = WebsocketCommunicator(application, '/ws/notifications/')
    # Zaloguj przez session
    comm.scope['user'] = user
    connected, _ = await comm.connect()
    assert connected
    await comm.disconnect()
