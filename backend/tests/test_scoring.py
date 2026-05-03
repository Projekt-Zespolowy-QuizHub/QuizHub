from apps.game.logic import calculate_points


def test_base_points_correct():
    points = calculate_points(True, 15000, streak=0)
    assert points == 1000 + 250  # base + speed bonus


def test_wrong_answer_zero():
    assert calculate_points(False, 5000, streak=5) == 0


def test_streak_multiplier():
    p0 = calculate_points(True, 15000, streak=0)
    p3 = calculate_points(True, 15000, streak=3)
    assert p3 > p0
    assert p3 == round(p0 * 1.4)


def test_streak_caps_at_5():
    p5 = calculate_points(True, 15000, streak=5)
    p10 = calculate_points(True, 15000, streak=10)
    assert p5 == p10


def test_backwards_compatible_no_streak():
    # Bez parametru streak — domyślnie 0, mnożnik 1.0
    points = calculate_points(True, 1000)
    assert points == 1000 + 483
