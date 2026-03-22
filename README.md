# 🎮 QuizArena — AI-Powered Multiplayer Quiz

Real-time multiplayer quiz game gdzie pytania są generowane na żywo przez AI.

## Stack
- **Backend:** Django 5 + Django Channels + Redis
- **Frontend:** Next.js 14 + TailwindCSS
- **AI:** Google Gemini 2.5 Flash (darmowe!)
- **DB:** PostgreSQL

## Uruchomienie

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # uzupełnij zmienne
python manage.py migrate
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # uzupełnij zmienne
npm run dev
```

### Redis (wymagany do WebSocket)
```bash
docker run -p 6379:6379 redis
```

## Podział pracy
- **Osoba A** — Django: modele, REST API (`apps/rooms/`)
- **Osoba B** — Django: WebSockets, logika gry (`apps/rooms/consumers.py`, `apps/game/`)
- **Osoba C** — Django: AI generator pytań (`apps/ai/`)
- **Osoba D** — Next.js: cały frontend (`frontend/`)

## Flow gry
1. Host tworzy pokój, wybiera kategorie
2. Gracze dołączają przez 6-znakowy kod
3. Host startuje → AI generuje pytanie na żywo
4. 30s timer, gracze odpowiadają
5. Punkty (max 1000 + bonus za szybkość)
6. 10 rund → ekran końcowy
