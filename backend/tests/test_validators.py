"""
Tests for WebSocket validators in apps.rooms.validators.

These are pure Python unit tests — no database access needed.
"""
from apps.rooms.validators import (
    validate_nickname,
    validate_chat_message,
    validate_answer,
    validate_powerup,
    validate_message_type,
)


# ─── validate_nickname ───────────────────────────────────────────────


def test_validate_nickname_valid_returns_true():
    ok, _ = validate_nickname('Alice')
    assert ok is True


def test_validate_nickname_valid_returns_stripped_nick():
    _, value = validate_nickname('  Alice  ')
    assert value == 'Alice'


def test_validate_nickname_empty_string_returns_false():
    ok, _ = validate_nickname('')
    assert ok is False


def test_validate_nickname_whitespace_only_returns_false():
    ok, _ = validate_nickname('   ')
    assert ok is False


def test_validate_nickname_too_long_returns_false():
    ok, _ = validate_nickname('A' * 31)
    assert ok is False


def test_validate_nickname_exactly_30_chars_returns_true():
    ok, _ = validate_nickname('A' * 30)
    assert ok is True


def test_validate_nickname_html_lt_returns_false():
    ok, _ = validate_nickname('bad<nick')
    assert ok is False


def test_validate_nickname_html_gt_returns_false():
    ok, _ = validate_nickname('bad>nick')
    assert ok is False


def test_validate_nickname_html_ampersand_returns_false():
    ok, _ = validate_nickname('bad&nick')
    assert ok is False


def test_validate_nickname_html_double_quote_returns_false():
    ok, _ = validate_nickname('bad"nick')
    assert ok is False


def test_validate_nickname_html_single_quote_returns_false():
    ok, _ = validate_nickname("bad'nick")
    assert ok is False


def test_validate_nickname_html_backtick_returns_false():
    ok, _ = validate_nickname('bad`nick')
    assert ok is False


def test_validate_nickname_non_string_int_returns_false():
    ok, _ = validate_nickname(123)
    assert ok is False


def test_validate_nickname_non_string_none_returns_false():
    ok, _ = validate_nickname(None)
    assert ok is False


def test_validate_nickname_non_string_list_returns_false():
    ok, _ = validate_nickname(['Alice'])
    assert ok is False


# ─── validate_chat_message ───────────────────────────────────────────


def test_validate_chat_message_valid_returns_true():
    ok, _ = validate_chat_message('Hello there!')
    assert ok is True


def test_validate_chat_message_valid_returns_text():
    _, text = validate_chat_message('Hello there!')
    assert 'Hello there' in text


def test_validate_chat_message_empty_string_returns_false():
    ok, _ = validate_chat_message('')
    assert ok is False


def test_validate_chat_message_whitespace_only_returns_false():
    ok, _ = validate_chat_message('   ')
    assert ok is False


def test_validate_chat_message_non_string_int_returns_false():
    ok, _ = validate_chat_message(42)
    assert ok is False


def test_validate_chat_message_non_string_none_returns_false():
    ok, _ = validate_chat_message(None)
    assert ok is False


def test_validate_chat_message_very_long_gets_truncated():
    """Messages longer than CHAT_MAX_LENGTH (200) should be truncated, not rejected."""
    long_msg = 'x' * 500
    ok, text = validate_chat_message(long_msg)
    assert ok is True
    assert len(text) <= 200


def test_validate_chat_message_html_chars_are_escaped():
    """HTML characters in chat messages should be escaped, not rejected."""
    ok, text = validate_chat_message('<script>alert(1)</script>')
    assert ok is True
    assert '<script>' not in text


# ─── validate_answer ─────────────────────────────────────────────────


def test_validate_answer_a_returns_true():
    ok, _ = validate_answer('A')
    assert ok is True


def test_validate_answer_b_returns_true():
    ok, _ = validate_answer('B')
    assert ok is True


def test_validate_answer_c_returns_true():
    ok, _ = validate_answer('C')
    assert ok is True


def test_validate_answer_d_returns_true():
    ok, _ = validate_answer('D')
    assert ok is True


def test_validate_answer_valid_returns_same_value():
    _, value = validate_answer('B')
    assert value == 'B'


def test_validate_answer_invalid_x_returns_false():
    ok, _ = validate_answer('X')
    assert ok is False


def test_validate_answer_lowercase_returns_false():
    ok, _ = validate_answer('a')
    assert ok is False


def test_validate_answer_empty_string_returns_false():
    ok, _ = validate_answer('')
    assert ok is False


def test_validate_answer_non_string_int_returns_false():
    ok, _ = validate_answer(1)
    assert ok is False


def test_validate_answer_non_string_none_returns_false():
    ok, _ = validate_answer(None)
    assert ok is False


# ─── validate_powerup ────────────────────────────────────────────────


def test_validate_powerup_fifty_fifty_returns_true():
    ok, _ = validate_powerup('fifty_fifty')
    assert ok is True


def test_validate_powerup_extra_time_returns_true():
    ok, _ = validate_powerup('extra_time')
    assert ok is True


def test_validate_powerup_double_points_returns_true():
    ok, _ = validate_powerup('double_points')
    assert ok is True


def test_validate_powerup_valid_returns_same_value():
    _, value = validate_powerup('extra_time')
    assert value == 'extra_time'


def test_validate_powerup_invalid_name_returns_false():
    ok, _ = validate_powerup('nuke')
    assert ok is False


def test_validate_powerup_empty_string_returns_false():
    ok, _ = validate_powerup('')
    assert ok is False


def test_validate_powerup_non_string_returns_false():
    ok, _ = validate_powerup(None)
    assert ok is False


def test_validate_powerup_wrong_case_returns_false():
    ok, _ = validate_powerup('Fifty_Fifty')
    assert ok is False


# ─── validate_message_type ───────────────────────────────────────────


def test_validate_message_type_join_returns_true():
    ok, _ = validate_message_type('join')
    assert ok is True


def test_validate_message_type_start_game_returns_true():
    ok, _ = validate_message_type('start_game')
    assert ok is True


def test_validate_message_type_answer_returns_true():
    ok, _ = validate_message_type('answer')
    assert ok is True


def test_validate_message_type_valid_returns_same_value():
    _, value = validate_message_type('join')
    assert value == 'join'


def test_validate_message_type_invalid_returns_false():
    ok, _ = validate_message_type('explode')
    assert ok is False


def test_validate_message_type_empty_string_returns_false():
    ok, _ = validate_message_type('')
    assert ok is False


def test_validate_message_type_non_string_int_returns_false():
    ok, _ = validate_message_type(42)
    assert ok is False


def test_validate_message_type_non_string_none_returns_false():
    ok, _ = validate_message_type(None)
    assert ok is False
