"""
Comprehensive tests for clan endpoints:
  GET  /api/clans/                  — list clans
  POST /api/clans/                  — create clan
  GET  /api/clans/<pk>/             — clan detail
  POST /api/clans/<pk>/join/        — join open clan
  POST /api/clans/<pk>/leave/       — leave clan
  POST /api/clans/<pk>/invite/      — invite user (leader/officer)
  POST /api/clans/<pk>/kick/        — kick member (leader/officer)
  POST /api/clans/invite/respond/   — accept / reject invite
  GET  /api/clans/leaderboard/      — clan leaderboard
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, Clan, ClanMembership, ClanInvite


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def make_user(username, display_name, coins=0):
    user = User.objects.create_user(username, username, 'pass1234')
    UserProfile.objects.create(user=user, display_name=display_name, coins=coins)
    return user


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def user_a(db):
    return make_user('leader@test.com', 'LeaderA')


@pytest.fixture
def user_b(db):
    return make_user('member@test.com', 'MemberB')


@pytest.fixture
def user_c(db):
    return make_user('outsider@test.com', 'OutsiderC')


@pytest.fixture
def client_a(user_a):
    return auth_client(user_a)


@pytest.fixture
def client_b(user_b):
    return auth_client(user_b)


@pytest.fixture
def client_c(user_c):
    return auth_client(user_c)


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def open_clan(db, user_a):
    """An open clan where user_a is the leader."""
    clan = Clan.objects.create(
        name='Alpha Clan',
        tag='ALP',
        description='Open clan',
        is_open=True,
        created_by=user_a,
    )
    ClanMembership.objects.create(clan=clan, user=user_a, role=ClanMembership.Role.LEADER)
    return clan


@pytest.fixture
def closed_clan(db, user_a):
    """A closed clan where user_a is the leader."""
    clan = Clan.objects.create(
        name='Closed Clan',
        tag='CLO',
        description='Invite only',
        is_open=False,
        created_by=user_a,
    )
    ClanMembership.objects.create(clan=clan, user=user_a, role=ClanMembership.Role.LEADER)
    return clan


# ---------------------------------------------------------------------------
# Create clan
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_clan_returns_201(client_a):
    response = client_a.post('/api/clans/', {
        'name': 'New Clan',
        'tag': 'NEW',
        'description': 'A brand new clan',
        'is_open': True,
    }, format='json')
    assert response.status_code == 201


@pytest.mark.django_db
def test_create_clan_creator_becomes_leader(client_a, user_a):
    client_a.post('/api/clans/', {
        'name': 'Leader Clan',
        'tag': 'LED',
    }, format='json')
    clan = Clan.objects.get(name='Leader Clan')
    membership = ClanMembership.objects.get(clan=clan, user=user_a)
    assert membership.role == ClanMembership.Role.LEADER


@pytest.mark.django_db
def test_create_clan_creates_clan_object(client_a):
    client_a.post('/api/clans/', {'name': 'Unique Clan', 'tag': 'UNQ'}, format='json')
    assert Clan.objects.filter(name='Unique Clan').exists()


@pytest.mark.django_db
def test_create_clan_requires_auth(anon_client):
    response = anon_client.post('/api/clans/', {'name': 'AnonClan', 'tag': 'ANN'}, format='json')
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_clan_duplicate_name_returns_400(client_a, open_clan):
    response = client_a.post('/api/clans/', {
        'name': 'Alpha Clan',  # already exists
        'tag': 'DUP',
    }, format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_clan_duplicate_tag_returns_400(client_a, open_clan):
    response = client_a.post('/api/clans/', {
        'name': 'Different Name',
        'tag': 'ALP',  # tag already taken
    }, format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_clan_short_name_returns_400(client_a):
    response = client_a.post('/api/clans/', {'name': 'AB', 'tag': 'XY'}, format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_clan_while_in_another_clan_returns_400(client_a, user_a, open_clan):
    # user_a is already leader of open_clan
    response = client_a.post('/api/clans/', {
        'name': 'Second Clan',
        'tag': 'SEC',
    }, format='json')
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# List clans
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_list_clans_returns_200(client_a, open_clan):
    response = client_a.get('/api/clans/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_list_clans_returns_list(client_a, open_clan):
    response = client_a.get('/api/clans/')
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_list_clans_includes_created_clan(client_a, open_clan):
    response = client_a.get('/api/clans/')
    ids = [c['id'] for c in response.json()]
    assert open_clan.id in ids


@pytest.mark.django_db
def test_list_clans_requires_auth(anon_client, open_clan):
    response = anon_client.get('/api/clans/')
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Clan detail
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_clan_detail_returns_200(client_a, open_clan):
    response = client_a.get(f'/api/clans/{open_clan.id}/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_clan_detail_contains_members(client_a, open_clan):
    response = client_a.get(f'/api/clans/{open_clan.id}/')
    data = response.json()
    assert 'members' in data
    assert isinstance(data['members'], list)


@pytest.mark.django_db
def test_clan_detail_shows_creator_as_member(client_a, user_a, open_clan):
    response = client_a.get(f'/api/clans/{open_clan.id}/')
    data = response.json()
    member_names = [m['display_name'] for m in data['members']]
    assert 'LeaderA' in member_names


@pytest.mark.django_db
def test_clan_detail_nonexistent_returns_404(client_a):
    response = client_a.get('/api/clans/99999/')
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Join clan
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_join_open_clan_returns_200(client_b, open_clan):
    response = client_b.post(f'/api/clans/{open_clan.id}/join/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_join_open_clan_creates_membership(client_b, user_b, open_clan):
    client_b.post(f'/api/clans/{open_clan.id}/join/')
    assert ClanMembership.objects.filter(clan=open_clan, user=user_b).exists()


@pytest.mark.django_db
def test_join_open_clan_member_role_is_member(client_b, user_b, open_clan):
    client_b.post(f'/api/clans/{open_clan.id}/join/')
    membership = ClanMembership.objects.get(clan=open_clan, user=user_b)
    assert membership.role == ClanMembership.Role.MEMBER


@pytest.mark.django_db
def test_join_closed_clan_returns_400(client_b, closed_clan):
    response = client_b.post(f'/api/clans/{closed_clan.id}/join/')
    assert response.status_code == 400


@pytest.mark.django_db
def test_join_closed_clan_does_not_create_membership(client_b, user_b, closed_clan):
    client_b.post(f'/api/clans/{closed_clan.id}/join/')
    assert not ClanMembership.objects.filter(clan=closed_clan, user=user_b).exists()


@pytest.mark.django_db
def test_join_clan_already_member_returns_400(client_a, user_a, open_clan):
    # user_a is already the leader
    response = client_a.post(f'/api/clans/{open_clan.id}/join/')
    assert response.status_code == 400


@pytest.mark.django_db
def test_join_clan_requires_auth(anon_client, open_clan):
    response = anon_client.post(f'/api/clans/{open_clan.id}/join/')
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Leave clan
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_leave_clan_returns_200(client_b, user_b, open_clan):
    ClanMembership.objects.create(clan=open_clan, user=user_b, role=ClanMembership.Role.MEMBER)
    response = client_b.post(f'/api/clans/{open_clan.id}/leave/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_leave_clan_removes_membership(client_b, user_b, open_clan):
    ClanMembership.objects.create(clan=open_clan, user=user_b, role=ClanMembership.Role.MEMBER)
    client_b.post(f'/api/clans/{open_clan.id}/leave/')
    assert not ClanMembership.objects.filter(clan=open_clan, user=user_b).exists()


@pytest.mark.django_db
def test_leader_cannot_leave_clan_with_members(client_a, user_b, open_clan):
    """Leader cannot leave when other members still exist."""
    ClanMembership.objects.create(clan=open_clan, user=user_b, role=ClanMembership.Role.MEMBER)
    response = client_a.post(f'/api/clans/{open_clan.id}/leave/')
    assert response.status_code == 400


@pytest.mark.django_db
def test_leader_alone_can_leave_and_clan_is_deleted(client_a, user_a, open_clan):
    """When leader is the only member, leaving dissolves the clan."""
    response = client_a.post(f'/api/clans/{open_clan.id}/leave/')
    assert response.status_code == 200
    assert not Clan.objects.filter(id=open_clan.id).exists()


@pytest.mark.django_db
def test_leave_clan_not_a_member_returns_404(client_c, open_clan):
    response = client_c.post(f'/api/clans/{open_clan.id}/leave/')
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Invite user
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_leader_can_invite_user(client_a, user_b, open_clan):
    profile_b = user_b.profile
    response = client_a.post(
        f'/api/clans/{open_clan.id}/invite/',
        {'user_id': profile_b.id},
        format='json',
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_invite_creates_clan_invite_object(client_a, user_b, open_clan):
    profile_b = user_b.profile
    client_a.post(
        f'/api/clans/{open_clan.id}/invite/',
        {'user_id': profile_b.id},
        format='json',
    )
    assert ClanInvite.objects.filter(clan=open_clan, invited_user=user_b).exists()


@pytest.mark.django_db
def test_regular_member_cannot_invite(client_b, user_b, user_c, open_clan):
    ClanMembership.objects.create(clan=open_clan, user=user_b, role=ClanMembership.Role.MEMBER)
    profile_c = user_c.profile
    response = client_b.post(
        f'/api/clans/{open_clan.id}/invite/',
        {'user_id': profile_c.id},
        format='json',
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_invite_nonexistent_user_returns_404(client_a, open_clan):
    response = client_a.post(
        f'/api/clans/{open_clan.id}/invite/',
        {'user_id': 99999},
        format='json',
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_duplicate_invite_returns_400(client_a, user_b, open_clan):
    profile_b = user_b.profile
    client_a.post(f'/api/clans/{open_clan.id}/invite/', {'user_id': profile_b.id}, format='json')
    response = client_a.post(f'/api/clans/{open_clan.id}/invite/', {'user_id': profile_b.id}, format='json')
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Accept / reject invite
# ---------------------------------------------------------------------------

@pytest.fixture
def pending_invite(db, open_clan, user_a, user_b):
    return ClanInvite.objects.create(
        clan=open_clan,
        invited_by=user_a,
        invited_user=user_b,
        status=ClanInvite.Status.PENDING,
    )


@pytest.mark.django_db
def test_accept_invite_creates_membership(client_b, user_b, open_clan, pending_invite):
    client_b.post(
        '/api/clans/invite/respond/',
        {'invite_id': pending_invite.id, 'action': 'accept'},
        format='json',
    )
    assert ClanMembership.objects.filter(clan=open_clan, user=user_b).exists()


@pytest.mark.django_db
def test_accept_invite_returns_200(client_b, pending_invite):
    response = client_b.post(
        '/api/clans/invite/respond/',
        {'invite_id': pending_invite.id, 'action': 'accept'},
        format='json',
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_accept_invite_updates_invite_status(client_b, pending_invite):
    client_b.post(
        '/api/clans/invite/respond/',
        {'invite_id': pending_invite.id, 'action': 'accept'},
        format='json',
    )
    pending_invite.refresh_from_db()
    assert pending_invite.status == ClanInvite.Status.ACCEPTED


@pytest.mark.django_db
def test_reject_invite_returns_200(client_b, pending_invite):
    response = client_b.post(
        '/api/clans/invite/respond/',
        {'invite_id': pending_invite.id, 'action': 'reject'},
        format='json',
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_reject_invite_does_not_create_membership(client_b, user_b, open_clan, pending_invite):
    client_b.post(
        '/api/clans/invite/respond/',
        {'invite_id': pending_invite.id, 'action': 'reject'},
        format='json',
    )
    assert not ClanMembership.objects.filter(clan=open_clan, user=user_b).exists()


@pytest.mark.django_db
def test_reject_invite_updates_status_to_rejected(client_b, pending_invite):
    client_b.post(
        '/api/clans/invite/respond/',
        {'invite_id': pending_invite.id, 'action': 'reject'},
        format='json',
    )
    pending_invite.refresh_from_db()
    assert pending_invite.status == ClanInvite.Status.REJECTED


@pytest.mark.django_db
def test_respond_to_nonexistent_invite_returns_404(client_b):
    response = client_b.post(
        '/api/clans/invite/respond/',
        {'invite_id': 99999, 'action': 'accept'},
        format='json',
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Kick member
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_leader_can_kick_member(client_a, user_b, open_clan):
    ClanMembership.objects.create(clan=open_clan, user=user_b, role=ClanMembership.Role.MEMBER)
    profile_b = user_b.profile
    response = client_a.post(
        f'/api/clans/{open_clan.id}/kick/',
        {'user_id': profile_b.id},
        format='json',
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_kick_removes_membership(client_a, user_b, open_clan):
    ClanMembership.objects.create(clan=open_clan, user=user_b, role=ClanMembership.Role.MEMBER)
    profile_b = user_b.profile
    client_a.post(f'/api/clans/{open_clan.id}/kick/', {'user_id': profile_b.id}, format='json')
    assert not ClanMembership.objects.filter(clan=open_clan, user=user_b).exists()


@pytest.mark.django_db
def test_regular_member_cannot_kick_returns_403(client_b, user_b, user_c, open_clan):
    ClanMembership.objects.create(clan=open_clan, user=user_b, role=ClanMembership.Role.MEMBER)
    ClanMembership.objects.create(clan=open_clan, user=user_c, role=ClanMembership.Role.MEMBER)
    profile_c = user_c.profile
    response = client_b.post(
        f'/api/clans/{open_clan.id}/kick/',
        {'user_id': profile_c.id},
        format='json',
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_kick_nonexistent_user_returns_404(client_a, open_clan):
    response = client_a.post(
        f'/api/clans/{open_clan.id}/kick/',
        {'user_id': 99999},
        format='json',
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_non_member_cannot_kick_returns_403(client_c, user_b, open_clan):
    ClanMembership.objects.create(clan=open_clan, user=user_b, role=ClanMembership.Role.MEMBER)
    profile_b = user_b.profile
    response = client_c.post(
        f'/api/clans/{open_clan.id}/kick/',
        {'user_id': profile_b.id},
        format='json',
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Clan leaderboard
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_clan_leaderboard_returns_200(client_a, open_clan):
    response = client_a.get('/api/clans/leaderboard/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_clan_leaderboard_returns_list(client_a, open_clan):
    response = client_a.get('/api/clans/leaderboard/')
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_clan_leaderboard_contains_rank_field(client_a, open_clan):
    response = client_a.get('/api/clans/leaderboard/')
    data = response.json()
    if data:
        assert 'rank' in data[0]


@pytest.mark.django_db
def test_clan_leaderboard_accessible_without_auth(anon_client, open_clan):
    response = anon_client.get('/api/clans/leaderboard/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_clan_leaderboard_includes_created_clan(client_a, open_clan):
    response = client_a.get('/api/clans/leaderboard/')
    ids = [c['id'] for c in response.json()]
    assert open_clan.id in ids


@pytest.mark.django_db
def test_clan_leaderboard_has_required_fields(client_a, open_clan):
    response = client_a.get('/api/clans/leaderboard/')
    data = response.json()
    if data:
        item = data[0]
        for field in ('rank', 'id', 'name', 'tag', 'total_score', 'member_count', 'leader'):
            assert field in item, f"Field '{field}' missing from leaderboard item"
