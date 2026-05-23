import asyncio

import pytest
import pytest_asyncio
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.core.cache import cache

from apps.accounts.models import ShopItem, UserItem, UserProfile
from apps.rooms.consumers import _disconnect_tasks, _double_points_active, _powerups_used
from apps.rooms.models import Question, Room
from quizarena.asgi import application


@pytest.fixture(autouse=True)
def use_channel_layers(channel_layers):
    pass


@pytest_asyncio.fixture(autouse=True)
async def clear_state():
    _disconnect_tasks.clear()
    _powerups_used.clear()
    _double_points_active.clear()
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
    question = await database_sync_to_async(Question.objects.create)(
        room=room,
        round_number=1,
        content='Ile to 2+2?',
        options={'A': '3', 'B': '4', 'C': '5', 'D': '6'},
        correct_answer='B',
    )
    return room, question


@database_sync_to_async
def create_user_with_powerup(email: str, powerup_code: str | None = None, quantity: int = 0):
    user = User.objects.create_user(email, email, 'pass1234')
    UserProfile.objects.create(user=user, display_name=email.split('@')[0], coins=500)
    if powerup_code:
        item = ShopItem.objects.create(
            code=powerup_code,
            name=powerup_code,
            description='Test power-up',
            item_type='powerup',
            price=50,
            emoji_icon='⚡',
            is_active=True,
        )
        UserItem.objects.create(user=user, item=item, quantity=quantity)
    return user


@database_sync_to_async
def get_quantity(user_id: int, code: str) -> int:
    return UserItem.objects.get(user_id=user_id, item__code=code).quantity


async def join(room_code: str, nickname: str, user) -> WebsocketCommunicator:
    communicator = WebsocketCommunicator(application, f'/ws/room/{room_code}/')
    communicator.scope['user'] = user
    connected, _ = await communicator.connect()
    assert connected
    await communicator.send_json_to({'type': 'join', 'nickname': nickname})
    await communicator.receive_json_from()
    return communicator


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_extra_time_consumes_inventory(room):
    user = await create_user_with_powerup('extra@test.com', 'extra_time', quantity=1)
    player = await join(room.code, 'Tester', user)

    await player.send_json_to({'type': 'use_powerup', 'powerup': 'extra_time', 'nickname': 'Tester', 'round_number': 1})
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)

    assert msg == {
        'type': 'powerup_result',
        'powerup': 'extra_time',
        'extra_seconds': 15,
        'remaining_quantity': 0,
    }
    assert await get_quantity(user.id, 'extra_time') == 0
    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_double_points_consumes_inventory(room):
    user = await create_user_with_powerup('double@test.com', 'double_points', quantity=1)
    player = await join(room.code, 'Tester', user)

    await player.send_json_to({'type': 'use_powerup', 'powerup': 'double_points', 'nickname': 'Tester', 'round_number': 1})
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)

    assert msg == {
        'type': 'powerup_result',
        'powerup': 'double_points',
        'remaining_quantity': 0,
    }
    assert await get_quantity(user.id, 'double_points') == 0
    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_fifty_fifty_consumes_inventory(room_with_question):
    room, _question = room_with_question
    user = await create_user_with_powerup('fifty@test.com', 'fifty_fifty', quantity=1)
    player = await join(room.code, 'Tester', user)

    await player.send_json_to({'type': 'use_powerup', 'powerup': 'fifty_fifty', 'nickname': 'Tester', 'round_number': 1})
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)

    assert msg['type'] == 'powerup_result'
    assert msg['powerup'] == 'fifty_fifty'
    assert len(msg['removed_options']) == 2
    assert msg['remaining_quantity'] == 0
    assert 'B' not in msg['removed_options']
    assert await get_quantity(user.id, 'fifty_fifty') == 0
    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_powerup_without_inventory_returns_error(room):
    user = await create_user_with_powerup('empty@test.com')
    player = await join(room.code, 'Tester', user)

    await player.send_json_to({'type': 'use_powerup', 'powerup': 'extra_time', 'nickname': 'Tester', 'round_number': 1})
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)

    assert msg['type'] == 'error'
    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_same_powerup_still_blocked_twice_per_match(room):
    user = await create_user_with_powerup('twice@test.com', 'extra_time', quantity=2)
    player = await join(room.code, 'Tester', user)

    await player.send_json_to({'type': 'use_powerup', 'powerup': 'extra_time', 'nickname': 'Tester', 'round_number': 1})
    first = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert first['type'] == 'powerup_result'
    assert first['remaining_quantity'] == 1

    await player.send_json_to({'type': 'use_powerup', 'powerup': 'extra_time', 'nickname': 'Tester', 'round_number': 2})
    assert await player.receive_nothing(timeout=0.3)
    assert await get_quantity(user.id, 'extra_time') == 1
    await player.disconnect()
