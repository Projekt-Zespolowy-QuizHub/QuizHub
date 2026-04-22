import pytest
from django.test import Client


@pytest.mark.django_db
def test_register():
    client = Client()
    resp = client.post('/api/auth/register/', {
        'email': 'new@example.com',
        'password': 'securepass1',
        'display_name': 'NewPlayer',
    }, content_type='application/json')
    assert resp.status_code == 201
    data = resp.json()
    assert data['display_name'] == 'NewPlayer'


@pytest.mark.django_db
def test_register_duplicate_display_name():
    client = Client()
    client.post('/api/auth/register/', {
        'email': 'first@example.com',
        'password': 'securepass1',
        'display_name': 'Taken',
    }, content_type='application/json')
    resp = client.post('/api/auth/register/', {
        'email': 'second@example.com',
        'password': 'securepass1',
        'display_name': 'Taken',
    }, content_type='application/json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_login():
    client = Client()
    client.post('/api/auth/register/', {
        'email': 'login@example.com',
        'password': 'securepass1',
        'display_name': 'LoginPlayer',
    }, content_type='application/json')
    resp = client.post('/api/auth/login/', {
        'email': 'login@example.com',
        'password': 'securepass1',
    }, content_type='application/json')
    assert resp.status_code == 200
    data = resp.json()
    assert data['display_name'] == 'LoginPlayer'


@pytest.mark.django_db
def test_me_authenticated():
    client = Client()
    client.post('/api/auth/register/', {
        'email': 'me@example.com',
        'password': 'securepass1',
        'display_name': 'MePlayer',
    }, content_type='application/json')
    resp = client.get('/api/auth/me/')
    assert resp.status_code == 200
    assert resp.json()['display_name'] == 'MePlayer'


@pytest.mark.django_db
def test_me_unauthenticated():
    client = Client()
    resp = client.get('/api/auth/me/')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_logout():
    client = Client()
    client.post('/api/auth/register/', {
        'email': 'logout@example.com',
        'password': 'securepass1',
        'display_name': 'LogoutPlayer',
    }, content_type='application/json')
    resp = client.post('/api/auth/logout/')
    assert resp.status_code == 200
    resp = client.get('/api/auth/me/')
    assert resp.status_code == 403
