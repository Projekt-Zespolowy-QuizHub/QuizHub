import asyncio
import pytest
import pytest_asyncio
from django.contrib.auth.models import User
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from quizarena.asgi import application
from apps.rooms.models import Room, Player
from apps.accounts.models import UserProfile, ShopItem, UserItem
from apps.rooms.consumers import (
    GameConsumer,
    _disconnect_tasks,
    _double_points_active,
    _powerups_used,
    _round_tasks,
)


@pytest.fixture(autouse=True)
def use_channel_layers(channel_layers):
    """Apply in-memory channel layer to all tests in this module."""
    pass


@pytest_asyncio.fixture(autouse=True)
async def clear_disconnect_tasks():
    """Ensure no leftover tasks between tests."""
    _disconnect_tasks.clear()
    _round_tasks.clear()
    yield
    for task in list(_disconnect_tasks.values()):
        task.cancel()
    for task in list(_round_tasks.values()):
        task.cancel()
    _disconnect_tasks.clear()
    _round_tasks.clear()


@pytest.fixture
def short_grace(monkeypatch):
    monkeypatch.setattr(GameConsumer, 'GRACE_PERIOD_SECONDS', 0.05)
    monkeypatch.setattr(GameConsumer, 'LOBBY_GRACE_SECONDS', 0.05)


@pytest_asyncio.fixture
async def room():
    return await database_sync_to_async(Room.objects.create)(code='TSTROM')


@pytest.fixture
def fast_rounds(monkeypatch):
    monkeypatch.setattr(GameConsumer, 'START_DELAY_SECONDS', 0.01)
    monkeypatch.setattr(GameConsumer, 'ANSWER_REVEAL_SECONDS', 0.01)
    monkeypatch.setattr(GameConsumer, 'ROUND_DURATION_SECONDS', 1)


@database_sync_to_async
def _create_powerup_user(email: str, powerup_code: str, quantity: int = 1):
    user = User.objects.create_user(email, email, 'pass1234')
    UserProfile.objects.create(user=user, display_name=email.split('@')[0], coins=500)
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


async def _connect_and_join(room_code: str, nickname: str, user=None) -> WebsocketCommunicator:
    comm = WebsocketCommunicator(application, f'/ws/room/{room_code}/')
    if user is not None:
        comm.scope['user'] = user
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


# ─── Testy per-status grace period ────────────────────────────────────────────

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


# ─── Fixtures dla power-upów ──────────────────────────────────────────────────

@pytest_asyncio.fixture
async def clear_powerup_state():
    _powerups_used.clear()
    _double_points_active.clear()
    yield
    _powerups_used.clear()
    _double_points_active.clear()


# ─── Testy chat_message ───────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_message_broadcast(room):
    """chat_message jest rozsyłany do wszystkich w pokoju."""
    alice = await _connect_and_join(room.code, 'Alice')
    await alice.receive_json_from()  # własny player_joined

    bob = await _connect_and_join(room.code, 'Bob')
    await alice.receive_json_from()  # player_joined Bob
    await bob.receive_json_from()    # własny player_joined (Bob)

    await alice.send_json_to({'type': 'chat_message', 'text': 'Cześć!'})

    alice_msg = await asyncio.wait_for(alice.receive_json_from(), timeout=1.0)
    assert alice_msg == {'type': 'chat_message', 'nickname': 'Alice', 'text': 'Cześć!'}

    bob_msg = await asyncio.wait_for(bob.receive_json_from(), timeout=1.0)
    assert bob_msg == {'type': 'chat_message', 'nickname': 'Alice', 'text': 'Cześć!'}

    await alice.disconnect()
    await bob.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_chat_message_max_length(room):
    """Wiadomości dłuższe niż 200 znaków są skracane."""
    player = await _connect_and_join(room.code, 'Player')
    await player.receive_json_from()

    long_text = 'x' * 300
    await player.send_json_to({'type': 'chat_message', 'text': long_text})

    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert len(msg['text']) == 200

    await player.disconnect()


# ─── Testy power-upów ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_powerup_extra_time(room, clear_powerup_state):
    """extra_time power-up odsyła powerup_result z extra_seconds."""
    user = await _create_powerup_user('powerup-extra@test.com', 'extra_time')
    player = await _connect_and_join(room.code, 'Player', user=user)
    await player.receive_json_from()

    await player.send_json_to({
        'type': 'use_powerup',
        'powerup': 'extra_time',
        'nickname': 'Player',
        'round_number': 1,
    })

    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg == {'type': 'powerup_result', 'powerup': 'extra_time', 'extra_seconds': 15, 'remaining_quantity': 0}

    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_powerup_cannot_use_twice(room, clear_powerup_state):
    """Power-up można użyć tylko raz per grę."""
    user = await _create_powerup_user('powerup-twice@test.com', 'extra_time', quantity=2)
    player = await _connect_and_join(room.code, 'Player', user=user)
    await player.receive_json_from()

    await player.send_json_to({
        'type': 'use_powerup',
        'powerup': 'extra_time',
        'nickname': 'Player',
        'round_number': 1,
    })
    msg = await asyncio.wait_for(player.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'powerup_result'
    assert msg['remaining_quantity'] == 1

    # Drugi raz — brak odpowiedzi
    await player.send_json_to({
        'type': 'use_powerup',
        'powerup': 'extra_time',
        'nickname': 'Player',
        'round_number': 1,
    })
    assert await player.receive_nothing(timeout=0.2)

    await player.disconnect()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_single_player_answer_advances_to_next_question(room, fast_rounds, monkeypatch):
    room.total_rounds = 2
    await database_sync_to_async(room.save)()
    await database_sync_to_async(Player.objects.create)(room=room, nickname='Solo')

    questions = iter([
        {
            'question': 'Pytanie 1?',
            'options': ['A1', 'B1', 'C1', 'D1'],
            'correct': 'A',
            'explanation': 'Wyjasnienie 1',
        },
        {
            'question': 'Pytanie 2?',
            'options': ['A2', 'B2', 'C2', 'D2'],
            'correct': 'B',
            'explanation': 'Wyjasnienie 2',
        },
    ])

    async def fake_generate(self, category, used_questions, max_retries=3):
        return next(questions)

    monkeypatch.setattr('apps.ai.generator.QuestionGenerator.generate', fake_generate)

    comm = await _connect_and_join(room.code, 'Solo')
    await comm.receive_json_from()

    await comm.send_json_to({'type': 'start_game'})
    msg = await asyncio.wait_for(comm.receive_json_from(), timeout=1.0)
    assert msg['type'] == 'game_start'

    first_question = await asyncio.wait_for(comm.receive_json_from(), timeout=1.0)
    assert first_question['type'] == 'question'
    assert first_question['round_number'] == 1
    assert first_question['question'] == 'Pytanie 1?'

    await comm.send_json_to({
        'type': 'answer',
        'nickname': 'Solo',
        'answer': 'A',
        'response_time_ms': 1000,
        'round_number': 1,
    })

    result = await asyncio.wait_for(comm.receive_json_from(), timeout=1.0)
    assert result['type'] == 'answer_result'
    assert result['is_correct'] is True

    second_question = await asyncio.wait_for(comm.receive_json_from(), timeout=1.0)
    assert second_question['type'] == 'question'
    assert second_question['round_number'] == 2
    assert second_question['question'] == 'Pytanie 2?'

    await comm.disconnect()
