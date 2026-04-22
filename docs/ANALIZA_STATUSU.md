# QuizArena — Analiza statusu projektu

**Data analizy:** 2026-03-21  
**Źródła:** `docs/STATUS.md`, spec z `docs/superpowers/`, oraz skan kodu backend + frontend

---

## ✅ ZROBIONE (zweryfikowane w kodzie)

### Backend — Auth
- Rejestracja (email + hasło + display_name) — `accounts/views.py: RegisterView`
- Logowanie (sesje Django) — `accounts/views.py: LoginView`
- Wylogowanie — `accounts/views.py: LogoutView`
- Endpoint `/api/auth/me/` — `accounts/views.py: MeView`
- CSRF exempt dla API (proxy Next.js)
- Blokada tworzenia/dołączania do gier dla niezalogowanych (`IsAuthenticated` na CreateRoom/JoinRoom)

### Backend — System gry
- Tworzenie pokoju (wybór kategorii, liczba rund) — `rooms/views.py: CreateRoomView`
- Dołączanie do pokoju (kod 6-znakowy) — `rooms/views.py: JoinRoomView`
- WebSocket real-time (join, start, answer, round_end, ready, game_over) — `rooms/consumers.py`
- AI generator pytań (Gemini 2.5 Flash + pula 30+ offline fallback) — `ai/generator.py`
- Round-robin kategorii — `ai/generator.py: get_category_for_round()`
- Timer 30s na odpowiedź, auto round_end
- System gotowości (przycisk "Gotowy" + auto-advance po 15s)
- Live leaderboard po każdej rundzie
- Standalone async functions (generowanie pytań niezależne od WS)

### Backend — Punktacja
- Base 1000 pkt + bonus za szybkość (max +500) — `game/logic.py`
- Streak multiplier (1.0x → 2.0x) — `game/logic.py: get_streak_multiplier()`
- Reset streaka po błędnej odpowiedzi
- Aktualizacja profilu po grze (total_score, weekly_score, games_played)

### Backend — System znajomych
- Wyszukiwanie po nicku — `accounts/views.py: SearchUsersView`
- Wysyłanie zaproszeń — `accounts/views.py: SendFriendRequestView`
- Akceptacja/odrzucenie — `accounts/views.py: RespondFriendRequestView`
- Lista znajomych — `accounts/views.py: FriendsListView`
- Pending requests — `accounts/views.py: PendingRequestsView`

### Backend — Rankingi
- Ranking globalny — `accounts/views.py: GlobalRankingView`
- Ranking tygodniowy — `accounts/views.py: WeeklyRankingView`
- Ranking znajomych — `accounts/views.py: FriendsRankingView`

### Backend — Profil & Historia
- Statystyki usera (gry, % poprawnych, avg czas, best streak) — `accounts/views.py: UserStatsView`
- Historia gier (data, kategorie, punkty, miejsce) — `accounts/views.py: UserGameHistoryView`
- Player↔User link (FK w modelu Player)

### Backend — Gry publiczne
- Model Room z `is_public` i `scheduled_at` — `rooms/models.py`
- Endpoint `/api/rooms/public/next/` — `rooms/views.py: NextPublicGameView`
- Management command `create_public_game` — `management/commands/create_public_game.py`
- Management command `run_public_game_scheduler` — `management/commands/run_public_game_scheduler.py`
- Management command `reset_weekly_scores` — `management/commands/reset_weekly_scores.py`

### Backend — Testy (37 testów)
- Auth: 6 testów — `tests/test_auth.py`
- Friends: 11 testów — `tests/test_friends.py`
- Rooms: 9 testów — `tests/test_rooms.py`
- Rankings: 4 testy — `tests/test_rankings.py`
- Scoring: 5 testów — `tests/test_scoring.py`
- Accounts: 2 testy — `tests/test_accounts.py`

### Frontend — Strony (14 stron zweryfikowanych)
- Landing (`/`) — `app/page.tsx`
- Login (`/login`) — `app/login/page.tsx`
- Register (`/register`) — `app/register/page.tsx`
- Dashboard (`/dashboard`) — `app/dashboard/page.tsx`
- Create Game (`/create`) — `app/create/page.tsx`
- Join Game (`/join`) — `app/join/page.tsx`
- Profile (`/profile`) — `app/profile/page.tsx`
- Friends (`/friends`) — `app/friends/page.tsx` + `FriendsClient.tsx`
- History (`/history`) — `app/history/page.tsx`
- Ranking (`/ranking`) — `app/ranking/page.tsx`
- Public Game (`/public`) — `app/public/page.tsx`
- Lobby (`/room/[code]/lobby`) — `app/room/[code]/lobby/page.tsx`
- Game (`/room/[code]/game`) — `app/room/[code]/game/page.tsx`
- Results (`/room/[code]/results`) — `app/room/[code]/results/page.tsx`

### Frontend — Architektura
- AuthProvider (React Context) — `lib/AuthProvider.tsx`
- useRequireAuth hook — `lib/useRequireAuth.ts`
- Next.js proxy (rewrites) — `next.config.mjs`
- Server Components (friends, history) — `lib/serverApi.ts`
- useGameSocket hook — `lib/useGameSocket.ts`
- Navbar z badge — `components/Navbar.tsx`

### Frontend — Design
- Gradient fioletowo-niebieski, glass cards, Kahoot-style odpowiedzi
- Mobile responsive (hamburger menu)
- Animacje (fade-in, scale-in, slide-in)

---

