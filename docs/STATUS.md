# QuizHub — Status Projektu

**Data aktualizacji:** 2026-03-17

---

## Zrobione ✅

### Backend

#### Auth System
- [x] Rejestracja (email + hasło + display_name)
- [x] Logowanie (sesje Django)
- [x] Wylogowanie
- [x] Endpoint `/api/auth/me/` — dane zalogowanego usera
- [x] CSRF exempt dla API (proxy przez Next.js)
- [x] Blokada tworzenia/dołączania do gier dla niezalogowanych

#### System Gry
- [x] Tworzenie pokoju (wybór kategorii, liczba rund)
- [x] Dołączanie do pokoju (kod 6-znakowy)
- [x] WebSocket — real-time komunikacja (join, start, answer, round_end, ready, game_over)
- [x] AI generator pytań (Gemini 2.5 Flash + pula 30+ offline pytań jako fallback)
- [x] Round-robin kategorii — pytania rozdzielone po równo na kategorie
- [x] Timer 30s na odpowiedź, auto round_end po timeout
- [x] System gotowości — przycisk "Gotowy" + auto-advance po 15s
- [x] Live leaderboard po każdej rundzie
- [x] Standalone async functions (generowanie pytań niezależne od połączenia WS)

#### Punktacja
- [x] Punkty za poprawność (1000 base)
- [x] Bonus za szybkość (max +500)
- [x] Streak multiplier (1.0x → 2.0x przy 5+ poprawnych z rzędu)
- [x] Reset streaka po błędnej odpowiedzi
- [x] Aktualizacja profilu po grze (total_score, weekly_score, games_played)

#### System Znajomych
- [x] Wyszukiwanie użytkowników po nicku (`/api/friends/search/`)
- [x] Wysyłanie zaproszeń (`/api/friends/request/`)
- [x] Akceptacja/odrzucenie (`/api/friends/respond/`)
- [x] Lista znajomych (`/api/friends/`)
- [x] Pending requests (`/api/friends/pending/`)

#### Rankingi
- [x] Ranking globalny (`/api/rankings/global/`)
- [x] Ranking tygodniowy (`/api/rankings/weekly/`)
- [x] Ranking znajomych (`/api/rankings/friends/`)

#### Profil & Historia
- [x] Statystyki usera (`/api/profile/stats/`) — gry, % poprawnych, avg czas, best streak
- [x] Historia gier (`/api/profile/history/`) — data, kategorie, punkty, miejsce
- [x] Player↔User link — zalogowani gracze przypisani do profilu

#### Gry Publiczne
- [x] Model Room z `is_public` i `scheduled_at`
- [x] Endpoint `/api/rooms/public/next/` — następna zaplanowana gra
- [x] Management command `create_public_game` — ręczne tworzenie
- [x] Management command `run_public_game_scheduler` — automatyczne co 30 min
- [x] Management command `reset_weekly_scores` — reset tygodniowego rankingu

#### Testy (37 testów ✅)
- [x] Auth: 6 testów (register, login, logout, me, duplicate)
- [x] Friends: 11 testów (search, request, accept, reject, list, duplicates)
- [x] Rooms: 9 testów (create, join, detail, auth guard, public game, user link)
- [x] Rankings: 4 testy (global, weekly, friends, unauth)
- [x] Scoring: 5 testów (base, streak, caps, backwards compat)
- [x] Accounts: 2 testy (profile, unique name)

---

### Frontend

#### Strony (15 stron)
- [x] Landing (`/`) — "Quiz Multiplayer" + CTA
- [x] Login (`/login`) — formularz logowania
- [x] Register (`/register`) — formularz rejestracji
- [x] Dashboard (`/dashboard`) — 3 karty (utwórz/dołącz/publiczna)
- [x] Create Game (`/create`) — kategorie tekstowe + slider rund
- [x] Join Game (`/join`) — kod pokoju
- [x] Profile (`/profile`) — avatar + statystyki z API
- [x] Friends (`/friends`) — wyszukiwanie, zaproszenia, lista (SSR + client)
- [x] History (`/history`) — tabela gier (SSR)
- [x] Ranking (`/ranking`) — 3 taby z API
- [x] Public Game (`/public`) — countdown z API
- [x] Lobby (`/room/[code]/lobby`) — real-time lista graczy
- [x] Game (`/room/[code]/game`) — Kahoot-style kolorowe odpowiedzi
- [x] Results (`/room/[code]/results`) — wynik + leaderboard + pytania

