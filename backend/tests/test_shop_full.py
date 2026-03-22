"""
Comprehensive tests for shop endpoints:
  GET  /api/shop/           — list active items
  POST /api/shop/buy/       — buy item
  POST /api/shop/equip/     — equip / unequip item
  GET  /api/shop/inventory/ — owned items
  GET  /api/shop/coins/     — coin balance
"""
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, ShopItem, UserItem


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user_a(db):
    user = User.objects.create_user('shopper@test.com', 'shopper@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='Shopper', coins=500)
    return user


@pytest.fixture
def client_a(user_a):
    c = APIClient()
    c.force_authenticate(user=user_a)
    return c


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def clean_shop(db):
    """Usuwa wszystkie istniejące ShopItem (seeded przez migrację) dla izolacji testu."""
    ShopItem.objects.all().delete()


@pytest.fixture
def active_item(clean_shop):
    return ShopItem.objects.create(
        name='Test Frame',
        description='A decorative frame',
        item_type='profile_frame',
        price=100,
        emoji_icon='🎭',
        is_active=True,
    )


@pytest.fixture
def inactive_item(clean_shop):
    return ShopItem.objects.create(
        name='Hidden Item',
        description='Not for sale',
        item_type='title',
        price=50,
        emoji_icon='🔒',
        is_active=False,
    )


@pytest.fixture
def expensive_item(clean_shop):
    return ShopItem.objects.create(
        name='Premium Frame',
        description='Expensive item',
        item_type='confetti_effect',
        price=10000,
        emoji_icon='💎',
        is_active=True,
    )


# ---------------------------------------------------------------------------
# List shop items
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_list_shop_items_returns_200(client_a, active_item):
    response = client_a.get('/api/shop/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_list_shop_items_returns_list(client_a, active_item):
    response = client_a.get('/api/shop/')
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_list_shop_items_includes_active_items(client_a, active_item):
    response = client_a.get('/api/shop/')
    ids = [item['id'] for item in response.json()]
    assert active_item.id in ids


@pytest.mark.django_db
def test_list_shop_items_excludes_inactive_items(client_a, active_item, inactive_item):
    response = client_a.get('/api/shop/')
    ids = [item['id'] for item in response.json()]
    assert inactive_item.id not in ids


@pytest.mark.django_db
def test_list_shop_items_only_active_items(client_a, active_item, inactive_item):
    response = client_a.get('/api/shop/')
    data = response.json()
    assert len(data) == 1
    assert data[0]['id'] == active_item.id


@pytest.mark.django_db
def test_list_shop_items_requires_auth(anon_client, active_item):
    response = anon_client.get('/api/shop/')
    assert response.status_code == 403


@pytest.mark.django_db
def test_list_shop_items_contains_required_fields(client_a, active_item):
    response = client_a.get('/api/shop/')
    data = response.json()
    assert len(data) >= 1
    item = data[0]
    for field in ('id', 'name', 'description', 'item_type', 'price', 'emoji_icon'):
        assert field in item, f"Field '{field}' missing from shop item response"


# ---------------------------------------------------------------------------
# Buy item
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_buy_item_deducts_coins(client_a, user_a, active_item):
    initial_coins = user_a.profile.coins  # 500
    client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    user_a.profile.refresh_from_db()
    assert user_a.profile.coins == initial_coins - active_item.price


@pytest.mark.django_db
def test_buy_item_creates_user_item(client_a, user_a, active_item):
    client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    assert UserItem.objects.filter(user=user_a, item=active_item).exists()


@pytest.mark.django_db
def test_buy_item_returns_200(client_a, active_item):
    response = client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    assert response.status_code == 200


@pytest.mark.django_db
def test_buy_item_response_contains_coins(client_a, active_item):
    response = client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    data = response.json()
    assert 'coins' in data
    assert data['coins'] == 400  # 500 - 100


@pytest.mark.django_db
def test_buy_duplicate_item_returns_400(client_a, user_a, active_item):
    # Buy once successfully
    client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    # Attempt to buy again
    response = client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_buy_duplicate_item_does_not_create_second_user_item(client_a, user_a, active_item):
    client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    count = UserItem.objects.filter(user=user_a, item=active_item).count()
    assert count == 1


@pytest.mark.django_db
def test_buy_item_insufficient_coins_returns_400(client_a, user_a, expensive_item):
    # user has 500 coins, item costs 10000
    response = client_a.post('/api/shop/buy/', {'item_id': expensive_item.id}, format='json')
    assert response.status_code == 400


@pytest.mark.django_db
def test_buy_item_insufficient_coins_does_not_deduct(client_a, user_a, expensive_item):
    original_coins = user_a.profile.coins
    client_a.post('/api/shop/buy/', {'item_id': expensive_item.id}, format='json')
    user_a.profile.refresh_from_db()
    assert user_a.profile.coins == original_coins


@pytest.mark.django_db
def test_buy_item_requires_auth(anon_client, active_item):
    response = anon_client.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    assert response.status_code == 403


@pytest.mark.django_db
def test_buy_nonexistent_item_returns_404(client_a):
    response = client_a.post('/api/shop/buy/', {'item_id': 99999}, format='json')
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Equip / unequip
# ---------------------------------------------------------------------------

@pytest.fixture
def owned_item(db, user_a, active_item):
    return UserItem.objects.create(user=user_a, item=active_item, is_equipped=False)


@pytest.mark.django_db
def test_equip_owned_item_sets_equipped_true(client_a, user_a, owned_item):
    client_a.post('/api/shop/equip/', {'item_id': owned_item.item.id}, format='json')
    owned_item.refresh_from_db()
    assert owned_item.is_equipped is True


@pytest.mark.django_db
def test_equip_returns_200(client_a, owned_item):
    response = client_a.post('/api/shop/equip/', {'item_id': owned_item.item.id}, format='json')
    assert response.status_code == 200


@pytest.mark.django_db
def test_equip_returns_is_equipped_true(client_a, owned_item):
    response = client_a.post('/api/shop/equip/', {'item_id': owned_item.item.id}, format='json')
    data = response.json()
    assert 'is_equipped' in data
    assert data['is_equipped'] is True


@pytest.mark.django_db
def test_unequip_item_sets_equipped_false(client_a, user_a, active_item):
    # Create already-equipped item
    user_item = UserItem.objects.create(user=user_a, item=active_item, is_equipped=True)
    client_a.post('/api/shop/equip/', {'item_id': active_item.id}, format='json')
    user_item.refresh_from_db()
    assert user_item.is_equipped is False


@pytest.mark.django_db
def test_unequip_returns_is_equipped_false(client_a, user_a, active_item):
    UserItem.objects.create(user=user_a, item=active_item, is_equipped=True)
    response = client_a.post('/api/shop/equip/', {'item_id': active_item.id}, format='json')
    data = response.json()
    assert data['is_equipped'] is False


@pytest.mark.django_db
def test_equip_not_owned_item_returns_404(client_a, active_item):
    # active_item exists but user does not own it
    response = client_a.post('/api/shop/equip/', {'item_id': active_item.id}, format='json')
    assert response.status_code == 404


@pytest.mark.django_db
def test_equip_only_one_item_of_same_type(db, active_item):
    """Equipping a new item of the same type unequips the previous one."""
    user = User.objects.create_user('equiptest@test.com', 'equiptest@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='EquipUser', coins=1000)
    c = APIClient()
    c.force_authenticate(user=user)

    item2 = ShopItem.objects.create(
        name='Frame Two',
        description='Another frame',
        item_type='profile_frame',
        price=50,
        emoji_icon='🖼️',
        is_active=True,
    )

    ui1 = UserItem.objects.create(user=user, item=active_item, is_equipped=True)
    ui2 = UserItem.objects.create(user=user, item=item2, is_equipped=False)

    # Equip second item; first should become unequipped
    c.post('/api/shop/equip/', {'item_id': item2.id}, format='json')

    ui1.refresh_from_db()
    ui2.refresh_from_db()
    assert ui1.is_equipped is False
    assert ui2.is_equipped is True


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_inventory_returns_200(client_a):
    response = client_a.get('/api/shop/inventory/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_inventory_returns_list(client_a):
    response = client_a.get('/api/shop/inventory/')
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_inventory_empty_for_new_user(client_a):
    response = client_a.get('/api/shop/inventory/')
    assert response.json() == []


@pytest.mark.django_db
def test_inventory_shows_owned_items(client_a, user_a, active_item):
    UserItem.objects.create(user=user_a, item=active_item)
    response = client_a.get('/api/shop/inventory/')
    data = response.json()
    assert len(data) == 1
    assert data[0]['item_id'] == active_item.id


@pytest.mark.django_db
def test_inventory_item_has_required_fields(client_a, user_a, active_item):
    UserItem.objects.create(user=user_a, item=active_item)
    response = client_a.get('/api/shop/inventory/')
    item = response.json()[0]
    for field in ('id', 'item_id', 'name', 'description', 'item_type', 'emoji_icon', 'purchased_at', 'is_equipped'):
        assert field in item, f"Field '{field}' missing from inventory item"


@pytest.mark.django_db
def test_inventory_requires_auth(anon_client):
    response = anon_client.get('/api/shop/inventory/')
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Coins endpoint
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_coins_returns_200(client_a):
    response = client_a.get('/api/shop/coins/')
    assert response.status_code == 200


@pytest.mark.django_db
def test_coins_returns_balance(client_a, user_a):
    response = client_a.get('/api/shop/coins/')
    data = response.json()
    assert 'coins' in data
    assert data['coins'] == user_a.profile.coins


@pytest.mark.django_db
def test_coins_updates_after_purchase(client_a, user_a, active_item):
    initial = user_a.profile.coins
    client_a.post('/api/shop/buy/', {'item_id': active_item.id}, format='json')
    response = client_a.get('/api/shop/coins/')
    assert response.json()['coins'] == initial - active_item.price


@pytest.mark.django_db
def test_coins_requires_auth(anon_client):
    response = anon_client.get('/api/shop/coins/')
    assert response.status_code == 403
