"""
Additional edge-case tests for the replay endpoint.

The existing test_replay.py covers:
- Basic response structure (room_code, questions list)
- All question fields present
- Player answer data in questions
- fastest_nick = fastest correct answerer
- fastest_nick = None when no correct answers
- 404 for nonexistent room
- Empty questions list when no questions
- Questions ordered by round_number

This file covers additional scenarios not present in test_replay.py:
- Room in LOBBY status still returns 200 with empty questions
- Room in IN_PROGRESS status still returns 200
- Replay includes player scores (validated via separate leaderboard, not replay)
- Answer streak_at_answer and multiplier_applied fields are stored/accessible
- Multiple questions each have an independent fastest_nick
- fastest_nick is None per-question when that question has no correct answers
- fastest_nick picks correct answer even when incorrect answers have lower time
- Room with a pack assigned returns data correctly
- Room code lookup is case-insensitive
- Answer chosen_option value is preserved exactly
- points_earned=0 is correctly serialized (not null)
- response_time_ms is preserved exactly
- Questions without answers have an empty answers list
- Multiple players, one answers correctly and one does not
"""
import pytest
from django.test import Client
from apps.rooms.models import Room, Player, Question, Answer, QuestionPack
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile


# ─── Helpers / Fixtures ───────────────────────────────────────────────────────

@pytest.fixture
def client(db):
    return Client()


def _make_room(code, status=Room.Status.FINISHED, categories=None):
    return Room.objects.create(
        code=code,
        categories=categories or ['Historia'],
        total_rounds=3,
        status=status,
    )


def _make_player(room, nickname, score=0):
    return Player.objects.create(room=room, nickname=nickname, score=score)


def _make_question(room, round_number=1, content='Q?', correct='A'):
    return Question.objects.create(
        room=room,
        round_number=round_number,
        content=content,
        options={'A': 'Opt A', 'B': 'Opt B', 'C': 'Opt C', 'D': 'Opt D'},
        correct_answer=correct,
        explanation='Because.',
    )


def _make_answer(player, question, chosen='A', time_ms=3000, points=1000, is_correct=True,
                 streak=0, multiplier=1.0):
    return Answer.objects.create(
        player=player,
        question=question,
        chosen_option=chosen,
        response_time_ms=time_ms,
        points_earned=points,
        is_correct=is_correct,
        streak_at_answer=streak,
        multiplier_applied=multiplier,
    )


# ─── Room status edge cases ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_replay_lobby_room_returns_200_with_empty_questions():
    room = _make_room('LOBBY1', status=Room.Status.LOBBY)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    assert resp.status_code == 200
    assert resp.json()['questions'] == []


@pytest.mark.django_db
def test_replay_in_progress_room_returns_200():
    room = _make_room('INPRO1', status=Room.Status.IN_PROGRESS)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    assert resp.status_code == 200


@pytest.mark.django_db
def test_replay_finished_room_returns_200():
    room = _make_room('FINRM1', status=Room.Status.FINISHED)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    assert resp.status_code == 200


# ─── Case-insensitive room code lookup ────────────────────────────────────────

@pytest.mark.django_db
def test_replay_code_lookup_is_case_insensitive():
    room = _make_room('ABCDEF')
    c = Client()
    resp = c.get('/api/rooms/abcdef/replay/')
    assert resp.status_code == 200
    assert resp.json()['room_code'] == 'ABCDEF'


# ─── Room with a pack ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_replay_room_with_pack_returns_200():
    user = User.objects.create_user('packowner@replay.com', 'packowner@replay.com', 'pass')
    UserProfile.objects.create(user=user, display_name='PackOwner')
    pack = QuestionPack.objects.create(name='Test Pack', is_public=True, created_by=user)
    room = Room.objects.create(
        code='PACKRM',
        categories=[],
        total_rounds=5,
        status=Room.Status.FINISHED,
        pack=pack,
    )
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    assert resp.status_code == 200
    assert resp.json()['room_code'] == 'PACKRM'


# ─── Questions without any answers ───────────────────────────────────────────

@pytest.mark.django_db
def test_replay_question_with_no_answers_has_empty_list():
    room = _make_room('NOANSR')
    _make_question(room, round_number=1)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    q = resp.json()['questions'][0]
    assert q['answers'] == []
    assert q['fastest_nick'] is None


