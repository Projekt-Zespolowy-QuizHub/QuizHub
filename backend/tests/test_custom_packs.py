"""
Testy paczek pytań (QuestionPack, CustomQuestion).

Pokrycie:
- CRUD paczki: create, get, update, delete
- CRUD pytań w paczce: add, update, delete
- Twórca zablokowany przed graniem własną paczką (create_room i join_room)
- Prawa dostępu: inny user nie może edytować/usunąć cudzej paczki
- Paczka prywatna niewidoczna dla innych
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile
from apps.rooms.models import QuestionPack, CustomQuestion, Room, Player


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def user_a(db):
    user = User.objects.create_user('a@packs.com', 'a@packs.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='PackCreator')
    return user


@pytest.fixture
def user_b(db):
    user = User.objects.create_user('b@packs.com', 'b@packs.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='OtherUser')
    return user


@pytest.fixture
def client_a(user_a):
    c = APIClient()
    c.force_authenticate(user=user_a)
    return c


@pytest.fixture
def client_b(user_b):
    c = APIClient()
    c.force_authenticate(user=user_b)
    return c


@pytest.fixture
def pack_a(user_a):
    return QuestionPack.objects.create(
        name='Moja Paczka',
        description='Opis',
        is_public=False,
        created_by=user_a,
    )


@pytest.fixture
def public_pack(user_b):
    return QuestionPack.objects.create(
        name='Publiczna Paczka',
        description='',
        is_public=True,
        created_by=user_b,
    )


# ─── Pack CRUD ────────────────────────────────────────────────────────────────

def test_create_pack(client_a):
    resp = client_a.post('/api/packs/create/', {
        'name': 'Nowa Paczka',
        'description': 'Test',
        'is_public': False,
    }, format='json')
    assert resp.status_code == 201
    assert resp.data['name'] == 'Nowa Paczka'
    assert QuestionPack.objects.filter(name='Nowa Paczka').exists()


def test_create_pack_requires_name(client_a):
    resp = client_a.post('/api/packs/create/', {'name': ''}, format='json')
    assert resp.status_code == 400


def test_create_pack_requires_auth():
    c = APIClient()
    resp = c.post('/api/packs/create/', {'name': 'X'}, format='json')
    assert resp.status_code == 403


def test_list_packs_own_and_public(client_a, pack_a, public_pack):
    resp = client_a.get('/api/packs/')
    assert resp.status_code == 200
    names = {p['name'] for p in resp.data}
    assert 'Moja Paczka' in names
    assert 'Publiczna Paczka' in names


def test_list_packs_excludes_private_of_others(client_a, user_b):
    QuestionPack.objects.create(name='Prywatna B', is_public=False, created_by=user_b)
    resp = client_a.get('/api/packs/')
    assert resp.status_code == 200
    names = {p['name'] for p in resp.data}
    assert 'Prywatna B' not in names


def test_get_pack_detail_owner(client_a, pack_a):
    resp = client_a.get(f'/api/packs/{pack_a.id}/')
    assert resp.status_code == 200
    assert resp.data['name'] == 'Moja Paczka'
    assert resp.data['is_mine'] is True


def test_get_pack_detail_public_by_other(client_b, pack_a, public_pack):
    resp = client_b.get(f'/api/packs/{public_pack.id}/')
    assert resp.status_code == 200


def test_get_pack_detail_private_by_other_forbidden(client_b, pack_a):
    resp = client_b.get(f'/api/packs/{pack_a.id}/')
    assert resp.status_code == 403


def test_update_pack_name(client_a, pack_a):
    resp = client_a.patch(f'/api/packs/{pack_a.id}/', {'name': 'Zaktualizowana'}, format='json')
    assert resp.status_code == 200
    pack_a.refresh_from_db()
    assert pack_a.name == 'Zaktualizowana'


def test_update_pack_by_other_forbidden(client_b, pack_a):
    resp = client_b.patch(f'/api/packs/{pack_a.id}/', {'name': 'Hack'}, format='json')
    assert resp.status_code == 403


def test_delete_pack(client_a, pack_a):
    resp = client_a.delete(f'/api/packs/{pack_a.id}/')
    assert resp.status_code == 204
    assert not QuestionPack.objects.filter(id=pack_a.id).exists()


def test_delete_pack_by_other_forbidden(client_b, pack_a):
    resp = client_b.delete(f'/api/packs/{pack_a.id}/')
    assert resp.status_code == 403


# ─── Questions CRUD ───────────────────────────────────────────────────────────

def test_add_question_to_pack(client_a, pack_a):
    resp = client_a.post(f'/api/packs/{pack_a.id}/questions/', {
        'question_text': 'Ile to 2+2?',
        'answers': ['3', '4', '5', '6'],
        'correct_index': 1,
        'image_emoji': '🔢',
    }, format='json')
    assert resp.status_code == 201
    assert resp.data['question_text'] == 'Ile to 2+2?'
    assert CustomQuestion.objects.filter(pack=pack_a).count() == 1


def test_add_question_requires_4_answers(client_a, pack_a):
    resp = client_a.post(f'/api/packs/{pack_a.id}/questions/', {
        'question_text': 'Pytanie?',
        'answers': ['A', 'B'],
        'correct_index': 0,
    }, format='json')
    assert resp.status_code == 400


def test_add_question_invalid_correct_index(client_a, pack_a):
    resp = client_a.post(f'/api/packs/{pack_a.id}/questions/', {
        'question_text': 'Pytanie?',
        'answers': ['A', 'B', 'C', 'D'],
        'correct_index': 5,
    }, format='json')
    assert resp.status_code == 400


def test_add_question_requires_question_text(client_a, pack_a):
    resp = client_a.post(f'/api/packs/{pack_a.id}/questions/', {
        'question_text': '',
        'answers': ['A', 'B', 'C', 'D'],
        'correct_index': 0,
    }, format='json')
    assert resp.status_code == 400


def test_add_question_by_other_user_forbidden(client_b, pack_a):
    resp = client_b.post(f'/api/packs/{pack_a.id}/questions/', {
        'question_text': 'Hack?',
        'answers': ['A', 'B', 'C', 'D'],
        'correct_index': 0,
    }, format='json')
    assert resp.status_code == 404


def test_update_question(client_a, pack_a):
    q = CustomQuestion.objects.create(
        pack=pack_a,
        question_text='Stare pytanie',
        answers=['A', 'B', 'C', 'D'],
        correct_index=0,
    )
    resp = client_a.patch(f'/api/packs/{pack_a.id}/questions/{q.id}/', {
        'question_text': 'Nowe pytanie',
    }, format='json')
    assert resp.status_code == 200
    q.refresh_from_db()
    assert q.question_text == 'Nowe pytanie'


def test_delete_question(client_a, pack_a):
    q = CustomQuestion.objects.create(
        pack=pack_a,
        question_text='Do usunięcia',
        answers=['A', 'B', 'C', 'D'],
        correct_index=0,
    )
    resp = client_a.delete(f'/api/packs/{pack_a.id}/questions/{q.id}/')
    assert resp.status_code == 204
    assert not CustomQuestion.objects.filter(id=q.id).exists()


# ─── Creator blocked from playing own pack ────────────────────────────────────

def test_creator_blocked_from_creating_room_with_own_pack(client_a, pack_a):
    resp = client_a.post('/api/rooms/', {
        'host_nickname': 'PackCreator',
        'categories': [],
        'total_rounds': 5,
        'pack_id': pack_a.id,
    }, format='json')
    assert resp.status_code == 400


def test_creator_blocked_from_joining_room_with_own_pack(user_a, user_b, pack_a):
    """Twórca paczki nie może dołączyć do pokoju korzystającego z jego paczki."""
    client_b = APIClient()
    client_b.force_authenticate(user=user_b)
    # user_b tworzy pokój z paczką user_a
    resp = client_b.post('/api/rooms/', {
        'host_nickname': 'OtherUser',
        'categories': [],
        'total_rounds': 5,
        'pack_id': pack_a.id,
    }, format='json')
    assert resp.status_code == 201
    code = resp.data['room_code']

    # user_a (twórca paczki) próbuje dołączyć
    client_a = APIClient()
    client_a.force_authenticate(user=user_a)
    resp = client_a.post('/api/rooms/join/', {
        'nickname': 'PackCreator',
        'room_code': code,
    }, format='json')
    assert resp.status_code == 400


def test_non_creator_can_create_room_with_pack(client_b, pack_a):
    resp = client_b.post('/api/rooms/', {
        'host_nickname': 'OtherUser',
        'categories': [],
        'total_rounds': 5,
        'pack_id': pack_a.id,
    }, format='json')
    assert resp.status_code == 201
