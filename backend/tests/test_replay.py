"""
Testy endpointu replay gry.

Pokrycie:
- GET /api/rooms/<code>/replay/ zwraca poprawną strukturę
- Zawiera pytania z odpowiedziami wszystkich graczy
- correct_answer i explanation zawarte w danych
- fastest_nick wskazuje na gracza z najszybszą poprawną odpowiedzią
- Nieistniejący kod pokoju → 404
- Pokój bez pytań → pusta lista
"""
import pytest
from django.test import Client
from apps.rooms.models import Room, Player, Question, Answer


@pytest.fixture
def finished_room(db):
    return Room.objects.create(
        code='REPLAY',
        categories=['Historia'],
        total_rounds=3,
        status=Room.Status.FINISHED,
    )


@pytest.fixture
def players(finished_room):
    p1 = Player.objects.create(room=finished_room, nickname='Alice', score=3000)
    p2 = Player.objects.create(room=finished_room, nickname='Bob', score=2000)
    return p1, p2


@pytest.fixture
def questions(finished_room):
    return [
        Question.objects.create(
            room=finished_room,
            round_number=i,
            content=f'Pytanie {i}',
            options={'A': 'O1', 'B': 'O2', 'C': 'O3', 'D': 'O4'},
            correct_answer='A',
            explanation=f'Wyjaśnienie {i}',
        )
        for i in range(1, 4)
    ]


# ─── Basic structure ──────────────────────────────────────────────────────────

def test_replay_returns_room_code(finished_room, players, questions):
    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['room_code'] == finished_room.code
    assert 'questions' in data


def test_replay_contains_all_questions(finished_room, players, questions):
    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    data = resp.json()
    assert len(data['questions']) == 3


def test_replay_question_has_required_fields(finished_room, players, questions):
    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    q = resp.json()['questions'][0]
    for field in ['round', 'content', 'options', 'correct', 'explanation', 'answers']:
        assert field in q, f'Brak pola {field!r} w pytaniu'


def test_replay_answers_contain_player_data(finished_room, players, questions):
    p1, p2 = players
    q = questions[0]
    Answer.objects.create(
        player=p1, question=q,
        chosen_option='A', response_time_ms=3000,
        points_earned=1250, is_correct=True,
    )
    Answer.objects.create(
        player=p2, question=q,
        chosen_option='B', response_time_ms=5000,
        points_earned=0, is_correct=False,
    )

    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    q_data = resp.json()['questions'][0]
    assert len(q_data['answers']) == 2
    nicks = {a['nickname'] for a in q_data['answers']}
    assert nicks == {'Alice', 'Bob'}


def test_replay_answer_has_correct_fields(finished_room, players, questions):
    p1, _ = players
    Answer.objects.create(
        player=p1, question=questions[0],
        chosen_option='A', response_time_ms=2000,
        points_earned=1300, is_correct=True,
    )
    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    answer = resp.json()['questions'][0]['answers'][0]
    for field in ['nickname', 'chosen_option', 'is_correct', 'response_time_ms', 'points_earned']:
        assert field in answer


# ─── fastest_nick ─────────────────────────────────────────────────────────────

def test_replay_fastest_nick_is_fastest_correct(finished_room, players, questions):
    p1, p2 = players
    q = questions[0]
    Answer.objects.create(
        player=p1, question=q,
        chosen_option='A', response_time_ms=2000,
        points_earned=1300, is_correct=True,
    )
    Answer.objects.create(
        player=p2, question=q,
        chosen_option='A', response_time_ms=5000,
        points_earned=1000, is_correct=True,
    )

    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    q_data = resp.json()['questions'][0]
    assert q_data['fastest_nick'] == 'Alice'


def test_replay_fastest_nick_none_when_no_correct(finished_room, players, questions):
    p1, _ = players
    q = questions[0]
    Answer.objects.create(
        player=p1, question=q,
        chosen_option='B', response_time_ms=1000,
        points_earned=0, is_correct=False,
    )

    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    q_data = resp.json()['questions'][0]
    assert q_data['fastest_nick'] is None


# ─── Edge cases ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_replay_nonexistent_room():
    client = Client()
    resp = client.get('/api/rooms/NOROOM/replay/')
    assert resp.status_code == 404


def test_replay_room_with_no_questions(finished_room):
    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    assert resp.status_code == 200
    assert resp.json()['questions'] == []


def test_replay_questions_ordered_by_round(finished_room, players):
    # Twórz pytania w odwrotnej kolejności
    for i in [3, 1, 2]:
        Question.objects.create(
            room=finished_room, round_number=i,
            content=f'Q{i}', options={}, correct_answer='A',
        )
    client = Client()
    resp = client.get(f'/api/rooms/{finished_room.code}/replay/')
    rounds = [q['round'] for q in resp.json()['questions']]
    assert rounds == [1, 2, 3]
