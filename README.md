# QuizHub

<!-- LOGO PLACEHOLDER -->
<p align="center">
  <img src="docs/logo-placeholder.png" alt="QuizHub Logo" width="200"/>
</p>

<p align="center">
  <strong>Multiplayer quiz game with real-time gameplay, AI-generated questions, and social features</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Django-5.x-092E20?style=flat&logo=django&logoColor=white" alt="Django"/>
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat&logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?style=flat&logo=tailwindcss&logoColor=white" alt="TailwindCSS"/>
  <img src="https://img.shields.io/badge/Google_Gemini-AI-4285F4?style=flat&logo=google&logoColor=white" alt="Gemini AI"/>
  <img src="https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
</p>

---

## Production Deployment

- Production app runs at **https://quizhub.tech**
- `http://quizhub.tech` redirects to HTTPS
- `https://www.quizhub.tech` is covered by the same deployment
- SSL/TLS certificate is issued by **Let's Encrypt**
- Production Docker and Nginx deployment config is maintained on branch `deployment`

Production setup on this branch includes:

- Nginx reverse proxy for frontend, API, static files, media, and WebSocket traffic
- HTTPS on port `443`
- ACME / Let's Encrypt support for certificate issuance and renewal
- Secure production cookie settings for Django

---

## Features

- **Real-time multiplayer** — WebSocket-based gameplay with instant score updates
- **AI-generated questions** — Google Gemini 2.5 Flash generates fresh Polish-language questions each game
- **10 quiz categories** — Historia, Nauka, Geografia, Film i Seriale, Gaming, Muzyka, Sport, Technologia, Jedzenie, Sztuka
- **Private rooms** — 6-character room code, 5–20 rounds, host controls the start
- **Public games** — Scheduled games auto-starting every 30 minutes with ≥ 2 players
- **Streak & scoring system** — Speed bonus, streak multipliers (up to 2×), 1 000 base points per question
- **Power-ups** — 50/50 (remove 2 wrong answers), Extra Time (+15 s), Double Points
- **In-game chat** — Real-time text chat in the lobby
- **Achievements** — 10 unlockable badges (First Blood, Perfect Round, Speed Demon, Comeback King, etc.)
- **Rankings** — Global all-time, weekly, and friends-only leaderboards
- **Social system** — Friend requests and accepted-friends leaderboard
- **Avatar system** — 20 emoji avatars selectable per player
- **Game history** — Full round-by-round breakdown of last 50 games
- **Detailed stats** — Category accuracy, trend analysis, performance over time
- **Reconnect support** — 30-second grace period + exponential-backoff reconnect (up to 5 retries, 1 s → 10 s)
- **Offline fallback** — 90 pre-written questions used when Gemini API is unavailable

---

## Architecture Overview

```
Browser ──── HTTP/REST ───► Django REST API ──► PostgreSQL
Browser ──── WebSocket ───► Django Channels ──► Redis (channel layer)
                                     │
                                     └──► Google Gemini API (question generation)

Next.js (SSR + CSR) handles routing, auth state, and WebSocket management.
```

- **Backend:** Django 5 + Django Channels 4 (ASGI) serving REST and WebSocket
- **Frontend:** Next.js 14 App Router, React 18, TailwindCSS
- **Database:** PostgreSQL (SQLite for development/testing)
- **Message broker:** Redis (InMemoryChannelLayer as fallback)
- **AI:** Google Gemini 2.5 Flash — generates 4-option multiple-choice questions in Polish

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed Mermaid diagrams.

---

## Screenshots

| Landing | Dashboard | Lobby |
|---------|-----------|-------|
| ![Landing](screens/Landing.png) | ![Dashboard](screens/Dashboard.png) | ![Lobby](screens/Lobby.png) |

| Game | Results | Ranking |
|------|---------|---------|
| ![Game](screens/Game.png) | ![Game results](screens/Game%20results.png) | ![Ranking](screens/Ranking.png) |

| Create Room | Join Room | Public Games |
|-------------|-----------|--------------|
| ![Create game](screens/Create%20game.png) | ![Join game](screens/Join%20game.png) | ![Public Game](screens/Public%20Game.png) |

| Profile | Friends | History |
|---------|---------|---------|
| ![Profile](screens/Profile.png) | ![Friends](screens/Friends.png) | ![History](screens/History.png) |

---

## Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- Redis 7+
- PostgreSQL 14+ (or SQLite for local dev)

### 1. Clone the repository

```bash
git clone <repo-url>
cd quizarena
```

