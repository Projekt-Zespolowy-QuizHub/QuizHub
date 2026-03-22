"""
Logika punktacji QuizArena.

System punktów:
  - Poprawna odpowiedź:  base 1000 pkt
  - Bonus za szybkość:   im szybciej, tym więcej (max +500 pkt)
  - Zła odpowiedź:       0 pkt

Formula bonusu:
  bonus = max(0, round(500 * (1 - response_time_ms / TIME_LIMIT_MS)))

Przykłady:
  - 1s  odpowiedź → 1000 + 483 = 1483 pkt
  - 10s odpowiedź → 1000 + 333 = 1333 pkt
  - 25s odpowiedź → 1000 + 83  = 1083 pkt
  - 30s odpowiedź → 1000 + 0   = 1000 pkt
"""

BASE_POINTS = 1000
MAX_SPEED_BONUS = 500
TIME_LIMIT_MS = 30_000  # 30 sekund

STREAK_MULTIPLIERS = {0: 1.0, 1: 1.0, 2: 1.2, 3: 1.4, 4: 1.6, 5: 2.0}


def get_streak_multiplier(streak: int) -> float:
    return STREAK_MULTIPLIERS.get(min(streak, 5), 1.0)


def calculate_points(is_correct: bool, response_time_ms: int, streak: int = 0) -> int:
    """
    Oblicza punkty za odpowiedź z uwzględnieniem streaka.

    Args:
        is_correct: czy odpowiedź jest poprawna
        response_time_ms: czas odpowiedzi w milisekundach
        streak: aktualna seria poprawnych odpowiedzi

    Returns:
        Liczba punktów (int)
    """
    if not is_correct:
        return 0

    clamped_time = min(response_time_ms, TIME_LIMIT_MS)
    speed_ratio = 1 - (clamped_time / TIME_LIMIT_MS)
    speed_bonus = round(MAX_SPEED_BONUS * speed_ratio)
    base = BASE_POINTS + speed_bonus
    multiplier = get_streak_multiplier(streak)

    return round(base * multiplier)


def get_leaderboard_delta(players_before: list[dict], players_after: list[dict]) -> list[dict]:
    """
    Oblicza zmianę pozycji graczy między rundami.

    Args:
        players_before: lista {'nickname': str, 'score': int} przed rundą
        players_after:  lista {'nickname': str, 'score': int} po rundzie (posortowana)

    Returns:
        Lista z dodatkowym polem 'position_change' (+2, 0, -1 itd.)
    """
    rank_before = {p['nickname']: i for i, p in enumerate(players_before)}

    result = []
    for rank_after, player in enumerate(players_after):
        nick = player['nickname']
        rank_prev = rank_before.get(nick, rank_after)
        result.append({
            **player,
            'position_change': rank_prev - rank_after  # dodatni = awans
        })

    return result
