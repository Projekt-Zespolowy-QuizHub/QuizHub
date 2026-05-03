"""
Testy sezonów.

UWAGA: Model Season nie został jeszcze zaimplementowany w projekcie.
Testy są przygotowane jako szkielet dla przyszłej implementacji.

Oczekiwane funkcjonalności (do zaimplementowania):
- Zarządzanie sezonami (start/end)
- Snapshoty wyników na koniec sezonu
- Historia sezonów
"""
import pytest


pytestmark = pytest.mark.skip(reason='Season model not yet implemented')


def test_create_season():
    """Tworzenie nowego sezonu."""
    pass


def test_season_score_snapshot():
    """Na koniec sezonu wyniki są zapisywane jako snapshot."""
    pass


def test_season_history():
    """Historia poprzednich sezonów jest dostępna."""
    pass


def test_season_leaderboard():
    """Ranking sezonu pokazuje wyniki danego sezonu."""
    pass


def test_season_reset_weekly_scores():
    """Po zakończeniu sezonu tygodniowe wyniki są zerowane."""
    pass
