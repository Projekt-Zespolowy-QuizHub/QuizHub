"""Stałe współdzielone przez moduł rooms."""

# Minimalna liczba graczy do automatycznego startu publicznej gry
MIN_PLAYERS_AUTO_START = 2

# Czas oczekiwania (w sekundach) przed wysłaniem player_left po rozłączeniu
GRACE_PERIOD_SECONDS = 30

# Dodatkowy czas przyznawany przez power-up extra_time
EXTRA_TIME_SECONDS = 15

# Maksymalna długość wiadomości czatu
CHAT_MAX_LENGTH = 200

# Interwał między publicznymi grami (minuty)
PUBLIC_GAME_INTERVAL_MINUTES = 30

# Minimalna różnica czasu (sekundy) do następnego slotu — jeśli za blisko, przesuń
MIN_SECONDS_BEFORE_NEXT_SLOT = 120

# Pula kategorii dostępnych w grze publicznej
QUIZ_CATEGORIES = [
    'Historia', 'Nauka', 'Geografia', 'Film i Seriale',
    'Gaming', 'Muzyka', 'Sport', 'Technologia',
    'Jedzenie', 'Sztuka',
]
