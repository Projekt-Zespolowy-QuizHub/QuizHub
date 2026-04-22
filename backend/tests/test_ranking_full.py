"""
Comprehensive ranking tests for QuizHub.

Covers: global ranking (sorted, rank field, avatar field), weekly ranking (sorted),
friends ranking (self + friends included, non-friends excluded, requires auth),
empty ranking, avatar field presence.
"""
import pytest
from django.test import Client
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile, Friendship


# ─── Helpers ─────────────────────────────────────────────────────────


def _make_user(email, display_name, total_score=0, weekly_score=0, avatar='fox'):
    user = User.objects.create_user(email, email, 'pass1234')
    UserProfile.objects.create(
        user=user,
        display_name=display_name,
        total_score=total_score,
        weekly_score=weekly_score,
        avatar=avatar,
    )
    return user


# ─── Global ranking ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_global_ranking_returns_200():
    client = Client()
    resp = client.get('/api/rankings/global/')
    assert resp.status_code == 200


@pytest.mark.django_db
def test_global_ranking_sorted_descending_by_total_score():
    _make_user('g1@test.com', 'GlobalA', total_score=1000)
    _make_user('g2@test.com', 'GlobalB', total_score=3000)
    _make_user('g3@test.com', 'GlobalC', total_score=2000)

    client = Client()
    resp = client.get('/api/rankings/global/')
    scores = [entry['total_score'] for entry in resp.json()]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.django_db
def test_global_ranking_first_place_is_highest_score():
    _make_user('g1@test.com', 'GlobalA', total_score=500)
    _make_user('g2@test.com', 'GlobalB', total_score=9000)

    client = Client()
    resp = client.get('/api/rankings/global/')
    assert resp.json()[0]['display_name'] == 'GlobalB'


@pytest.mark.django_db
def test_global_ranking_has_rank_field():
    _make_user('gr1@test.com', 'RankPlayer', total_score=100)

    client = Client()
    resp = client.get('/api/rankings/global/')
    assert 'rank' in resp.json()[0]


@pytest.mark.django_db
def test_global_ranking_rank_starts_at_one():
    _make_user('gr2@test.com', 'RankStart', total_score=200)

    client = Client()
    resp = client.get('/api/rankings/global/')
    assert resp.json()[0]['rank'] == 1


@pytest.mark.django_db
def test_global_ranking_ranks_are_sequential():
    _make_user('gs1@test.com', 'SeqA', total_score=300)
    _make_user('gs2@test.com', 'SeqB', total_score=200)
    _make_user('gs3@test.com', 'SeqC', total_score=100)

    client = Client()
    resp = client.get('/api/rankings/global/')
    ranks = [entry['rank'] for entry in resp.json()]
    assert ranks == list(range(1, len(ranks) + 1))


@pytest.mark.django_db
def test_global_ranking_has_avatar_field():
    _make_user('av1@test.com', 'AvatarPlayer', total_score=50, avatar='wolf')

    client = Client()
    resp = client.get('/api/rankings/global/')
    assert 'avatar' in resp.json()[0]


@pytest.mark.django_db
def test_global_ranking_empty_returns_empty_list():
    client = Client()
    resp = client.get('/api/rankings/global/')
    assert resp.json() == []


@pytest.mark.django_db
def test_global_ranking_limited_to_50():
    for i in range(55):
        _make_user(f'lim{i}@test.com', f'LimPlayer{i}', total_score=i * 10)

    client = Client()
    resp = client.get('/api/rankings/global/')
    assert len(resp.json()) <= 50


# ─── Weekly ranking ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_weekly_ranking_returns_200():
    client = Client()
    resp = client.get('/api/rankings/weekly/')
    assert resp.status_code == 200


@pytest.mark.django_db
def test_weekly_ranking_sorted_descending_by_weekly_score():
    _make_user('w1@test.com', 'WeeklyA', weekly_score=100)
    _make_user('w2@test.com', 'WeeklyB', weekly_score=500)
    _make_user('w3@test.com', 'WeeklyC', weekly_score=300)

    client = Client()
    resp = client.get('/api/rankings/weekly/')
    scores = [entry['score'] for entry in resp.json()]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.django_db
def test_weekly_ranking_first_place_has_highest_score():
    _make_user('w4@test.com', 'WeeklyX', weekly_score=1000)
    _make_user('w5@test.com', 'WeeklyY', weekly_score=50)

    client = Client()
    resp = client.get('/api/rankings/weekly/')
    assert resp.json()[0]['display_name'] == 'WeeklyX'


@pytest.mark.django_db
def test_weekly_ranking_has_rank_field():
    _make_user('wr1@test.com', 'WeeklyRank', weekly_score=10)

    client = Client()
    resp = client.get('/api/rankings/weekly/')
    assert 'rank' in resp.json()[0]


