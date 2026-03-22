# QuizArena — szybki start

## 1. Pobierz zależności

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

## 2. Skonfiguruj środowisko

```bash
# Backend
cd backend
copy .env.example .env
# Uzupełnij .env:
#   GEMINI_API_KEY=  (z https://aistudio.google.com -> Get API key)
#   DJANGO_SECRET_KEY= (możesz wygenerować: python -c "import secrets; print(secrets.token_hex(32))")

# Frontend
cd ../frontend
copy .env.local.example .env.local
```

## 3. Uruchom Redis

```bash
docker run -d -p 6379:6379 --name quiz-redis redis
```

(Alternatywnie zainstaluj Redis natywnie na Windowsie przez WSL)

## 4. Utwórz bazę danych PostgreSQL

```bash
# W psql lub pgAdmin utwórz bazę:
CREATE DATABASE quizarena;
```

Następnie:

```bash
cd backend
python manage.py makemigrations rooms
python manage.py migrate
python manage.py createsuperuser  # opcjonalnie
```

## 5. Uruchom serwery

**Terminal 1 — Backend:**
```bash
cd backend
venv\Scripts\activate
python manage.py runserver
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

## 6. Otwórz grę

Wejdź na http://localhost:3000

---

## Struktura projektu

```
projekt grupowy/
├── backend/
│   ├── apps/
│   │   ├── rooms/          # Modele, REST API, WebSocket consumer
│   │   ├── ai/             # Gemini question generator
│   │   └── game/           # Logika punktacji
│   ├── quizarena/          # Django settings, urls, asgi
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx                        # Strona główna (create/join)
        │   └── room/[code]/
        │       ├── lobby/page.tsx              # Lobby
        │       ├── game/page.tsx               # Ekran gry
        │       └── results/page.tsx            # Wyniki
        └── lib/
            ├── api.ts                          # REST API client
            └── useGameSocket.ts               # WebSocket hook
```

## Podział pracy (przypomnienie)

| Osoba | Zakres |
|-------|--------|
| A | `apps/rooms/models.py`, `views.py`, `urls.py`, `serializers.py` |
| B | `apps/rooms/consumers.py`, `routing.py` (WebSocket + logika gry) |
| C | `apps/ai/generator.py` (Gemini), `apps/game/logic.py` (punktacja) |
| D | Cały `frontend/` |

## Endpointy REST

| Metoda | URL | Opis |
|--------|-----|------|
| POST | `/api/rooms/` | Utwórz pokój |
| POST | `/api/rooms/join/` | Dołącz do pokoju |
| GET  | `/api/rooms/<code>/` | Szczegóły pokoju |
| GET  | `/api/rooms/<code>/history/` | Historia gry |

## WebSocket

Połącz pod: `ws://localhost:8000/ws/room/<code>/`

### Eventy klient → serwer

```json
{ "type": "join", "nickname": "Jakub" }
{ "type": "start_game" }
{ "type": "answer", "nickname": "Jakub", "answer": "B", "response_time_ms": 8420, "round_number": 3 }
```

### Eventy serwer → klient

```json
{ "type": "player_joined", "nickname": "Jakub" }
{ "type": "game_start", "total_rounds": 10, "categories": ["Historia"] }
{ "type": "question", "round_number": 1, "total_rounds": 10, "question": "...", "options": ["A", "B", "C", "D"] }
{ "type": "answer_result", "is_correct": true, "correct_answer": "B", "explanation": "...", "points_earned": 1342, "total_score": 2683 }
{ "type": "game_over", "leaderboard": [{"nickname": "Jakub", "score": 9870}] }
```

## System punktacji

```
Poprawna odpowiedź: 1000 pkt (base)
Bonus za szybkość: max +500 pkt
  bonus = round(500 * (1 - czas_ms / 30000))

Przykłady:
  1s  odpowiedź → 1000 + 483 = 1483 pkt
  10s odpowiedź → 1000 + 333 = 1333 pkt
  30s odpowiedź → 1000 +   0 = 1000 pkt
  Zła odpowiedź → 0 pkt
```
