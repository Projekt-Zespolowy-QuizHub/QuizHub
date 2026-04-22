import asyncio
import pytest
import pytest_asyncio
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from quizarena.asgi import application
from apps.rooms.models import Room, Player
from apps.rooms.consumers import GameConsumer, _disconnect_tasks


@pytest.fixture(autouse=True)
def use_channel_layers(channel_layers):
    """Apply in-memory channel layer to all tests in this module."""
    pass


@pytest_asyncio.fixture(autouse=True)
async def clear_disconnect_tasks():
    """Ensure no leftover tasks between tests."""
    _disconnect_tasks.clear()
    yield
    for task in list(_disconnect_tasks.values()):
        task.cancel()
    _disconnect_tasks.clear()


@pytest.fixture
def short_grace(monkeypatch):
    monkeypatch.setattr(GameConsumer, 'GRACE_PERIOD_SECONDS', 0.05)
    monkeypatch.setattr(GameConsumer, 'LOBBY_GRACE_SECONDS', 0.05)


@pytest_asyncio.fixture
async def room():
    return await database_sync_to_async(Room.objects.create)(code='TSTROM')


async def _connect_and_join(room_code: str, nickname: str) -> WebsocketCommunicator:
    comm = WebsocketCommunicator(application, f'/ws/room/{room_code}/')
    connected, _ = await comm.connect()
    assert connected
    await comm.send_json_to({'type': 'join', 'nickname': nickname})
    return comm


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_disconnect_does_not_immediately_broadcast_player_left(room):
    """Grace period: player_left musi NIE przyjść od razu po rozłączeniu."""
    observer = await _connect_and_join(room.code, 'Observer')
    await observer.receive_json_from()  # własny player_joined

    leaver = await _connect_and_join(room.code, 'Leaver')
    await observer.receive_json_from()  # player_joined dla Leaver
    await leaver.receive_json_from()    # własny player_joined

    await leaver.disconnect()

    # Observer nie powinien dostać nic przez 200ms
    assert await observer.receive_nothing(timeout=0.2)

    await observer.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_player_left_broadcast_after_grace_period(room, short_grace):
    """Po upływie grace period player_left JEST wysłany."""
    observer = await _connect_and_join(room.code, 'Observer')
    await observer.receive_json_from()

    leaver = await _connect_and_join(room.code, 'Leaver')
    await observer.receive_json_from()
    await leaver.receive_json_from()

    await leaver.disconnect()

    msg = await asyncio.wait_for(observer.receive_json_from(), timeout=1.0)
    assert msg == {'type': 'player_left', 'nickname': 'Leaver'}

    await observer.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_rejoin_cancels_grace_period_and_returns_game_state(room, short_grace):
    """Rejoin w trakcie grace period: brak player_left, gracz dostaje game_state."""
    await database_sync_to_async(Player.objects.create)(
        room=room, nickname='Rejoiner', score=42)

    observer = await _connect_and_join(room.code, 'Observer')
    await observer.receive_json_from()

    leaver = await _connect_and_join(room.code, 'Rejoiner')
    await observer.receive_json_from()
    await leaver.receive_json_from()

    await leaver.disconnect()

    # Reconnect zanim grace period się skończy
    rejoined = WebsocketCommunicator(application, f'/ws/room/{room.code}/')
    connected, _ = await rejoined.connect()
    assert connected

    await rejoined.send_json_to({'type': 'rejoin', 'nickname': 'Rejoiner'})

    msg = await asyncio.wait_for(rejoined.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'game_state'
    assert msg['score'] == 42
    assert msg['room_status'] == 'lobby'
    assert msg['current_question'] is None  # gra jeszcze nie wystartowała

    # Observer nie dostał player_left
    assert await observer.receive_nothing(timeout=0.2)

    await rejoined.disconnect()
    await observer.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_grace_period_is_short_for_lobby_rooms():
    """W pokoju w statusie LOBBY player_left ma wyjść szybko — nie 30s."""
    room = await database_sync_to_async(Room.objects.create)(
        code='GRCLB1', status=Room.Status.LOBBY,
    )
    grace = await GameConsumer._get_grace_period_for(room.code)
    assert grace <= 5, f'Expected short lobby grace (≤5s), got {grace}s'


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_grace_period_is_long_for_in_progress_rooms():
    """W pokoju w grze reconnect grace period zostaje długi (30s)."""
    room = await database_sync_to_async(Room.objects.create)(
        code='GRCIP1', status=Room.Status.IN_PROGRESS,
    )
    grace = await GameConsumer._get_grace_period_for(room.code)
    assert grace == 30


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_grace_period_falls_back_when_room_missing():
    """Gdy pokój nie istnieje — stosujemy krótki grace (nie crashujemy)."""
    grace = await GameConsumer._get_grace_period_for('NOEXIS')
    assert grace <= 5