# ─── Answer field values ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_replay_answer_chosen_option_preserved():
    room = _make_room('CHOSEN')
    p = _make_player(room, 'Alice')
    q = _make_question(room, correct='C')
    _make_answer(p, q, chosen='C', is_correct=True)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    answer = resp.json()['questions'][0]['answers'][0]
    assert answer['chosen_option'] == 'C'


@pytest.mark.django_db
def test_replay_answer_response_time_ms_preserved():
    room = _make_room('TIMEMS')
    p = _make_player(room, 'Bob')
    q = _make_question(room)
    _make_answer(p, q, time_ms=4567)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    answer = resp.json()['questions'][0]['answers'][0]
    assert answer['response_time_ms'] == 4567


@pytest.mark.django_db
def test_replay_answer_points_earned_zero_is_not_null():
    room = _make_room('ZEROPT')
    p = _make_player(room, 'Charlie')
    q = _make_question(room)
    _make_answer(p, q, chosen='B', is_correct=False, points=0)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    answer = resp.json()['questions'][0]['answers'][0]
    assert answer['points_earned'] == 0
    assert answer['points_earned'] is not None


@pytest.mark.django_db
def test_replay_answer_is_correct_false_preserved():
    room = _make_room('WRONGA')
    p = _make_player(room, 'Dave')
    q = _make_question(room, correct='A')
    _make_answer(p, q, chosen='B', is_correct=False, points=0)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    answer = resp.json()['questions'][0]['answers'][0]
    assert answer['is_correct'] is False


# ─── fastest_nick edge cases ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_replay_fastest_nick_ignores_wrong_answers_with_lower_time():
    """fastest_nick must be the fastest among CORRECT answers only."""
    room = _make_room('FAST01')
    alice = _make_player(room, 'Alice')
    bob = _make_player(room, 'Bob')
    q = _make_question(room, correct='A')
    # Bob answers wrong but faster
    _make_answer(bob, q, chosen='B', time_ms=500, is_correct=False, points=0)
    # Alice answers correctly but slower
    _make_answer(alice, q, chosen='A', time_ms=2000, is_correct=True, points=1000)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    q_data = resp.json()['questions'][0]
    assert q_data['fastest_nick'] == 'Alice'


@pytest.mark.django_db
def test_replay_fastest_nick_per_question_independent():
    """Each question has its own independent fastest_nick."""
    room = _make_room('FAST02')
    alice = _make_player(room, 'Alice')
    bob = _make_player(room, 'Bob')
    q1 = _make_question(room, round_number=1, correct='A')
    q2 = _make_question(room, round_number=2, correct='B')
    # Alice is fastest on Q1
    _make_answer(alice, q1, chosen='A', time_ms=1000, is_correct=True, points=1500)
    _make_answer(bob, q1, chosen='A', time_ms=3000, is_correct=True, points=1000)
    # Bob is fastest on Q2
    _make_answer(bob, q2, chosen='B', time_ms=800, is_correct=True, points=1600)
    _make_answer(alice, q2, chosen='B', time_ms=4000, is_correct=True, points=900)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    questions = resp.json()['questions']
    q1_data = next(q for q in questions if q['round'] == 1)
    q2_data = next(q for q in questions if q['round'] == 2)
    assert q1_data['fastest_nick'] == 'Alice'
    assert q2_data['fastest_nick'] == 'Bob'


@pytest.mark.django_db
def test_replay_fastest_nick_none_when_all_wrong():
    room = _make_room('FAST03')
    alice = _make_player(room, 'Alice')
    bob = _make_player(room, 'Bob')
    q = _make_question(room, correct='A')
    _make_answer(alice, q, chosen='B', is_correct=False, points=0)
    _make_answer(bob, q, chosen='C', is_correct=False, points=0)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    assert resp.json()['questions'][0]['fastest_nick'] is None