### 2. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Backend environment variables

Create `backend/.env`:

```env
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quizarena
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your-gemini-api-key-here
ALLOWED_HOSTS=localhost,127.0.0.1
```

> **SQLite (quick start):** Remove or leave `DATABASE_URL` unset — Django will use `db.sqlite3`.
> **Redis (optional):** Without `REDIS_URL`, Django Channels falls back to `InMemoryChannelLayer`.

### 4. Database setup

```bash
# Apply migrations
python manage.py migrate

# Load initial achievements
python manage.py loaddata achievements

# (Optional) Create a superuser
python manage.py createsuperuser
```

### 5. Frontend setup

```bash
cd ../frontend

# Install dependencies
npm install
```

### 6. Frontend environment variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 7. Start Redis

```bash
# Linux / macOS
redis-server

# Windows (Docker)
docker run -p 6379:6379 redis:7
```

### 8. Run the servers

**Backend (terminal 1):**
```bash
cd backend
python manage.py runserver
```

**Frontend (terminal 2):**
```bash
cd frontend
npm run dev
```

The app is now available at **http://localhost:3000**.
Django admin is at **http://localhost:8000/admin/**.

### 9. Schedule public games (optional)

```bash
cd backend
python manage.py run_public_game_scheduler
```

---

## Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DJANGO_SECRET_KEY` | Yes | — | Django secret key |
| `DEBUG` | No | `False` | Enable debug mode |
| `DATABASE_URL` | No | SQLite | PostgreSQL connection URL |
| `REDIS_URL` | No | In-memory | Redis connection URL |
| `GEMINI_API_KEY` | No | — | Google Gemini API key (fallback questions used without it) |
| `ALLOWED_HOSTS` | No | `localhost` | Comma-separated allowed hosts |

### Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend REST API base URL |
| `NEXT_PUBLIC_WS_URL` | Yes | Backend WebSocket base URL |

---

## API Endpoints

Base URL: `http://localhost:8000/api/`

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register/` | — | Register a new user |
| `POST` | `/auth/login/` | — | Login and receive token |
| `POST` | `/auth/logout/` | Token | Logout |
| `GET` | `/auth/me/` | Token | Get current user profile |
| `GET` | `/auth/users/search/?q=nick` | Token | Search users by display name |

### Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/rooms/` | Token | Create a new private room |
| `POST` | `/rooms/join/` | Token | Join a room by code |
| `GET` | `/rooms/<code>/` | — | Get room details and current players |
| `GET` | `/rooms/<code>/history/` | — | Full game history with questions |
| `GET` | `/rooms/public/next/` | — | Next scheduled public game |

### Rankings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/rankings/global/` | — | Top 50 players (all-time score) |
| `GET` | `/rankings/weekly/` | — | Top 50 players (weekly score) |
| `GET` | `/rankings/friends/` | Token | Friends + self leaderboard |

### Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/profile/stats/` | Token | Detailed player statistics |
| `GET` | `/profile/history/` | Token | Last 50 games |
| `GET` | `/profile/achievements/` | Token | All achievements with unlock status |
| `PATCH` | `/profile/avatar/` | Token | Update avatar |

### Friends

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/friends/` | Token | List accepted friends |
| `POST` | `/friends/request/` | Token | Send friend request |
| `GET` | `/friends/pending/` | Token | Incoming pending requests |
| `POST` | `/friends/respond/` | Token | Accept or reject a request |

---

## WebSocket Events

Endpoint: `ws://localhost:8000/ws/room/{room_code}/`

### Client → Server

| Type | Key Payload Fields | Description |
|------|--------------------|-------------|
| `join` | `nickname`, `avatar` | Join the room |
| `rejoin` | `nickname` | Reconnect after disconnect |
| `start_game` | — | Start the game (host only) |
| `answer` | `nickname`, `answer` (A/B/C/D), `response_time_ms`, `round_number` | Submit answer |
| `use_powerup` | `powerup`, `nickname`, `round_number` | Activate a power-up |
| `chat_message` | `text` (max 200 chars) | Send a chat message |

### Server → Client

