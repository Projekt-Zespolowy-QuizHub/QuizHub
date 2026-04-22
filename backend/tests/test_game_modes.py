"""
Testy trybów gry.

UWAGA: Tryby gry (1v1 duel, survival, classic) nie zostały jeszcze
zaimplementowane jako osobne modele/logika w projekcie.
Testy są przygotowane jako szkielet dla przyszłej implementacji.

Aktualna implementacja ma jeden tryb bazowy z konfigurowalnymi rundami.

Oczekiwane tryby (do zaimplementowania):
- 1v1 duel: krótkie rundy, 2 graczy max
- survival: bez limitu rund, eliminacja przy złej odpowiedzi
- classic: standardowy tryb (aktualnie zaimplementowany)
"""
import pytest


pytestmark = pytest.mark.skip(reason='Game modes not yet differentiated in the model')


def test_duel_mode_two_players_only():
    """Tryb 1v1 akceptuje max 2 graczy."""
    pass


def test_duel_mode_shorter_rounds():
    """Tryb 1v1 ma krótsze rundy niż classic."""
    pass


def test_survival_mode_eliminates_on_wrong_answer():
    """W trybie survival gracz jest eliminowany za błędną odpowiedź."""
    pass


def test_survival_mode_no_round_limit():
    """Tryb survival trwa aż do ostatniego gracza."""
    pass


def test_classic_mode_fixed_rounds():
    """Tryb classic ma określoną liczbę rund."""
    pass


def test_classic_mode_no_elimination():
    """W trybie classic nie ma eliminacji."""
    pass
