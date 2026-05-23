import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.accounts.models import UserProfile, ShopItem, UserItem


@pytest.fixture
def user_a(db):
    user = User.objects.create_user('shopper@test.com', 'shopper@test.com', 'pass1234')
    UserProfile.objects.create(user=user, display_name='Shopper', coins=500, avatar='fox', theme='default')
    return user


@pytest.fixture
def client_a(user_a):
    client = APIClient()
    client.force_authenticate(user=user_a)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def clean_shop(db):
    ShopItem.objects.all().delete()


def create_item(**overrides):
    payload = {
        'code': 'wolf',
        'name': 'Wilk',
        'description': 'Avatar wilka',
        'item_type': 'avatar',
        'price': 100,
        'emoji_icon': '🐺',
        'is_active': True,
    }
    payload.update(overrides)
    return ShopItem.objects.create(**payload)


@pytest.mark.django_db
def test_list_shop_items_contains_extended_fields(client_a, clean_shop):
    create_item()
    response = client_a.get('/api/shop/')

    assert response.status_code == 200
    item = response.json()[0]
    for field in ('id', 'code', 'name', 'description', 'item_type', 'price', 'emoji_icon', 'owned', 'quantity', 'is_equipped'):
        assert field in item


@pytest.mark.django_db
def test_list_shop_items_marks_starter_items_owned(client_a, clean_shop):
    create_item(code='fox', name='Lis', description='Startowy avatar', price=0)
    create_item(code='default', name='Klasyczny', description='Startowy motyw', item_type='theme', emoji_icon='🎨', price=0)

    response = client_a.get('/api/shop/')
    data = {item['code']: item for item in response.json()}

    assert data['fox']['owned'] is True
    assert data['fox']['quantity'] == 1
    assert data['fox']['is_equipped'] is True
    assert data['default']['owned'] is True
    assert data['default']['is_equipped'] is True


@pytest.mark.django_db
def test_buy_avatar_deducts_coins_and_creates_user_item(client_a, user_a, clean_shop):
    avatar = create_item(code='wolf')

    response = client_a.post('/api/shop/buy/', {'item_id': avatar.id}, format='json')

    user_a.profile.refresh_from_db()
    assert response.status_code == 200
    assert response.json()['coins'] == 400
    assert UserItem.objects.filter(user=user_a, item=avatar, quantity=1).exists()


@pytest.mark.django_db
def test_buy_duplicate_avatar_returns_400(client_a, user_a, clean_shop):
    avatar = create_item(code='wolf')
    UserItem.objects.create(user=user_a, item=avatar, quantity=1)

    response = client_a.post('/api/shop/buy/', {'item_id': avatar.id}, format='json')

    assert response.status_code == 400


@pytest.mark.django_db
def test_buy_powerup_second_time_increments_quantity(client_a, user_a, clean_shop):
    powerup = create_item(
        code='extra_time',
        name='+15 sekund',
        description='Dodaje czas',
        item_type='powerup',
        price=75,
        emoji_icon='⏱️',
    )

    first = client_a.post('/api/shop/buy/', {'item_id': powerup.id}, format='json')
    second = client_a.post('/api/shop/buy/', {'item_id': powerup.id}, format='json')

    user_item = UserItem.objects.get(user=user_a, item=powerup)
    user_a.profile.refresh_from_db()
    assert first.status_code == 200
    assert second.status_code == 200
    assert user_item.quantity == 2
    assert user_a.profile.coins == 500 - 75 - 75


@pytest.mark.django_db
def test_buy_item_insufficient_coins_returns_400(client_a, user_a, clean_shop):
    expensive = create_item(code='alien', price=9999)

    response = client_a.post('/api/shop/buy/', {'item_id': expensive.id}, format='json')

    user_a.profile.refresh_from_db()
    assert response.status_code == 400
    assert user_a.profile.coins == 500


@pytest.mark.django_db
def test_equip_avatar_updates_profile(client_a, user_a, clean_shop):
    avatar = create_item(code='wolf')
    UserItem.objects.create(user=user_a, item=avatar)

    response = client_a.post('/api/shop/equip/', {'item_id': avatar.id}, format='json')

    user_a.profile.refresh_from_db()
    assert response.status_code == 200
    assert user_a.profile.avatar == 'wolf'
    assert response.json()['is_equipped'] is True


@pytest.mark.django_db
def test_equip_theme_updates_profile(client_a, user_a, clean_shop):
    theme = create_item(
        code='galaxy',
        name='Galaktyczny',
        description='Kosmiczny motyw',
        item_type='theme',
        price=300,
        emoji_icon='🌌',
    )
    UserItem.objects.create(user=user_a, item=theme)

    response = client_a.post('/api/shop/equip/', {'item_id': theme.id}, format='json')

    user_a.profile.refresh_from_db()
    assert response.status_code == 200
    assert user_a.profile.theme == 'galaxy'


@pytest.mark.django_db
def test_equip_starter_theme_without_user_item_works(client_a, user_a, clean_shop):
    theme = create_item(
        code='default',
        name='Klasyczny',
        description='Startowy motyw',
        item_type='theme',
        price=0,
        emoji_icon='🎨',
    )

    response = client_a.post('/api/shop/equip/', {'item_id': theme.id}, format='json')

    user_a.profile.refresh_from_db()
    assert response.status_code == 200
    assert user_a.profile.theme == 'default'


@pytest.mark.django_db
def test_inventory_returns_code_and_quantity(client_a, user_a, clean_shop):
    item = create_item(
        code='double_points',
        name='x2 Punkty',
        description='Podwaja wynik',
        item_type='powerup',
        price=100,
        emoji_icon='✖️2️⃣',
    )
    UserItem.objects.create(user=user_a, item=item, quantity=3)

    response = client_a.get('/api/shop/inventory/')

    assert response.status_code == 200
    payload = response.json()[0]
    assert payload['code'] == 'double_points'
    assert payload['quantity'] == 3


@pytest.mark.django_db
def test_inventory_excludes_zero_quantity_powerups(client_a, user_a, clean_shop):
    item = create_item(
        code='extra_time',
        name='+15 sekund',
        description='Dodaje czas',
        item_type='powerup',
        price=75,
        emoji_icon='⏱️',
    )
    UserItem.objects.create(user=user_a, item=item, quantity=0)

    response = client_a.get('/api/shop/inventory/')

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
def test_coins_endpoint_returns_current_balance(client_a, user_a):
    response = client_a.get('/api/shop/coins/')
    assert response.status_code == 200
    assert response.json()['coins'] == user_a.profile.coins


@pytest.mark.django_db
def test_shop_endpoints_require_auth(anon_client, clean_shop):
    item = create_item()

    assert anon_client.get('/api/shop/').status_code == 403
    assert anon_client.post('/api/shop/buy/', {'item_id': item.id}, format='json').status_code == 403
    assert anon_client.post('/api/shop/equip/', {'item_id': item.id}, format='json').status_code == 403
    assert anon_client.get('/api/shop/inventory/').status_code == 403
    assert anon_client.get('/api/shop/coins/').status_code == 403