@pytest.mark.django_db
def test_weekly_ranking_has_avatar_field():
    _make_user('wa1@test.com', 'WeeklyAvatar', weekly_score=10, avatar='bear')

    client = Client()
    resp = client.get('/api/rankings/weekly/')
    assert 'avatar' in resp.json()[0]


@pytest.mark.django_db
def test_weekly_ranking_empty_returns_empty_list():
    client = Client()
    resp = client.get('/api/rankings/weekly/')
    assert resp.json() == []


# ─── Friends ranking ─────────────────────────────────────────────────


@pytest.mark.django_db
def test_friends_ranking_requires_auth_returns_403():
    client = Client()
    resp = client.get('/api/rankings/friends/')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_friends_ranking_includes_self():
    user = _make_user('self@test.com', 'SelfPlayer', total_score=500)
    client = Client()
    client.force_login(user)
    resp = client.get('/api/rankings/friends/')
    names = [entry['display_name'] for entry in resp.json()]
    assert 'SelfPlayer' in names


@pytest.mark.django_db
def test_friends_ranking_includes_accepted_friend():
    user_a = _make_user('fra@test.com', 'FriendA', total_score=1000)
    user_b = _make_user('frb@test.com', 'FriendB', total_score=500)
    Friendship.objects.create(from_user=user_a, to_user=user_b, status='accepted')

    client = Client()
    client.force_login(user_a)
    resp = client.get('/api/rankings/friends/')
    names = [entry['display_name'] for entry in resp.json()]
    assert 'FriendB' in names


@pytest.mark.django_db
def test_friends_ranking_includes_friend_who_added_self():
    """Friends ranking should include friends regardless of who initiated the request."""
    user_a = _make_user('frc@test.com', 'FriendC', total_score=200)
    user_d = _make_user('frd@test.com', 'FriendD', total_score=300)
    Friendship.objects.create(from_user=user_d, to_user=user_a, status='accepted')

    client = Client()
    client.force_login(user_a)
    resp = client.get('/api/rankings/friends/')
    names = [entry['display_name'] for entry in resp.json()]
    assert 'FriendD' in names


@pytest.mark.django_db
def test_friends_ranking_excludes_non_friends():
    user_a = _make_user('fre@test.com', 'FriendE', total_score=100)
    _make_user('frf@test.com', 'Stranger', total_score=9999)

    client = Client()
    client.force_login(user_a)
    resp = client.get('/api/rankings/friends/')
    names = [entry['display_name'] for entry in resp.json()]
    assert 'Stranger' not in names


@pytest.mark.django_db
def test_friends_ranking_excludes_pending_friend():
    user_a = _make_user('frg@test.com', 'FriendG', total_score=100)
    user_h = _make_user('frh@test.com', 'FriendH', total_score=200)
    Friendship.objects.create(from_user=user_a, to_user=user_h, status='pending')

    client = Client()
    client.force_login(user_a)
    resp = client.get('/api/rankings/friends/')
    names = [entry['display_name'] for entry in resp.json()]
    assert 'FriendH' not in names


@pytest.mark.django_db
def test_friends_ranking_sorted_descending_by_total_score():
    user_a = _make_user('fri@test.com', 'FriendI', total_score=100)
    user_j = _make_user('frj@test.com', 'FriendJ', total_score=800)
    user_k = _make_user('frk@test.com', 'FriendK', total_score=500)
    Friendship.objects.create(from_user=user_a, to_user=user_j, status='accepted')
    Friendship.objects.create(from_user=user_a, to_user=user_k, status='accepted')

    client = Client()
    client.force_login(user_a)
    resp = client.get('/api/rankings/friends/')
    scores = [entry['total_score'] for entry in resp.json()]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.django_db
def test_friends_ranking_has_rank_field():
    user = _make_user('frrank@test.com', 'RankFriend', total_score=100)
    client = Client()
    client.force_login(user)
    resp = client.get('/api/rankings/friends/')
    assert 'rank' in resp.json()[0]


@pytest.mark.django_db
def test_friends_ranking_has_avatar_field():
    user = _make_user('fravatar@test.com', 'AvatarFriend', total_score=100, avatar='dragon')
    client = Client()
    client.force_login(user)
    resp = client.get('/api/rankings/friends/')
    assert 'avatar' in resp.json()[0]


@pytest.mark.django_db
def test_friends_ranking_only_self_when_no_friends():
    user = _make_user('lonely@test.com', 'LonelyPlayer', total_score=100)
    client = Client()
    client.force_login(user)
    resp = client.get('/api/rankings/friends/')
    assert len(resp.json()) == 1
    assert resp.json()[0]['display_name'] == 'LonelyPlayer'
