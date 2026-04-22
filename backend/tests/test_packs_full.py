"""
Comprehensive tests for Question Pack endpoints.

Coverage beyond test_custom_packs.py:
- Pack creation response shape (id field present)
- Pack creation with is_public=True
- Pack list is_mine flag correctness per entry
- Pack list question_count reflects actual questions
- Pack detail 404 for non-existent pack
- Pack detail includes questions list
- Pack detail question fields (id, question_text, answers, correct_index, image_emoji)
- Update pack description
- Update pack is_public flag
- Update pack with empty name does NOT wipe name (preserves existing)
- Delete non-existent pack returns 404
- Add question with exactly 0 answers (400)
- Add question with 5 answers (400)
- Add question with correct_index=-1 (400)
- Add question with correct_index=4 (400)
- Add question stores all 4 answers and correct_index correctly
- Add question with image_emoji stored correctly
- Update question answers list
- Update question correct_index
- Update question image_emoji
- Delete question by wrong owner returns 404
- Creator blocked from creating room with own pack (400 with error key)
- Non-creator can create room with public pack (201)
- Creator blocked from joining room that uses their pack (400)
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.accounts.models import UserProfile
from apps.rooms.models import QuestionPack, CustomQuestion, Room, Player


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def user_a(db):
    user = User.objects.create_user('creator@packs-full.com', 'creator@packs-full.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='Creator')
    return user


@pytest.fixture
def user_b(db):
    user = User.objects.create_user('other@packs-full.com', 'other@packs-full.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='OtherPlayer')
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
def private_pack(user_a):
    return QuestionPack.objects.create(
        name='Private Pack',
        description='A private pack',
        is_public=False,
        created_by=user_a,
    )


@pytest.fixture
def public_pack_b(user_b):
    return QuestionPack.objects.create(
        name='Public Pack B',
        description='Owned by user_b',
        is_public=True,
        created_by=user_b,
    )


def _make_question(pack, text='Default question?', answers=None, correct_index=0, emoji=''):
    if answers is None:
        answers = ['A', 'B', 'C', 'D']
    return CustomQuestion.objects.create(
        pack=pack,
        question_text=text,
        answers=answers,
        correct_index=correct_index,
        image_emoji=emoji,
    )


# ─── Pack creation ─────────────────────────────────────────────────────────

def test_create_pack_returns_201_and_id(client_a):
    resp = client_a.post('/api/packs/create/', {'name': 'My Pack'}, format='json')
    assert resp.status_code == 201
    assert 'id' in resp.data
    assert resp.data['name'] == 'My Pack'


def test_create_pack_with_public_flag(client_a):
    resp = client_a.post('/api/packs/create/', {
        'name': 'Public Test Pack',
        'is_public': True,
    }, format='json')
    assert resp.status_code == 201
    pack = QuestionPack.objects.get(id=resp.data['id'])
    assert pack.is_public is True


def test_create_pack_defaults_to_private(client_a):
    resp = client_a.post('/api/packs/create/', {'name': 'Default Visibility'}, format='json')
    assert resp.status_code == 201
    pack = QuestionPack.objects.get(id=resp.data['id'])
    assert pack.is_public is False


def test_create_pack_with_description(client_a):
    resp = client_a.post('/api/packs/create/', {
        'name': 'Pack With Desc',
        'description': 'Very helpful description',
    }, format='json')
    assert resp.status_code == 201
    pack = QuestionPack.objects.get(id=resp.data['id'])
    assert pack.description == 'Very helpful description'


def test_create_pack_requires_auth():
    anon = APIClient()
    resp = anon.post('/api/packs/create/', {'name': 'Sneaky Pack'}, format='json')
    assert resp.status_code == 403


def test_create_pack_requires_name(client_a):
    resp = client_a.post('/api/packs/create/', {'name': ''}, format='json')
    assert resp.status_code == 400
    assert 'error' in resp.data


def test_create_pack_whitespace_name_rejected(client_a):
    resp = client_a.post('/api/packs/create/', {'name': '   '}, format='json')
    assert resp.status_code == 400


# ─── Pack list ────────────────────────────────────────────────────────────────

def test_list_packs_includes_own_private_and_others_public(client_a, private_pack, public_pack_b):
    resp = client_a.get('/api/packs/')
    assert resp.status_code == 200
    names = {p['name'] for p in resp.data}
    assert 'Private Pack' in names
    assert 'Public Pack B' in names


def test_list_packs_excludes_other_users_private(client_a, user_b):
    QuestionPack.objects.create(name='Hidden Pack', is_public=False, created_by=user_b)
    resp = client_a.get('/api/packs/')
    names = {p['name'] for p in resp.data}
    assert 'Hidden Pack' not in names


def test_list_packs_is_mine_true_for_own_pack(client_a, private_pack):
    resp = client_a.get('/api/packs/')
    own = next(p for p in resp.data if p['name'] == 'Private Pack')
    assert own['is_mine'] is True


def test_list_packs_is_mine_false_for_others_pack(client_a, public_pack_b):
    resp = client_a.get('/api/packs/')
    other = next(p for p in resp.data if p['name'] == 'Public Pack B')
    assert other['is_mine'] is False


def test_list_packs_question_count_reflects_questions(client_a, private_pack):
    _make_question(private_pack, 'Q1')
    _make_question(private_pack, 'Q2')
    resp = client_a.get('/api/packs/')
    pack_entry = next(p for p in resp.data if p['name'] == 'Private Pack')
    assert pack_entry['question_count'] == 2


def test_list_packs_requires_auth():
    anon = APIClient()
    resp = anon.get('/api/packs/')
    assert resp.status_code == 403


# ─── Pack detail ──────────────────────────────────────────────────────────────

def test_get_pack_detail_returns_is_mine_true_for_owner(client_a, private_pack):
    resp = client_a.get(f'/api/packs/{private_pack.id}/')
    assert resp.status_code == 200
    assert resp.data['is_mine'] is True


def test_get_pack_detail_returns_is_mine_false_for_other(client_b, public_pack_b, user_a):
    # user_a views user_b's public pack
    client_a = APIClient()
    client_a.force_authenticate(user=user_a)
    resp = client_a.get(f'/api/packs/{public_pack_b.id}/')
    assert resp.status_code == 200
    assert resp.data['is_mine'] is False


def test_get_pack_detail_private_by_other_user_returns_403(client_b, private_pack):
    resp = client_b.get(f'/api/packs/{private_pack.id}/')
    assert resp.status_code == 403


def test_get_pack_detail_nonexistent_returns_404(client_a):
    resp = client_a.get('/api/packs/99999/')
    assert resp.status_code == 404


def test_get_pack_detail_includes_questions_list(client_a, private_pack):
    _make_question(private_pack, 'What is 1+1?', ['1', '2', '3', '4'], correct_index=1)
    resp = client_a.get(f'/api/packs/{private_pack.id}/')
    assert resp.status_code == 200
    assert 'questions' in resp.data
    assert len(resp.data['questions']) == 1


def test_get_pack_detail_question_has_required_fields(client_a, private_pack):
    _make_question(private_pack, 'Capital of France?', ['Berlin', 'Paris', 'Madrid', 'Rome'], correct_index=1, emoji='🗼')
    resp = client_a.get(f'/api/packs/{private_pack.id}/')
    q = resp.data['questions'][0]
    for field in ['id', 'question_text', 'answers', 'correct_index', 'image_emoji']:
        assert field in q, f'Missing field: {field}'


def test_get_pack_detail_question_data_is_correct(client_a, private_pack):
    _make_question(private_pack, 'Capital of France?', ['Berlin', 'Paris', 'Madrid', 'Rome'], correct_index=1, emoji='🗼')
    resp = client_a.get(f'/api/packs/{private_pack.id}/')
    q = resp.data['questions'][0]
    assert q['question_text'] == 'Capital of France?'
    assert q['answers'] == ['Berlin', 'Paris', 'Madrid', 'Rome']
    assert q['correct_index'] == 1
    assert q['image_emoji'] == '🗼'


# ─── Pack update ──────────────────────────────────────────────────────────────

def test_update_pack_name(client_a, private_pack):
    resp = client_a.patch(f'/api/packs/{private_pack.id}/', {'name': 'Renamed Pack'}, format='json')
    assert resp.status_code == 200
    private_pack.refresh_from_db()
    assert private_pack.name == 'Renamed Pack'


def test_update_pack_description(client_a, private_pack):
    resp = client_a.patch(f'/api/packs/{private_pack.id}/', {'description': 'New description'}, format='json')
    assert resp.status_code == 200
    private_pack.refresh_from_db()
    assert private_pack.description == 'New description'


def test_update_pack_make_public(client_a, private_pack):
    resp = client_a.patch(f'/api/packs/{private_pack.id}/', {'is_public': True}, format='json')
    assert resp.status_code == 200
    private_pack.refresh_from_db()
    assert private_pack.is_public is True


def test_update_pack_empty_name_preserves_existing_name(client_a, private_pack):
    # Sending empty name should NOT blank out the pack name
    original_name = private_pack.name
    resp = client_a.patch(f'/api/packs/{private_pack.id}/', {'name': ''}, format='json')
    assert resp.status_code == 200
    private_pack.refresh_from_db()
    assert private_pack.name == original_name


def test_update_pack_by_non_owner_returns_403(client_b, private_pack):
    resp = client_b.patch(f'/api/packs/{private_pack.id}/', {'name': 'Hijacked'}, format='json')
    assert resp.status_code == 403


# ─── Pack delete ──────────────────────────────────────────────────────────────

def test_delete_pack_returns_204(client_a, private_pack):
    resp = client_a.delete(f'/api/packs/{private_pack.id}/')
    assert resp.status_code == 204
    assert not QuestionPack.objects.filter(id=private_pack.id).exists()


def test_delete_pack_by_non_owner_returns_403(client_b, private_pack):
    resp = client_b.delete(f'/api/packs/{private_pack.id}/')
    assert resp.status_code == 403
    assert QuestionPack.objects.filter(id=private_pack.id).exists()


def test_delete_nonexistent_pack_returns_404(client_a):
    resp = client_a.delete('/api/packs/99999/')
    assert resp.status_code == 404


# ─── Add question ─────────────────────────────────────────────────────────────

def test_add_question_returns_201_with_correct_data(client_a, private_pack):
    resp = client_a.post(f'/api/packs/{private_pack.id}/questions/', {
        'question_text': 'What is 2+2?',
        'answers': ['3', '4', '5', '6'],
        'correct_index': 1,
        'image_emoji': '➕',
    }, format='json')
    assert resp.status_code == 201
    assert resp.data['question_text'] == 'What is 2+2?'
    assert resp.data['answers'] == ['3', '4', '5', '6']
    assert resp.data['correct_index'] == 1
    assert resp.data['image_emoji'] == '➕'
    assert 'id' in resp.data


def test_add_question_with_zero_answers_returns_400(client_a, private_pack):
    resp = client_a.post(f'/api/packs/{private_pack.id}/questions/', {
        'question_text': 'Empty?',
        'answers': [],
        'correct_index': 0,
    }, format='json')
    assert resp.status_code == 400


def test_add_question_with_three_answers_returns_400(client_a, private_pack):
    resp = client_a.post(f'/api/packs/{private_pack.id}/questions/', {
        'question_text': 'Too few?',
        'answers': ['A', 'B', 'C'],
        'correct_index': 0,
    }, format='json')
    assert resp.status_code == 400


def test_add_question_with_five_answers_returns_400(client_a, private_pack):
    resp = client_a.post(f'/api/packs/{private_pack.id}/questions/', {
        'question_text': 'Too many?',
        'answers': ['A', 'B', 'C', 'D', 'E'],
        'correct_index': 0,
    }, format='json')
    assert resp.status_code == 400


def test_add_question_with_correct_index_negative_one_returns_400(client_a, private_pack):
    resp = client_a.post(f'/api/packs/{private_pack.id}/questions/', {
        'question_text': 'Negative index?',
        'answers': ['A', 'B', 'C', 'D'],
        'correct_index': -1,
    }, format='json')
    assert resp.status_code == 400


def test_add_question_with_correct_index_4_returns_400(client_a, private_pack):
    resp = client_a.post(f'/api/packs/{private_pack.id}/questions/', {
        'question_text': 'Out of bounds?',
        'answers': ['A', 'B', 'C', 'D'],
        'correct_index': 4,
    }, format='json')
    assert resp.status_code == 400


def test_add_question_with_each_valid_correct_index(client_a, private_pack):
    for idx in [0, 1, 2, 3]:
        resp = client_a.post(f'/api/packs/{private_pack.id}/questions/', {
            'question_text': f'Q at index {idx}?',
            'answers': ['A', 'B', 'C', 'D'],
            'correct_index': idx,
        }, format='json')
        assert resp.status_code == 201, f'Expected 201 for correct_index={idx}'


def test_add_question_persists_to_db(client_a, private_pack):
    client_a.post(f'/api/packs/{private_pack.id}/questions/', {
        'question_text': 'Persisted?',
        'answers': ['A', 'B', 'C', 'D'],
        'correct_index': 0,
    }, format='json')
    assert CustomQuestion.objects.filter(pack=private_pack, question_text='Persisted?').exists()


def test_add_question_to_other_users_pack_returns_404(client_b, private_pack):
    resp = client_b.post(f'/api/packs/{private_pack.id}/questions/', {
        'question_text': 'Hack?',
        'answers': ['A', 'B', 'C', 'D'],
        'correct_index': 0,
    }, format='json')
    assert resp.status_code == 404


# ─── Update question ──────────────────────────────────────────────────────────

def test_update_question_text(client_a, private_pack):
    q = _make_question(private_pack, 'Old text?')
    resp = client_a.patch(f'/api/packs/{private_pack.id}/questions/{q.id}/', {
        'question_text': 'New text?',
    }, format='json')
    assert resp.status_code == 200
    q.refresh_from_db()
    assert q.question_text == 'New text?'


def test_update_question_answers(client_a, private_pack):
    q = _make_question(private_pack, answers=['A', 'B', 'C', 'D'])
    resp = client_a.patch(f'/api/packs/{private_pack.id}/questions/{q.id}/', {
        'answers': ['W', 'X', 'Y', 'Z'],
    }, format='json')
    assert resp.status_code == 200
    q.refresh_from_db()
    assert q.answers == ['W', 'X', 'Y', 'Z']


def test_update_question_correct_index(client_a, private_pack):
    q = _make_question(private_pack, correct_index=0)
    resp = client_a.patch(f'/api/packs/{private_pack.id}/questions/{q.id}/', {
        'correct_index': 3,
    }, format='json')
    assert resp.status_code == 200
    q.refresh_from_db()
    assert q.correct_index == 3


def test_update_question_image_emoji(client_a, private_pack):
    q = _make_question(private_pack, emoji='')
    resp = client_a.patch(f'/api/packs/{private_pack.id}/questions/{q.id}/', {
        'image_emoji': '🔥',
    }, format='json')
    assert resp.status_code == 200
    q.refresh_from_db()
    assert q.image_emoji == '🔥'


def test_update_question_by_other_user_returns_404(client_b, private_pack):
    q = _make_question(private_pack)
    resp = client_b.patch(f'/api/packs/{private_pack.id}/questions/{q.id}/', {
        'question_text': 'Hijacked?',
    }, format='json')
    assert resp.status_code == 404


# ─── Delete question ──────────────────────────────────────────────────────────

def test_delete_question_returns_204(client_a, private_pack):
    q = _make_question(private_pack)
    resp = client_a.delete(f'/api/packs/{private_pack.id}/questions/{q.id}/')
    assert resp.status_code == 204
    assert not CustomQuestion.objects.filter(id=q.id).exists()


def test_delete_question_by_other_user_returns_404(client_b, private_pack):
    q = _make_question(private_pack)
    resp = client_b.delete(f'/api/packs/{private_pack.id}/questions/{q.id}/')
    assert resp.status_code == 404
    assert CustomQuestion.objects.filter(id=q.id).exists()


# ─── Creator restriction on room creation/joining ────────────────────────────

def test_creator_blocked_from_creating_room_with_own_pack(client_a, private_pack):
    resp = client_a.post('/api/rooms/', {
        'host_nickname': 'Creator',
        'categories': [],
        'total_rounds': 5,
        'pack_id': private_pack.id,
    }, format='json')
    assert resp.status_code == 400
    assert 'error' in resp.data


def test_non_creator_can_create_room_with_pack(client_b, private_pack):
    resp = client_b.post('/api/rooms/', {
        'host_nickname': 'OtherPlayer',
        'categories': [],
        'total_rounds': 5,
        'pack_id': private_pack.id,
    }, format='json')
    assert resp.status_code == 201


def test_creator_blocked_from_creating_room_error_message_is_meaningful(client_a, private_pack):
    resp = client_a.post('/api/rooms/', {
        'host_nickname': 'Creator',
        'categories': [],
        'total_rounds': 5,
        'pack_id': private_pack.id,
    }, format='json')
    assert resp.status_code == 400
    error_text = str(resp.data.get('error', ''))
    assert len(error_text) > 5  # some meaningful message


def test_creator_blocked_from_joining_room_using_own_pack(user_a, user_b, private_pack):
    """Pack creator cannot join a room that uses their pack."""
    cb = APIClient()
    cb.force_authenticate(user=user_b)
    # user_b creates a room using user_a's pack
    resp = cb.post('/api/rooms/', {
        'host_nickname': 'OtherPlayer',
        'categories': [],
        'total_rounds': 5,
        'pack_id': private_pack.id,
    }, format='json')
    assert resp.status_code == 201
    room_code = resp.data['room_code']

    # user_a (creator of pack) tries to join
    ca = APIClient()
    ca.force_authenticate(user=user_a)
    resp = ca.post('/api/rooms/join/', {
        'room_code': room_code,
        'nickname': 'Creator',
    }, format='json')
    assert resp.status_code == 400


def test_non_creator_can_join_room_using_pack(user_a, user_b, private_pack):
    """A third user (not the pack creator) can join a room using that pack."""
    cb = APIClient()
    cb.force_authenticate(user=user_b)
    resp = cb.post('/api/rooms/', {
        'host_nickname': 'OtherPlayer',
        'categories': [],
        'total_rounds': 5,
        'pack_id': private_pack.id,
    }, format='json')
    assert resp.status_code == 201
    room_code = resp.data['room_code']

    # A third user joins fine
    user_c = User.objects.create_user('c@packs-full.com', 'c@packs-full.com', 'pass1234')
    UserProfile.objects.create(user=user_c, display_name='ThirdUser')
    cc = APIClient()
    cc.force_authenticate(user=user_c)
    resp = cc.post('/api/rooms/join/', {
        'room_code': room_code,
        'nickname': 'ThirdUser',
    }, format='json')
    assert resp.status_code == 201


def test_create_room_with_nonexistent_pack_returns_404(client_b):
    resp = client_b.post('/api/rooms/', {
        'host_nickname': 'Player',
        'categories': [],
        'total_rounds': 5,
        'pack_id': 99999,
    }, format='json')
    assert resp.status_code == 404
