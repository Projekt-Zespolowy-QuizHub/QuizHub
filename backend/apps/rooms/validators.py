"""Funkcje walidacyjne dla wiadomości WebSocket."""

import re
from html import escape

NICKNAME_MAX_LENGTH = 30
VALID_ANSWER_OPTIONS = frozenset(['A', 'B', 'C', 'D'])
VALID_POWERUPS = frozenset(['fifty_fifty', 'extra_time', 'double_points'])
VALID_MESSAGE_TYPES = frozenset([
    'join', 'rejoin', 'start_game', 'answer', 'use_powerup', 'chat_message',
])

# Znaki HTML niedozwolone w nicku
_HTML_CHARS_RE = re.compile(r'[<>&"\'`]')


def validate_message_type(msg_type) -> tuple[bool, str]:
    """Sprawdza czy typ wiadomości jest znany."""
    if not isinstance(msg_type, str) or msg_type not in VALID_MESSAGE_TYPES:
        return False, f'Nieznany typ wiadomości: {msg_type!r}.'
    return True, msg_type


def validate_nickname(nickname) -> tuple[bool, str]:
    """
    Waliduje nick gracza.

    Returns:
        (True, czysty_nick) lub (False, komunikat_błędu)
    """
    if not isinstance(nickname, str):
        return False, 'Nieprawidłowy format nicku.'
    nickname = nickname.strip()
    if not nickname:
        return False, 'Nick nie może być pusty.'
    if len(nickname) > NICKNAME_MAX_LENGTH:
        return False, f'Nick może mieć maksymalnie {NICKNAME_MAX_LENGTH} znaków.'
    if _HTML_CHARS_RE.search(nickname):
        return False, 'Nick zawiera niedozwolone znaki (<, >, &, ", \', `).'
    return True, nickname


def validate_chat_message(text) -> tuple[bool, str]:
    """
    Waliduje i czyści wiadomość czatu (escape HTML, przycinanie do max długości).

    Returns:
        (True, czysty_tekst) lub (False, komunikat_błędu)
    """
    from .constants import CHAT_MAX_LENGTH

    if not isinstance(text, str):
        return False, 'Nieprawidłowy format wiadomości.'
    text = text.strip()
    if not text:
        return False, 'Wiadomość nie może być pusta.'
    text = escape(text)[:CHAT_MAX_LENGTH]
    return True, text


def validate_answer(answer) -> tuple[bool, str]:
    """
    Waliduje opcję odpowiedzi (A/B/C/D).

    Returns:
        (True, answer) lub (False, komunikat_błędu)
    """
    if answer not in VALID_ANSWER_OPTIONS:
        return False, f'Odpowiedź musi być jedną z: {", ".join(sorted(VALID_ANSWER_OPTIONS))}.'
    return True, answer


def validate_powerup(powerup) -> tuple[bool, str]:
    """
    Waliduje nazwę power-upa.

    Returns:
        (True, powerup) lub (False, komunikat_błędu)
    """
    if powerup not in VALID_POWERUPS:
        return False, f'Nieznany power-up: {powerup!r}.'
    return True, powerup