#### Architektura
- [x] AuthProvider (React Context) — współdzielony stan auth
- [x] useRequireAuth hook — redirect niezalogowanych
- [x] Next.js proxy (rewrites) — brak CORS, `/api/*` → backend
- [x] Server Components — friends i history renderowane na serwerze
- [x] serverApi helper — forwardowanie cookies do backendu

#### Design (wg Figmy)
- [x] Gradient fioletowo-niebieski (tło)
- [x] Żółte przyciski (btn-primary)
- [x] Glass cards (bg-white/10 backdrop-blur)
- [x] Żółte avatary z inicjałami
- [x] Kahoot-style odpowiedzi (rose, sky, amber, violet)
- [x] Animacje (fade-in, scale-in, slide-in, stagger, pulse-glow)
- [x] Mobile responsive (hamburger menu, responsive grid)
- [x] Navbar z badge pending requests

---

## Do zrobienia 📋

### Priorytet Wysoki
- [ ] **Gemini API** — upgrade z free tier (limit 20 req/dzień) lub dodać drugi provider (OpenAI fallback)
- [ ] **Auto-start gry publicznej** — consumer powinien automatycznie startować grę publiczną gdy nadejdzie `scheduled_at`
- [ ] **WebSocket reconnect** — auto-reconnect gdy połączenie się zerwie (np. utrata sieci)

### Priorytet Średni
- [ ] **Deployment** — Docker Compose (Django + Redis + PostgreSQL + Next.js)
- [ ] **Sugestie znajomych** — na podstawie wspólnych gier (wymaganie z spec)
- [ ] **Szczegóły gry w historii** — kliknięcie w grę → lista pytań + odpowiedzi usera
- [ ] **Zapraszanie znajomych do gry** — link/kod z lobby, wysyłanie do znajomych
- [ ] **Walidacja email** — potwierdzenie emaila po rejestracji
- [ ] **Zmiana hasła / reset hasła**

### Priorytet Niski
- [ ] **Testy E2E** — Playwright/Cypress dla pełnego flow gry
- [ ] **Testy WebSocket** — integracyjne testy Django Channels consumer
- [ ] **PWA** — Service Worker, offline support, install prompt
- [ ] **Powiadomienia** — push notifications o zaproszeniach do gry
- [ ] **Ulubione kategorie** — w profilu na podstawie historii
- [ ] **Accessibility** — ARIA labels, focus management, keyboard navigation
- [ ] **i18n** — polskie znaki w UI (ą, ę, ś zamiast a, e, s)
- [ ] **Rate limiting** — ochrona API przed abuse
- [ ] **Admin panel** — zarządzanie pytaniami, kategoriami, użytkownikami

---

## Struktura API

```
POST   /api/auth/register/          — rejestracja
POST   /api/auth/login/             — logowanie
POST   /api/auth/logout/            — wylogowanie
GET    /api/auth/me/                — dane usera

GET    /api/profile/stats/          — statystyki usera
GET    /api/profile/history/        — historia gier

GET    /api/friends/                — lista znajomych
GET    /api/friends/search/?q=      — wyszukiwanie
POST   /api/friends/request/        — wysłanie zaproszenia
GET    /api/friends/pending/        — oczekujące zaproszenia
POST   /api/friends/respond/        — akceptacja/odrzucenie

GET    /api/rankings/global/        — ranking globalny
GET    /api/rankings/weekly/        — ranking tygodniowy
GET    /api/rankings/friends/       — ranking znajomych

POST   /api/rooms/                  — tworzenie pokoju (auth required)
POST   /api/rooms/join/             — dołączanie (auth required)
GET    /api/rooms/<code>/           — szczegóły pokoju
GET    /api/rooms/<code>/history/   — historia pytań/wyników
GET    /api/rooms/public/next/      — następna gra publiczna

WS     /ws/room/<code>/            — WebSocket gry
```

## Management Commands

```bash
python manage.py create_public_game --minutes 5 --rounds 10 --categories 3
python manage.py run_public_game_scheduler   # daemon — tworzy gry co 30 min
python manage.py reset_weekly_scores         # cron — co poniedziałek
```

## Testy

```bash
cd backend && ./venv/Scripts/python.exe -m pytest tests/ -v   # 37 testów
cd frontend && npx next build                                  # build check
```