| Type | Key Payload Fields | Description |
|------|--------------------|-------------|
| `player_joined` | `nickname`, `avatar` | A player joined the room |
| `player_left` | `nickname` | A player disconnected |
| `game_start` | `total_rounds`, `categories` | Game is starting |
| `question` | `round_number`, `total_rounds`, `question`, `options` | New question for this round |
| `answer_result` | `is_correct`, `correct_answer`, `explanation`, `points_earned`, `total_score`, `streak`, `multiplier` | Answer feedback |
| `powerup_result` | `powerup`, `removed_options?`, `extra_seconds?` | Power-up effect applied |
| `game_state` | `room_status`, `current_round`, `total_rounds`, `score`, `current_question` | Full state snapshot on rejoin |
| `game_over` | `leaderboard` | Game ended with final ranking |
| `chat_message` | `nickname`, `text` | Received chat message |

---

## Game Modes

### Private Room

1. Host creates a room — selects 1–3 categories and 5–20 rounds
2. A 6-character alphanumeric code is generated and shared
3. Players join by entering the code
4. Host presses **Start** when ready
5. Questions are generated by Gemini AI in real time (Polish language)
6. Each round: 30 seconds to answer, then correct answer + explanation revealed
7. Final leaderboard shown at the end

### Public Game

1. Games are scheduled every 30 minutes
2. Any logged-in player can join from the **Public Games** page
3. Game auto-starts when ≥ 2 players are in the lobby
4. Same rules as private rooms but with a wider audience

### Scoring

| Component | Points |
|-----------|--------|
| Correct answer (base) | 1 000 |
| Speed bonus (max, < 1 s) | +500 |
| Speed bonus (scaled, up to 30 s) | 0–500 |
| Streak multiplier (1–2 correct) | ×1.0 |
| Streak multiplier (3 correct) | ×1.2 |
| Streak multiplier (4 correct) | ×1.4 |
| Streak multiplier (5 correct) | ×1.6 |
| Streak multiplier (6+ correct) | ×2.0 |

---

## Testing

### Backend (pytest)

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=apps --cov-report=term-missing

# Run specific test file
pytest tests/test_consumers.py -v

# Run async consumer tests (WebSocket)
pytest tests/test_consumers.py -v --asyncio-mode=auto
```

### Frontend (Playwright E2E)

```bash
cd frontend

# Install browsers (first time only)
npx playwright install

# Run all E2E tests
npx playwright test

# Run in headed mode
npx playwright test --headed

# Run a specific test file
npx playwright test tests/game.spec.ts
```

---

## Project Structure

```
quizarena/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── conftest.py
│   ├── quizarena/                  # Django project config
│   │   ├── settings.py
│   │   ├── asgi.py                 # ASGI + Channels routing
│   │   ├── urls.py
│   │   ├── auth.py                 # Token authentication
│   │   └── throttles.py
│   ├── apps/
│   │   ├── accounts/               # Users, profiles, friends, achievements
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   ├── achievements.py
│   │   │   └── urls.py
│   │   ├── rooms/                  # Rooms, players, questions, answers
│   │   │   ├── consumers.py        # WebSocket consumer (GameConsumer)
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   ├── routing.py
│   │   │   ├── constants.py
│   │   │   └── urls.py
│   │   ├── game/
│   │   │   └── logic.py            # Scoring calculations
│   │   └── ai/
│   │       └── generator.py        # Gemini question generator
│   └── tests/
│       ├── test_accounts.py
│       ├── test_auth.py
│       ├── test_consumers.py
│       ├── test_friends.py
│       ├── test_rankings.py
│       ├── test_rooms.py
│       └── test_scoring.py
├── frontend/
│   ├── package.json
│   └── src/
│       ├── app/                    # Next.js App Router pages
│       │   ├── page.tsx            # Landing
│       │   ├── dashboard/
│       │   ├── create/
│       │   ├── join/
│       │   ├── public/
│       │   ├── ranking/
│       │   ├── friends/
│       │   ├── history/
│       │   ├── stats/
│       │   ├── profile/
│       │   └── room/[code]/
│       │       ├── lobby/
│       │       ├── game/
│       │       └── results/
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── TabBar.tsx
│       │   ├── StatusBanner.tsx    # WebSocket connection banner
│       │   └── LoadingSpinner.tsx
│       └── lib/
│           ├── useGameSocket.ts    # WebSocket hook with reconnect
│           ├── useAuth.ts
│           ├── AuthProvider.tsx
│           ├── api.ts
│           └── soundManager.ts
├── docs/
│   └── ARCHITECTURE.md
├── screens/                        # UI screenshots (14 PNG files)
└── README.md
```

---

## Contributors

| Name | Role |
|------|------|
| [Team Member 1] | — |
| [Team Member 2] | — |
| [Team Member 3] | — |
| [Team Member 4] | — |

---

## License

This project is for academic purposes. All rights reserved.
