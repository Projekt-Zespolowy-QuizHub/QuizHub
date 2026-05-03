"""
Testy sklepu.

UWAGA: Model Shop/ShopItem nie został jeszcze zaimplementowany w projekcie.
Testy są przygotowane jako szkielet dla przyszłej implementacji.

Oczekiwane endpointy (do zaimplementowania):
- GET /api/shop/ — lista przedmiotów
- POST /api/shop/<id>/buy/ — zakup przedmiotu (odejmuje monety)
- POST /api/shop/<id>/equip/ — załóż przedmiot
- POST /api/shop/<id>/unequip/ — zdejmij przedmiot
"""
import pytest


pytestmark = pytest.mark.skip(reason='Shop model not yet implemented')


def test_list_shop_items():
    """Lista dostępnych przedmiotów sklepowych."""
    pass


def test_buy_item_deducts_coins():
    """Zakup przedmiotu odejmuje odpowiednią liczbę monet."""
    pass


def test_buy_item_insufficient_coins():
    """Zakup gdy brak monet zwraca błąd."""
    pass


def test_buy_already_owned_item():
    """Nie można kupić już posiadanego przedmiotu."""
    pass


def test_equip_owned_item():
    """Gracz może założyć posiadany przedmiot."""
    pass


def test_unequip_item():
    """Gracz może zdjąć założony przedmiot."""
    pass


def test_equip_not_owned_item():
    """Nie można założyć niezakupionego przedmiotu."""
    pass


def test_buy_item_requires_auth():
    """Zakup wymaga zalogowania."""
    pass