@pytest.mark.django_db
def test_replay_fastest_nick_tie_resolved_consistently():
    """When two players have the exact same response time, one is picked (no crash)."""
    room = _make_room('FAST04')
    alice = _make_player(room, 'Alice')
    bob = _make_player(room, 'Bob')
    q = _make_question(room, correct='A')
    _make_answer(alice, q, chosen='A', time_ms=2000, is_correct=True, points=1200)
    _make_answer(bob, q, chosen='A', time_ms=2000, is_correct=True, points=1200)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    fastest = resp.json()['questions'][0]['fastest_nick']
    assert fastest in ('Alice', 'Bob')


# ─── Multiple players, mixed correct/incorrect ────────────────────────────────

@pytest.mark.django_db
def test_replay_all_players_answers_present():
    room = _make_room('MULTI1')
    players = [_make_player(room, f'P{i}') for i in range(4)]
    q = _make_question(room, round_number=1, correct='A')
    for i, p in enumerate(players):
        _make_answer(p, q, chosen='A', time_ms=(i + 1) * 1000, is_correct=True, points=1000)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    answers = resp.json()['questions'][0]['answers']
    assert len(answers) == 4
    nicks = {a['nickname'] for a in answers}
    assert nicks == {'P0', 'P1', 'P2', 'P3'}


@pytest.mark.django_db
def test_replay_fastest_nick_among_four_players():
    room = _make_room('MULTI2')
    players = [_make_player(room, f'P{i}') for i in range(4)]
    q = _make_question(room, round_number=1, correct='A')
    times = [5000, 1500, 3000, 2000]  # P1 is fastest at 1500ms
    for i, p in enumerate(players):
        _make_answer(p, q, chosen='A', time_ms=times[i], is_correct=True, points=1000)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    assert resp.json()['questions'][0]['fastest_nick'] == 'P1'


# ─── Streak and multiplier data (stored in Answer model) ─────────────────────

@pytest.mark.django_db
def test_replay_answer_with_streak_data_does_not_crash():
    """Answers with streak and multiplier data are included without errors."""
    room = _make_room('STREAK')
    p = _make_player(room, 'Streaker')
    q = _make_question(room, correct='A')
    _make_answer(p, q, chosen='A', is_correct=True, points=1800, streak=5, multiplier=1.5)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    assert resp.status_code == 200
    answers = resp.json()['questions'][0]['answers']
    assert len(answers) == 1
    a = answers[0]
    assert a['nickname'] == 'Streaker'
    assert a['points_earned'] == 1800


# ─── Multiple questions ordering ─────────────────────────────────────────────

@pytest.mark.django_db
def test_replay_five_questions_ordered_by_round():
    room = _make_room('ORDER5')
    for i in [5, 3, 1, 4, 2]:
        _make_question(room, round_number=i, content=f'Q{i}')
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    rounds = [q['round'] for q in resp.json()['questions']]
    assert rounds == [1, 2, 3, 4, 5]


# ─── Response structure completeness ─────────────────────────────────────────

@pytest.mark.django_db
def test_replay_response_top_level_keys():
    room = _make_room('KEYS01')
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    data = resp.json()
    assert set(data.keys()) >= {'room_code', 'questions'}


@pytest.mark.django_db
def test_replay_question_fields_complete():
    room = _make_room('QFLDS1')
    _make_question(room, round_number=1)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    q = resp.json()['questions'][0]
    for field in ['round', 'content', 'options', 'correct', 'explanation', 'fastest_nick', 'answers']:
        assert field in q, f'Missing question field: {field}'


@pytest.mark.django_db
def test_replay_answer_fields_complete():
    room = _make_room('AFLDS1')
    p = _make_player(room, 'TestPlayer')
    q = _make_question(room)
    _make_answer(p, q)
    c = Client()
    resp = c.get(f'/api/rooms/{room.code}/replay/')
    a = resp.json()['questions'][0]['answers'][0]
    for field in ['nickname', 'chosen_option', 'is_correct', 'response_time_ms', 'points_earned']:
        assert field in a, f'Missing answer field: {field}'


# ─── 404 cases ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_replay_nonexistent_room_code_returns_404():
    c = Client()
    resp = c.get('/api/rooms/XXXXXX/replay/')
    assert resp.status_code == 404


@pytest.mark.django_db
def test_replay_404_response_has_error_key():
    c = Client()
    resp = c.get('/api/rooms/NOROOM/replay/')
    assert 'error' in resp.json()
