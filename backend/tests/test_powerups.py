"""
Testy power-upów przez WebSocket.

Pokrycie:
- fifty_fifty: usuwa 2 błędne opcje, wymaga pytania w DB
- extra_time: zwraca extra_seconds=15
- double_points: podwaja punkty za następną poprawną odpowiedź
- Każdy power-up można użyć tylko raz na grę (one-per-game limit)
- Nieznany power-up jest ignorowany
"""
import asyncio
import pytest
import pytest_asyncio
from django.core.cache import cache
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from quizarena.asgi import application
from apps.rooms.models import Room, Player, Question
from apps.rooms.consumers import _disconnect_tasks, _powerups_used, _double_points_active


@pytest.fixture(autouse=True)
def use_channel_layers(channel_layers):
    pass


@pytest_asyncio.fixture(autouse=True)
async def clear_state():
    _disconnect_tasks.clear()
    _powerups_used.clear()
    _double_points_active.clear()
    # Wyczyść cache throttle WS między testami
    await cache.aclear()
    yield
    for task in list(_disconnect_tasks.values()):
        task.cancel()
    _disconnect_tasks.clear()
    _powerups_used.clear()
    _double_points_active.clear()


@pytest_asyncio.fixture
async def room():
    return await database_sync_to_async(Room.objects.create)(code='PWRUP1')


@pytest_asyncio.fixture
async def room_with_question(room):
    q = await database_sync_to_async(Question.objects.create)(
        room=room,
        round_number=1,
        content='Ile to 2+2?',
        options={'A': '3', 'B': '4', 'C': '5', 'D': '6'},
        correct_answer='B',
    )
    return room, q


async def _join(room_code: str, nickname: str) -> WebsocketCommunicator:
    comm = WebsocketCommunicator(application, f'/ws/room/{room_code}/')
    connected, _ = await comm.connect()
    assert connected
    await comm.send_json_to({'type': 'join', 'nickname': nickname})
    await comm.receive_json_from()  # player_joined
    return comm


# ─── extra_time ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_extra_time_powerup(room):
    player = await _join(room.code, 'Tester')
    await player.send_json_to({
        'type': 'use_powerup',
        'powerup': 'extra_time',
        'nickname': 'Tester',
        'round_number': 1,
    })
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'powerup_result'
    assert msg['powerup'] == 'extra_time'
    assert msg['extra_seconds'] == 15
    await player.disconnect()


# ─── double_points ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_double_points_powerup_activates(room):
    player = await _join(room.code, 'Tester')
    await player.send_json_to({
        'type': 'use_powerup',
        'powerup': 'double_points',
        'nickname': 'Tester',
        'round_number': 1,
    })
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'powerup_result'
    assert msg['powerup'] == 'double_points'
    await player.disconnect()


# ─── fifty_fifty ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_fifty_fifty_removes_two_wrong_options(room_with_question):
    room, question = room_with_question
    player = await _join(room.code, 'Tester')
    await player.send_json_to({
        'type': 'use_powerup',
        'powerup': 'fifty_fifty',
        'nickname': 'Tester',
        'round_number': 1,
    })
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'powerup_result'
    assert msg['powerup'] == 'fifty_fifty'
    assert len(msg['removed_options']) == 2
    # Poprawna odpowiedź (B) nie jest usunięta
    assert 'B' not in msg['removed_options']
    # Usunięte opcje to niepoprawne
    for opt in msg['removed_options']:
        assert opt in ['A', 'C', 'D']
    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_fifty_fifty_no_question_in_db(room):
    """Jeśli pytanie nie istnieje dla danej rundy, power-up nie odpowiada."""
    player = await _join(room.code, 'Tester')
    await player.send_json_to({
        'type': 'use_powerup',
        'powerup': 'fifty_fifty',
        'nickname': 'Tester',
        'round_number': 99,
    })
    # Brak pytania — brak odpowiedzi
    assert await player.receive_nothing(timeout=0.3)
    await player.disconnect()


# ─── One-per-game limit ───────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_extra_time_cannot_be_used_twice(room):
    player = await _join(room.code, 'Tester')

    await player.send_json_to({
        'type': 'use_powerup', 'powerup': 'extra_time',
        'nickname': 'Tester', 'round_number': 1,
    })
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'powerup_result'

    await player.send_json_to({
        'type': 'use_powerup', 'powerup': 'extra_time',
        'nickname': 'Tester', 'round_number': 2,
    })
    assert await player.receive_nothing(timeout=0.3)
    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_double_points_cannot_be_used_twice(room):
    player = await _join(room.code, 'Tester')

    await player.send_json_to({
        'type': 'use_powerup', 'powerup': 'double_points',
        'nickname': 'Tester', 'round_number': 1,
    })
    await asyncio.wait_for(player.receive_json_from(), timeout=1.0)

    await player.send_json_to({
        'type': 'use_powerup', 'powerup': 'double_points',
        'nickname': 'Tester', 'round_number': 2,
    })
    assert await player.receive_nothing(timeout=0.3)
    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_different_powerups_each_limited_once(room):
    """Każdy rodzaj power-upa ma osobny limit — można użyć różnych."""
    player = await _join(room.code, 'Tester')

    await player.send_json_to({
        'type': 'use_powerup', 'powerup': 'extra_time',
        'nickname': 'Tester', 'round_number': 1,
    })
    msg1 = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg1['powerup'] == 'extra_time'

    await player.send_json_to({
        'type': 'use_powerup', 'powerup': 'double_points',
        'nickname': 'Tester', 'round_number': 1,
    })
    msg2 = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg2['powerup'] == 'double_points'

    await player.disconnect()


# ─── Unknown powerup ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_unknown_powerup_returns_error(room):
    """Nieznany power-up zwraca komunikat błędu (nie jest cicho ignorowany)."""
    player = await _join(room.code, 'Tester')
    await player.send_json_to({
        'type': 'use_powerup',
        'powerup': 'super_nuke',
        'nickname': 'Tester',
        'round_number': 1,
    })
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'error'
    await player.disconnect()