## 🔶 W TRAKCIE / CZĘŚCIOWO ZAIMPLEMENTOWANE

### Ranking tygodniowy — uproszczona implementacja
- **Stan:** Działa, ale uproszczony. Pole `weekly_score` jest w modelu `UserProfile` zamiast w oddzielnym modelu `WeeklyScore` (jak w spec). Brak automatycznej granulacji per-tydzień — reset ręcznie przez management command.
- **Brak:** Model `WeeklyScore` z `week_start_date` (lazy upsert per tydzień).

### Streak w modelu Answer — brak dodatkowych pól
- **Stan:** Logika streaka działa w `game/logic.py` i streaki są śledzone na `Player.current_streak` / `Player.best_streak`.
- **Brak:** Pola `streak_at_answer` i `multiplier_applied` w modelu `Answer` (zaplanowane w spec).

### Auto-start gry publicznej
- **Stan:** Scheduler tworzy gry publiczne, endpoint zwraca następną. 
- **Brak:** Consumer nie startuje automatycznie gry gdy nadejdzie `scheduled_at`. Wymaga ręcznego startu.

---

## ❌ NIE ROZPOCZĘTE (zaplanowane, brak kodu)

### Priorytet Wysoki
| Funkcjonalność | Uwagi |
|---|---|
| **Upgrade Gemini API / fallback na OpenAI** | Limit 20 req/dzień na free tier. Brak drugiego providera. |
| **WebSocket reconnect** | `useGameSocket.ts` — `onclose` i `onerror` są puste, brak logiki ponownego łączenia. |

### Priorytet Średni
| Funkcjonalność | Uwagi |
|---|---|
| **Deployment (Docker Compose)** | Brak Dockerfile, docker-compose.yml w projekcie. |
| **Sugestie znajomych** | Brak endpointu "recently-played" ani logiki sugestii na podstawie wspólnych gier. |
| **Szczegóły gry w historii** | Brak drill-down widoku (kliknięcie w grę → lista pytań + odpowiedzi usera). |
| **Zapraszanie znajomych do gry** | Brak modelu `FriendInviteLink`, brak endpointów invite-link. |
| **Walidacja email** | Brak potwierdzenia emaila po rejestracji. |
| **Zmiana / reset hasła** | Brak endpointu password-reset, brak widoku frontend. |

### Priorytet Niski
| Funkcjonalność | Uwagi |
|---|---|
| **Testy E2E** | Brak Playwright/Cypress konfiguracji i plików testowych. |
| **Testy WebSocket** | Brak testów integracyjnych Django Channels consumer. |
| **PWA** | Brak Service Worker, manifest.json, install prompt. |
| **Powiadomienia push** | Brak WS `/ws/notifications/` ani push notifications. |
| **Ulubione kategorie** | Brak w profilu. |
| **Accessibility** | Brak ARIA labels, focus management. |
| **i18n** | UI po angielsku / mieszanko, brak pełnej lokalizacji. |
| **Rate limiting** | Brak throttle/rate limiting middleware w Django. |
| **Admin panel** | Brak niestandardowego panelu admina (domyślny Django admin może być). |

### Brakujące modele (ze specyfikacji)
| Model | Status |
|---|---|
| `WeeklyScore` (user, week_start, score) | ❌ Zastąpiony polem `weekly_score` na `UserProfile` |
| `GameResult` (user, room, final_score, position, stats) | ❌ Brak — historia oparta na query Player+Room |
| `FriendInviteLink` (creator, code, expires_at) | ❌ Brak |

### Brakujące endpointy (ze specyfikacji)
| Endpoint | Status |
|---|---|
| `GET /api/friends/recently-played/` | ❌ |
| `POST /api/friends/invite-link/` | ❌ |
| `POST /api/friends/invite-link/redeem/` | ❌ |
| `DELETE /api/friends/<id>/` (unfriend) | ❌ |
| `POST /api/auth/password-reset/` | ❌ |
| `PATCH /api/profile/me/` (zmiana display_name) | ❌ |
| `GET /api/profile/<nickname>/` (publiczny profil) | ❌ |
| `GET /api/history/<game_id>/` (szczegóły gry) | ❌ |
| `WS /ws/notifications/` (dashboard notifications) | ❌ |

---

## Podsumowanie

| Kategoria | Zrobione | W trakcie | Nie rozpoczęte |
|---|---|---|---|
| Backend - Auth | 6/6 | — | 2 (email validation, password reset) |
| Backend - Gra | 9/9 | 1 (auto-start public) | — |
| Backend - Punktacja | 4/4 | 1 (streak w Answer) | — |
| Backend - Znajomi | 5/5 | — | 4 (invite link, unfriend, recently-played, sugestie) |
| Backend - Rankingi | 3/3 | 1 (WeeklyScore model) | — |
| Backend - Profil/Historia | 3/3 | — | 3 (GameResult, szczegóły gry, publiczny profil) |
| Backend - Gry publiczne | 5/5 | — | — |
| Backend - Testy | 37/37 | — | E2E, WS testy |
| Frontend - Strony | 14/14 | — | — |
| Frontend - Architektura | 6/6 | — | 1 (WS reconnect) |
| Infrastruktura | — | — | Docker, PWA, rate limiting |

**Ogólna ocena:** ~80% core features zaimplementowane i działające. Główne braki to: deployment (Docker), WebSocket reconnect, rozszerzony system znajomych (invite links, unfriend), zarządzanie kontem (reset hasła, walidacja email) i kilka brakujących modeli danych ze specyfikacji.
