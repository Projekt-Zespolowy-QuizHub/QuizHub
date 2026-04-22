## Instrukcja Git — Krok po kroku

> **WAŻNE — tylko do użytku wewnętrznego**
> Poniższe komendy służą do przygotowania repozytorium GitHub z historią commitów odzwierciedlającą iteracyjny rozwój projektu.

> **UWAGA: Fazy można łączyć — na jedne zajęcia pushujesz 2 fazy, na inne 1. Dostosuj daty do swoich terminów zajęć.**

---

### WAŻNE: Daty commitów

Między fazami zmień daty commitów żeby wyglądały naturalnie (co 1-2 tygodnie). Użyj:
```
GIT_AUTHOR_DATE='2026-03-22T20:00:00' GIT_COMMITTER_DATE='2026-03-22T20:00:00' git commit -m "..."
```

---

### WAŻNE: Usuń stare branche Claude

Jeśli w repo są branche `claude/*` (worktrees), usuń je przed pushem:

**Linux/Mac:**
```bash
git branch --list "claude/*" | xargs git branch -D
```

**Windows CMD:**
```cmd
for /f "tokens=1" %b in ('git branch --list "claude/*"') do git branch -D %b
```

---

### === PRZYGOTOWANIE (jednorazowo) ===

```bash
# 1. Stwórz repo na GitHub (QuizArena, prywatne) przez interfejs web
# 2. Dodaj remote
git remote add origin https://github.com/USER/QuizArena.git
```

---

### === CZYSZCZENIE — usuń z indeksu ignorowane pliki ===

Po dodaniu `.gitignore` usuń z śledzenia pliki które powinny być ignorowane:

```bash
git rm -r --cached frontend/.next/
git rm -r --cached frontend/node_modules/
git rm -r --cached backend/venv/
git rm -r --cached backend/db.sqlite3
git rm -r --cached backend/staticfiles/
git rm -r --cached .claude/
# Usuń __pycache__ rekursywnie
git rm -r --cached $(git ls-files --ignored --exclude-standard -z | tr '\0' '\n' | grep __pycache__)
# Lub alternatywnie:
git rm -r --cached $(git ls-files | grep "__pycache__")
```

---

### === FAZA 1: MVP — Autoryzacja + Podstawowa Gra ===
**Sugerowana data: 2026-03-22**

```bash
git checkout -b phase-1

git add .gitignore
git add backend/manage.py
git add backend/conftest.py
git add backend/requirements.txt
git add backend/quizarena/__init__.py
git add backend/quizarena/settings.py
git add backend/quizarena/asgi.py
git add backend/quizarena/urls.py
git add backend/apps/__init__.py
git add backend/apps/accounts/__init__.py
git add backend/apps/accounts/apps.py
git add backend/apps/accounts/admin.py
git add backend/apps/accounts/models.py
git add backend/apps/accounts/serializers.py
git add backend/apps/accounts/views.py
git add backend/apps/accounts/urls.py
git add backend/apps/accounts/migrations/__init__.py
git add backend/apps/accounts/migrations/0001_initial.py
git add backend/apps/rooms/__init__.py
git add backend/apps/rooms/apps.py
git add backend/apps/rooms/admin.py
git add backend/apps/rooms/models.py
git add backend/apps/rooms/serializers.py
git add backend/apps/rooms/views.py
git add backend/apps/rooms/urls.py
git add backend/apps/rooms/routing.py
git add backend/apps/rooms/consumers.py
git add backend/apps/rooms/constants.py
git add backend/apps/rooms/migrations/__init__.py
git add backend/apps/rooms/migrations/0001_initial.py
git add backend/apps/game/__init__.py
git add backend/apps/game/apps.py
git add backend/apps/game/logic.py
git add backend/apps/ai/__init__.py
git add backend/apps/ai/apps.py
git add backend/apps/ai/generator.py
git add backend/.env.example
git add frontend/package.json
git add frontend/tsconfig.json
git add frontend/next-env.d.ts
git add "frontend/.env.local.example"
git add frontend/src/app/layout.tsx
git add frontend/src/app/page.tsx
git add frontend/src/app/globals.css
git add frontend/src/app/login/page.tsx
git add frontend/src/app/register/page.tsx
git add frontend/src/app/create/page.tsx
git add frontend/src/app/join/page.tsx
git add "frontend/src/app/room/[code]/lobby/page.tsx"
git add "frontend/src/app/room/[code]/game/page.tsx"
git add "frontend/src/app/room/[code]/results/page.tsx"
git add frontend/src/components/Navbar.tsx
git add frontend/src/components/LoadingSpinner.tsx
git add frontend/src/lib/AuthProvider.tsx
git add frontend/src/lib/useAuth.ts
git add frontend/src/lib/useRequireAuth.ts
git add frontend/src/lib/api.ts
git add frontend/src/lib/useGameSocket.ts
git add frontend/src/lib/constants.ts

GIT_AUTHOR_DATE='2026-03-22T10:00:00' GIT_COMMITTER_DATE='2026-03-22T10:00:00' \
git commit -m "feat: MVP - auth, rooms, quiz game with AI (Faza 1)"

git push -u origin phase-1
git checkout main
git merge phase-1
git push origin main
```

---

### === FAZA 2: Funkcje Społecznościowe + Polishing ===
**Sugerowana data: 2026-03-22 (kilka godzin po Fazie 1 — dużo pracy pierwszego dnia)**

```bash
git checkout -b phase-2

git add backend/apps/accounts/migrations/0002_userprofile_weekly_score.py
git add backend/apps/accounts/migrations/0003_friendship.py
git add backend/apps/accounts/models.py
git add backend/apps/accounts/serializers.py
git add backend/apps/accounts/views.py
git add backend/apps/accounts/urls.py
git add backend/apps/rooms/models.py
git add backend/apps/rooms/serializers.py
git add backend/apps/rooms/views.py
git add backend/apps/rooms/migrations/0002_answer_basic.py
git add frontend/src/app/profile/page.tsx
git add frontend/src/app/ranking/page.tsx
git add frontend/src/app/history/page.tsx
git add frontend/src/app/dashboard/page.tsx
git add frontend/src/app/friends/page.tsx
git add frontend/src/app/friends/FriendsClient.tsx
git add frontend/src/components/Toast.tsx
git add frontend/src/components/ToastContainer.tsx
git add frontend/src/lib/ToastContext.tsx
git add frontend/src/app/template.tsx

GIT_AUTHOR_DATE='2026-03-22T20:00:00' GIT_COMMITTER_DATE='2026-03-22T20:00:00' \
git commit -m "feat: social features - friends, rankings, game history, toasts (Faza 2)"

git push -u origin phase-2
git checkout main
git merge phase-2
git push origin main
```

---

### === FAZA 3: Zaawansowana Rozgrywka ===
**Sugerowana data: 2026-04-05**

```bash
git checkout -b phase-3

git add backend/apps/rooms/migrations/0002_player_best_streak_player_current_streak.py
git add backend/apps/rooms/migrations/0002_questionpack_customquestion_room_pack.py
git add backend/apps/rooms/migrations/0003_player_user_room_is_public_room_scheduled_at.py
git add backend/apps/rooms/migrations/0004_answer_streak_fields.py
git add backend/apps/rooms/migrations/0006_merge_20260321_2155.py
git add backend/apps/rooms/models.py
git add backend/apps/rooms/serializers.py
git add backend/apps/rooms/views.py
git add backend/apps/rooms/urls.py
git add backend/apps/rooms/consumers.py
git add backend/apps/rooms/validators.py
git add backend/apps/game/logic.py
git add backend/apps/rooms/management/__init__.py
git add backend/apps/rooms/management/commands/__init__.py
git add backend/apps/rooms/management/commands/reset_weekly_scores.py
git add frontend/src/app/packs/page.tsx
git add frontend/src/app/packs/create/page.tsx
git add "frontend/src/app/packs/[id]/edit/page.tsx"
git add frontend/src/app/duel/page.tsx
git add frontend/src/app/matchmaking/page.tsx
git add frontend/src/app/survival/page.tsx
git add "frontend/src/app/room/[code]/replay/page.tsx"
git add "frontend/src/app/share/[code]/page.tsx"
git add frontend/src/components/StatusBanner.tsx
git add frontend/src/lib/soundManager.ts

GIT_AUTHOR_DATE='2026-04-05T10:00:00' GIT_COMMITTER_DATE='2026-04-05T10:00:00' \
git commit -m "feat: advanced gameplay - powerups, duel, survival, streaks, packs, replay (Faza 3)"

git push -u origin phase-3
git checkout main
git merge phase-3
git push origin main
```

---

### === FAZA 4: Turnieje i Klany ===
**Sugerowana data: 2026-04-05 (kilka godzin po Fazie 3)**

```bash
git checkout -b phase-4

git add backend/apps/accounts/migrations/0002_challenge.py
git add backend/apps/accounts/migrations/0004_achievements_avatars.py
git add backend/apps/accounts/migrations/0005_alter_userprofile_avatar.py
git add backend/apps/accounts/migrations/0006_merge_0002_challenge_0005_alter_userprofile_avatar.py
git add backend/apps/accounts/migrations/0007_season_clan_claninvite_clanmembership_seasonresult.py
git add backend/apps/accounts/migrations/0008_shop_system.py
git add backend/apps/accounts/migrations/0009_seed_shop_items.py
git add backend/apps/rooms/migrations/0005_publictournamentconfig.py
git add backend/apps/rooms/migrations/0007_room_game_mode_alter_publictournamentconfig_id.py
git add backend/apps/accounts/models.py
git add backend/apps/accounts/serializers.py
git add backend/apps/accounts/views.py
git add backend/apps/accounts/urls.py
git add backend/apps/accounts/achievements.py
git add backend/apps/rooms/models.py
git add backend/apps/rooms/views.py
git add backend/apps/rooms/urls.py
git add backend/apps/rooms/consumers.py
git add backend/apps/accounts/management/__init__.py
git add backend/apps/accounts/management/commands/__init__.py
git add backend/apps/accounts/management/commands/generate_daily_challenges.py
git add backend/apps/accounts/management/commands/manage_seasons.py
git add backend/apps/rooms/management/commands/create_public_game.py
git add backend/apps/rooms/management/commands/run_public_game_scheduler.py
git add frontend/src/app/achievements/page.tsx
git add frontend/src/app/clans/page.tsx
git add frontend/src/app/clans/create/page.tsx
git add "frontend/src/app/clans/[id]/page.tsx"
git add frontend/src/app/tournaments/page.tsx
git add frontend/src/app/tournaments/create/page.tsx
git add "frontend/src/app/tournaments/[id]/page.tsx"
git add frontend/src/app/shop/page.tsx
git add frontend/src/app/public/page.tsx
git add frontend/src/components/TournamentBanner.tsx
git add frontend/src/components/NotificationsMount.tsx
git add frontend/src/lib/avatars.ts
git add frontend/src/lib/useNotifications.ts

GIT_AUTHOR_DATE='2026-04-05T20:00:00' GIT_COMMITTER_DATE='2026-04-05T20:00:00' \
git commit -m "feat: tournaments, clans, shop, achievements, seasons, daily challenges (Faza 4)"

git push -u origin phase-4
git checkout main
git merge phase-4
git push origin main
```

---

### === FAZA 5: Jakość Produktu — UX i Dostępność ===
**Sugerowana data: 2026-04-19**

```bash
git checkout -b phase-5

git add backend/apps/accounts/consumers.py
git add backend/quizarena/asgi.py
git add backend/quizarena/auth.py
git add backend/quizarena/throttles.py
git add backend/apps/accounts/admin.py
git add backend/apps/rooms/admin.py
git add frontend/src/app/stats/page.tsx
git add frontend/src/lib/i18n.ts
git add frontend/src/lib/LocaleContext.tsx
git add frontend/src/components/LanguageSwitcher.tsx
git add frontend/src/components/Skeleton.tsx
git add frontend/src/components/ErrorBoundary.tsx
git add frontend/src/components/NotFound.tsx
git add frontend/src/components/TabBar.tsx
git add frontend/src/app/layout.tsx
git add frontend/src/components/Navbar.tsx
git add frontend/src/app/globals.css
git add frontend/public/manifest.json
git add frontend/public/sw.js
git add frontend/public/icon-192.png
git add frontend/public/icon-512.png

GIT_AUTHOR_DATE='2026-04-19T20:00:00' GIT_COMMITTER_DATE='2026-04-19T20:00:00' \
git commit -m "feat: dark mode, i18n PL/EN, PWA, responsive, skeleton loading, rate limiting (Faza 5)"

git push -u origin phase-5
git checkout main
git merge phase-5
git push origin main
```

---

### === FAZA 6: Wdrożenie i Jakość Kodu (finalna) ===
**Sugerowana data: 2026-05-03**

```bash
git checkout -b phase-6

# Docker
git add docker/dev/Dockerfile.backend
git add docker/dev/Dockerfile.frontend
git add docker/prod/Dockerfile.backend
git add docker/prod/Dockerfile.frontend
git add docker/prod/nginx/Dockerfile
git add docker/prod/nginx/nginx.conf
git add docker/prod/entrypoint.sh
git add docker-compose.dev.yml
git add .env.example

# CI/CD
git add .github/workflows/ci.yml

# Testy backendowe
git add backend/conftest.py
git add backend/tests/__init__.py
git add backend/tests/test_auth.py
git add backend/tests/test_accounts.py
git add backend/tests/test_account_management.py
git add backend/tests/test_friends.py
git add backend/tests/test_friends_extended.py
git add backend/tests/test_achievements.py
git add backend/tests/test_rooms.py
git add backend/tests/test_consumers.py
git add backend/tests/test_game_modes.py
git add backend/tests/test_custom_packs.py
git add backend/tests/test_daily_challenges.py
git add backend/tests/test_rankings.py
git add backend/tests/test_scoring.py
git add backend/tests/test_seasons.py
git add backend/tests/test_clans.py
git add backend/tests/test_tournaments.py
git add backend/tests/test_shop.py
git add backend/tests/test_stats.py
git add backend/tests/test_powerups.py
git add backend/tests/test_replay.py
git add backend/tests/test_websocket_extended.py
git add backend/tests/test_admin_api.py

# Seed data
git add backend/apps/rooms/management/commands/seed_data.py

# Testy E2E
git add frontend/playwright.config.ts
git add frontend/e2e/helpers.ts
git add frontend/e2e/auth.spec.ts
git add frontend/e2e/game.spec.ts
git add frontend/e2e/room.spec.ts
git add frontend/e2e/ranking.spec.ts
git add frontend/e2e/shop.spec.ts
git add frontend/e2e/stats.spec.ts
git add frontend/e2e/profile.spec.ts
git add frontend/e2e/friends.spec.ts
git add frontend/e2e/clans.spec.ts
git add frontend/e2e/tournaments.spec.ts
git add frontend/e2e/daily-challenges.spec.ts
git add frontend/e2e/custom-packs.spec.ts
git add frontend/e2e/matchmaking.spec.ts
git add frontend/e2e/survival.spec.ts
git add frontend/e2e/duel.spec.ts
git add frontend/e2e/powerups.spec.ts
git add frontend/e2e/replay.spec.ts
git add frontend/e2e/responsive.spec.ts
git add frontend/e2e/i18n.spec.ts
git add frontend/e2e/dark-mode.spec.ts
git add frontend/e2e/admin.spec.ts
git add frontend/e2e/toast.spec.ts

# Dokumentacja
git add README.md
git add SETUP.md
git add docs/ARCHITECTURE.md
git add docs/STATUS.md
git add docs/ANALIZA_STATUSU.md
git add docs/AUDIT_REPORT.md

GIT_AUTHOR_DATE='2026-05-03T20:00:00' GIT_COMMITTER_DATE='2026-05-03T20:00:00' \
git commit -m "feat: Docker, CI/CD, full test suite (unit+E2E), docs, seed data (Faza 6)"

git push -u origin phase-6
git checkout main
git merge phase-6
git push origin main
```

---

# QuizArena — Plan Prezentacji w 6 Fazach

> **WAŻNE — tylko do użytku wewnętrznego**
> Dokument opisuje kolejność prezentowania funkcjonalności prowadzącemu.
> Kod już istnieje — pokazujemy go etapami, jakby był rozwijany iteracyjnie.

---

## Zespół i role

| Osoba | Rola |
|-------|------|
| **Jakub** | Backend lead (Django, WebSocket, logika gry) |
| **Anna** | Frontend lead (Next.js, UI, komponenty) |
| **Piotr** | Backend + DevOps (API, baza danych, migracje) |
| **Marta** | Frontend + Design (strony, UX, style) |

---

# FAZA 1: „MVP — Autoryzacja + Podstawowa Gra"
**Prezentacja: sesja 1 (tygodnie 1–2)**

## Co pokazujemy

Rejestracja i logowanie, tworzenie pokoju, dołączanie do pokoju, rozgrywka quizowa w czasie rzeczywistym z pytaniami generowanymi przez AI, ekran wyników.

---

## Pliki BACKEND — istniejące w tej fazie

### Konfiguracja projektu Django
```
backend/manage.py
backend/conftest.py                          ← tylko podstawowe fixtures (db, client)
backend/requirements.txt                     ← Django 5, DRF, Channels, psycopg2, redis, google-generativeai, pytest

backend/quizarena/__init__.py
backend/quizarena/settings.py                ← INSTALLED_APPS, DATABASES, CHANNEL_LAYERS, CORS, JWT
backend/quizarena/asgi.py                    ← ASGI + routing WebSocket
backend/quizarena/urls.py                    ← /api/accounts/ + /api/rooms/ + /ws/
```

### App: accounts (tylko autentykacja)
```
backend/apps/__init__.py
backend/apps/accounts/__init__.py
backend/apps/accounts/apps.py
backend/apps/accounts/admin.py               ← tylko UserProfile w adminie
backend/apps/accounts/models.py              ← tylko model UserProfile (username, email, score, avatar placeholder)
backend/apps/accounts/serializers.py         ← RegisterSerializer, LoginSerializer, UserProfileSerializer (podstawowy)
backend/apps/accounts/views.py               ← register, login (JWT), token_refresh, me, logout
backend/apps/accounts/urls.py                ← /register/, /login/, /token/refresh/, /me/, /logout/

backend/apps/accounts/migrations/__init__.py
backend/apps/accounts/migrations/0001_initial.py
```

### App: rooms (pokoje + gra)
```
backend/apps/rooms/__init__.py
backend/apps/rooms/apps.py
backend/apps/rooms/admin.py
backend/apps/rooms/models.py                 ← Room (code, host, status, topic), Player (user, room, score, is_ready)
backend/apps/rooms/serializers.py            ← RoomSerializer, PlayerSerializer
backend/apps/rooms/views.py                  ← create_room, join_room, room_detail, start_game, get_questions
backend/apps/rooms/urls.py                   ← /rooms/, /rooms/<code>/, /rooms/<code>/join/, /rooms/<code>/start/
backend/apps/rooms/routing.py                ← WebSocket: ws/room/<code>/
backend/apps/rooms/consumers.py              ← GameConsumer: connect/disconnect, player_ready, submit_answer, game flow
backend/apps/rooms/constants.py             ← QUESTION_COUNT, ANSWER_TIME_LIMIT, POINTS_PER_CORRECT

backend/apps/rooms/migrations/__init__.py
backend/apps/rooms/migrations/0001_initial.py
```

### App: game (logika)
```
backend/apps/game/__init__.py
backend/apps/game/apps.py
backend/apps/game/logic.py                   ← calculate_score(), determine_winner(), next_question()
```

### App: ai (generowanie pytań)
```
backend/apps/ai/__init__.py
backend/apps/ai/apps.py
backend/apps/ai/generator.py                 ← generate_questions(topic, count) → lista pytań z opcjami i odpowiedzią
```

### Pliki środowiskowe
```
backend/.env.example                         ← SECRET_KEY, DATABASE_URL, REDIS_URL, GEMINI_API_KEY
.gitignore
```

---

## Pliki FRONTEND — istniejące w tej fazie

### Konfiguracja
```
frontend/package.json                        ← next, react, typescript, tailwindcss, lucide-react
frontend/tsconfig.json
frontend/next-env.d.ts
frontend/.env.local.example                  ← NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
```

### Layout i strona główna
```
frontend/src/app/layout.tsx                  ← HTML shell, AuthProvider, GlobalCSS
frontend/src/app/page.tsx                    ← Landing: hero, CTA "Stwórz grę" / "Dołącz"
frontend/src/app/globals.css                 ← Tailwind + podstawowe zmienne CSS
```

### Strony autoryzacji
```
frontend/src/app/login/page.tsx              ← formularz login + JWT storage
frontend/src/app/register/page.tsx           ← formularz rejestracji
```

### Strony gry
```
frontend/src/app/create/page.tsx             ← formularz: temat, liczba pytań, tryb (tylko Classic)
frontend/src/app/join/page.tsx               ← wpisz kod pokoju
frontend/src/app/room/[code]/lobby/page.tsx  ← lista graczy, "Gotowy", przycisk Start (host)
frontend/src/app/room/[code]/game/page.tsx   ← pytanie + 4 opcje + timer + wyniki rundy
frontend/src/app/room/[code]/results/page.tsx ← ranking końcowy, przycisk "Zagraj znowu"
```

### Komponenty
```
frontend/src/components/Navbar.tsx           ← logo, linki nawigacji, przycisk Wyloguj
frontend/src/components/LoadingSpinner.tsx   ← prosty spinner
```

### Biblioteki / hooki
```
frontend/src/lib/AuthProvider.tsx            ← context: user, token, login(), logout()
frontend/src/lib/useAuth.ts                  ← hook useAuth()
frontend/src/lib/useRequireAuth.ts           ← redirect na /login jeśli niezalogowany
frontend/src/lib/api.ts                      ← fetch wrapper z JWT headerem, funkcje API
frontend/src/lib/useGameSocket.ts            ← WebSocket hook: connect, send, obsługa zdarzeń gry
frontend/src/lib/constants.ts               ← API_URL, WS_URL, stałe aplikacji
```

---

## Co UKRYWAMY w tej fazie

- Friends system, ranking, historia gier, profil
- Power-upy, tryby Duel/Survival
- Turnieje, klany, daily challenges
- Shop, achievementy, avatary
- i18n, dark mode, dźwięki
- Docker, CI/CD, testy (nie pokazujemy)
- Migracje: 0002+ w accounts i rooms

---

## Podział pracy — Faza 1

| Osoba | Zadanie |
|-------|---------|
| **Jakub** | Django project setup, accounts models/views/serializers, JWT auth, GameConsumer (WebSocket), game flow logic |
| **Anna** | Next.js setup, AuthProvider, login/register pages, Navbar, api.ts, useGameSocket.ts |
| **Piotr** | Room models/views, AI question generator, settings.py (CORS, DB, Redis), routing WebSocket |
| **Marta** | Create/Join/Lobby/Game/Results pages, LoadingSpinner, globals.css, Tailwind setup |

---

## Punkty prezentacji — Faza 1

1. **"Zbudowaliśmy pełny flow autoryzacji"** — JWT, odświeżanie tokenów, chronione trasy
2. **"Gra działa w czasie rzeczywistym"** — WebSocket przez Django Channels, Redis jako channel layer
3. **"Pytania generuje AI"** — Gemini API, dynamicznie na podstawie tematu
4. **"Architektura REST + WebSocket"** — REST do zarządzania, WS do gry

### Pytania od prowadzącego i odpowiedzi

**P: Dlaczego WebSocket zamiast polling?**
O: Polling przy 10 graczach to 10 × 1 req/sek = 10 rps bez powodu. WebSocket utrzymuje jedno połączenie, wysyłamy zdarzenia tylko gdy coś się dzieje. Latencja ~5ms vs ~200ms.

**P: Jak działa generowanie pytań AI?**
O: Wysyłamy prompt do Gemini API z tematem i liczbą pytań, odpowiedź parsujemy do JSON. Pytania są generowane przed startem gry i cache'owane w bazie.

**P: Co jeśli Redis padnie?**
O: W tej wersji gra przestanie działać — Redis jest wymagany dla Channel Layers. W kolejnych fazach dodamy graceful degradation.

---

## Sprint Retrospective — Faza 1

**Co poszło dobrze:**
- Django Channels setup był szybszy niż oczekiwano dzięki dobrej dokumentacji
- Podział na 4 osoby z osobnymi modułami (auth / rooms / AI / frontend) pozwolił pracować równolegle bez konfliktów
- Tailwind CSS znacząco przyspiesza stylowanie

**Co było trudne:**
- Synchronizacja stanu gry między WebSocket a React — race condition przy szybkim odpowiadaniu
- Konfiguracja CORS dla WebSocket (inny nagłówek niż HTTP)
- Debugowanie Gemini API — czasem zwraca JSON z błędami składniowymi

---

---

# FAZA 2: „Funkcje Społecznościowe + Polishing"
**Prezentacja: sesja 2 (tygodnie 3–4)**

## Co pokazujemy

System znajomych, globalne rankingi, historia rozgrywek, strona profilu użytkownika, powiadomienia toast, przejścia między stronami, tygodniowe punkty.

---

## Pliki dodane w tej fazie (DELTA od Fazy 1)

### BACKEND — nowe/zmienione pliki

```
# Nowe migracje accounts
backend/apps/accounts/migrations/0002_userprofile_weekly_score.py   ← pole weekly_score w UserProfile
backend/apps/accounts/migrations/0003_friendship.py                 ← model Friendship

# Zaktualizowane pliki
backend/apps/accounts/models.py      ← +Friendship(requester, receiver, status), +weekly_score, +games_played, +wins
backend/apps/accounts/serializers.py ← +FriendshipSerializer, +UserProfileDetailSerializer (stats)
backend/apps/accounts/views.py       ← +send_friend_request, +accept/reject_request, +friends_list,
                                        +user_rankings (top 100 by score), +game_history, +public_profile

backend/apps/accounts/urls.py        ← +/friends/, /friends/requests/, /friends/<id>/accept|reject|remove/
                                        +/rankings/, /history/, /users/<username>/

# Zaktualizowane rooms
backend/apps/rooms/models.py         ← +Answer(room, player, question_index, answer, is_correct, time_ms)
                                        +Room.ended_at, Room.total_rounds
backend/apps/rooms/serializers.py    ← +AnswerSerializer, +GameSummarySerializer
backend/apps/rooms/views.py          ← +game_history_detail, +room_results
backend/apps/rooms/migrations/0002_answer_basic.py  ← model Answer bez streak fields
```

### FRONTEND — nowe pliki

```
# Nowe strony
frontend/src/app/profile/page.tsx        ← avatar, statystyki, ostatnie gry, achievementy (placeholder)
frontend/src/app/ranking/page.tsx        ← tabela top 100, filtr: globalny / tygodniowy
frontend/src/app/history/page.tsx        ← lista minionych gier z wynikiem i datą
frontend/src/app/dashboard/page.tsx      ← powitanie, skróty do gry, niedawni znajomi, quick stats
frontend/src/app/friends/page.tsx        ← lista znajomych, zaproszenia
frontend/src/app/friends/FriendsClient.tsx ← komponent client-side do zarządzania znajomymi

# Nowe komponenty
frontend/src/components/Toast.tsx        ← komponent powiadomienia (success/error/info/warning)
frontend/src/components/ToastContainer.tsx ← kontener z pozycjonowaniem

# Nowe biblioteki
frontend/src/lib/ToastContext.tsx        ← context: showToast(), hideToast()
frontend/src/app/template.tsx            ← page transitions (opacity fade między trasami)
```

---

## Co UKRYWAMY w tej fazie

- Power-upy, tryby Duel/Survival/Replay
- Turnieje, klany, shop, daily challenges
- Achievementy (są w profilu jako placeholder "coming soon")
- i18n, dark mode, dźwięki
- Docker, CI/CD, testy

---

## Podział pracy — Faza 2

| Osoba | Zadanie |
|-------|---------|
| **Jakub** | Friendship model + views + migracje, game history endpoint, Answer model |
| **Anna** | Profile page, Dashboard, Toast system, template.tsx transitions |
| **Piotr** | Rankings views + SQL queries, game summary serializer, room Answer recording |
| **Marta** | Friends page + FriendsClient, History page, Ranking page UI |

---

## Punkty prezentacji — Faza 2

1. **"Zbudowaliśmy system społecznościowy"** — znajomi, zaproszenia, akceptacja/odrzucenie
2. **"Rankingi i historia gier"** — globalny ranking, tygodniowy reset, archiwum rozgrywek
3. **"Profil użytkownika"** — statystyki: win rate, liczba gier, najlepszy wynik
4. **"UX improvements"** — toast notifications, animowane przejścia stron

### Pytania od prowadzącego i odpowiedzi

**P: Jak działa system znajomych — co jeśli zaprosimy siebie nawzajem?**
O: Sprawdzamy w bazie czy istnieje Friendship(A,B) LUB Friendship(B,A) przed utworzeniem — unique constraint + logika w views.py.

**P: Jak liczycie tygodniowy ranking?**
O: Pole `weekly_score` w UserProfile, management command `reset_weekly_scores` uruchamiany co poniedziałek (Celery Beat lub cron). W kolejnej fazie pokażemy pełny scheduler.

**P: Dlaczego Toast zamiast alert()?**
O: alert() blokuje wątek UI, nie da się stylować, nie działa na mobile. Toast to non-blocking, dismiss po N sekundach, pełna kontrola nad wyglądem.

---

## Sprint Retrospective — Faza 2

**Co poszło dobrze:**
- Toast Context to wzorzec który użyjemy wszędzie — dobra decyzja architecturalna
- Friendship model z enum statusów (pending/accepted/rejected) jest prosty i rozszerzalny
- Profile page skłoniła nas do porządnego zaprojektowania endpoint `/me` z pełnymi statystykami

**Co było trudne:**
- N+1 queries przy pobieraniu historii gier — musieliśmy dodać `select_related` i `prefetch_related`
- Ranking tygodniowy — edge case: co jeśli cron nie odpali? Dodaliśmy fallback na `updated_at`

---

---

# FAZA 3: „Zaawansowana Rozgrywka"
**Prezentacja: sesja 3 (tygodnie 5–6)**

## Co pokazujemy

Power-upy, tryb 1v1 Duel z matchmakingiem, tryb Survival (życia), system serii odpowiedzi z mnożnikiem punktów, replay gry, custom question packs, strona udostępniania wyników.

---

## Pliki dodane w tej fazie (DELTA od Fazy 2)

### BACKEND — nowe/zmienione pliki

```
# Migracje
backend/apps/rooms/migrations/0002_player_best_streak_player_current_streak.py
backend/apps/rooms/migrations/0002_questionpack_customquestion_room_pack.py
backend/apps/rooms/migrations/0003_player_user_room_is_public_room_scheduled_at.py
backend/apps/rooms/migrations/0004_answer_streak_fields.py
backend/apps/rooms/migrations/0006_merge_20260321_2155.py

# Zaktualizowane modele
backend/apps/rooms/models.py       ← +QuestionPack(name, owner, is_public), +CustomQuestion(pack, content, options, answer)
                                      +Player.current_streak, Player.best_streak, Player.lives (Survival)
                                      +Player.powerup_used, +Answer.streak_at_time, Answer.time_bonus
                                      +Room.game_mode (classic/duel/survival), Room.pack (FK→QuestionPack)
                                      +Room.is_public, Room.scheduled_at

backend/apps/rooms/serializers.py  ← +QuestionPackSerializer, +CustomQuestionSerializer
                                      +ReplayDataSerializer (pełne dane do odtworzenia gry)

backend/apps/rooms/views.py        ← +create_pack, +edit_pack, +delete_pack, +list_packs (public + własne)
                                      +add_question, +edit_question, +delete_question
                                      +matchmaking_queue, +matchmaking_status, +cancel_matchmaking
                                      +replay_data (pełne dane o grze do replay)
                                      +share_result (publiczny endpoint bez auth)
                                      +apply_powerup (50/50, extra_time, shield)

backend/apps/rooms/urls.py         ← +/packs/, /packs/<id>/, /packs/<id>/questions/
                                      +/matchmaking/, /matchmaking/status/, /matchmaking/cancel/
                                      +/rooms/<code>/replay/, /share/<code>/
                                      +/rooms/<code>/powerup/

backend/apps/rooms/consumers.py    ← +obsługa game_mode: survival (lives, game over per player)
                                      +obsługa powerup events
                                      +streak multiplier w logice punktacji
                                      +duel: 2-player matchmaking via group

backend/apps/rooms/validators.py   ← walidacja paczek pytań (min 5 pytań, maks 100, unikalność)

backend/apps/game/logic.py         ← +calculate_streak_bonus(), +apply_powerup_effect()
                                      +survival_round_result(), +duel_score_comparison()

# Nowe management commands
backend/apps/rooms/management/__init__.py
backend/apps/rooms/management/commands/__init__.py
backend/apps/rooms/management/commands/reset_weekly_scores.py   ← zeruje weekly_score co poniedziałek
```

### FRONTEND — nowe pliki

```
# Nowe strony
frontend/src/app/packs/page.tsx                 ← lista paczek (własne + publiczne)
frontend/src/app/packs/create/page.tsx          ← kreator paczki: nazwa, opis, pytania
frontend/src/app/packs/[id]/edit/page.tsx       ← edycja istniejącej paczki
frontend/src/app/duel/page.tsx                  ← matchmaking 1v1: szukanie przeciwnika, status
frontend/src/app/matchmaking/page.tsx           ← queue status, cancel, progress indicator
frontend/src/app/survival/page.tsx              ← info o trybie, wejście do lobby
frontend/src/app/room/[code]/replay/page.tsx    ← odtwarzanie gry krok po kroku
frontend/src/app/share/[code]/page.tsx          ← publiczna strona wyników (bez logowania)

# Zaktualizowane komponenty
frontend/src/components/StatusBanner.tsx        ← baner statusu WebSocket (reconnecting, disconnected)

# Nowe biblioteki
frontend/src/lib/soundManager.ts                ← dźwięki: correct/wrong/countdown/win/lose (Web Audio API)
```

---

## Co UKRYWAMY w tej fazie

- Turnieje, klany, shop, daily challenges, achievementy
- i18n, dark mode (soundManager jest, ale bez UI toggle)
- Docker, CI/CD, testy

---

## Podział pracy — Faza 3

| Osoba | Zadanie |
|-------|---------|
| **Jakub** | GameConsumer: survival lives, power-upy, streak multiplier, duel matchmaking logic |
| **Anna** | Replay page, Share page, Packs pages (create/edit), soundManager |
| **Piotr** | QuestionPack + CustomQuestion models/views/serializers, validators, migracje |
| **Marta** | Duel + Matchmaking + Survival pages UI, StatusBanner, power-up UI w game page |

---

## Punkty prezentacji — Faza 3

1. **"3 tryby gry"** — Classic (wszyscy grają), Duel (1v1 matchmaking), Survival (życia)
2. **"Power-upy zmieniają rozgrywkę"** — 50/50 (usuwa 2 złe opcje), Extra Time, Shield
3. **"Streak multiplier"** — seria 3+ poprawnych = mnożnik x1.5, x2, x2.5 — motywuje do grania bez przerwy
4. **"Custom question packs"** — każdy może stworzyć własną paczkę i udostępnić publicznie
5. **"Replay"** — możesz obejrzeć całą grę po jej zakończeniu

### Pytania od prowadzącego i odpowiedzi

**P: Jak zapobiegacie cheatowaniu przy power-upach?**
O: Power-up jest walidowany server-side w consumers.py — klient wysyła tylko `powerup_type`, serwer sprawdza czy gracz go ma i czy nie użył już w tej grze. Stan power-upów jest w modelu Player w bazie.

**P: Jak działa matchmaking?**
O: Redis sorted set — gracz dołącza do kolejki z timestamp. Consumer sprawdza co 2 sekundy czy jest drugi gracz w kolejce. Jeśli tak — tworzy Room, obaj dostają `match_found` event.

**P: Jak działa replay bez przechowywania wideo?**
O: Przechowujemy każdą odpowiedź w tabeli Answer z time_ms (czas od startu pytania). Replay odtwarza sekwencję pytań i odpowiedzi z tymi samymi timestampami — po stronie frontendu.

---

## Sprint Retrospective — Faza 3

**Co poszło dobrze:**
- Validators dla paczek pytań to dobra decyzja — zablokowały złe dane już przy imporcie
- SoundManager z Web Audio API działa lepiej niż `<audio>` — brak opóźnień przy odtwarzaniu
- Replay okazał się łatwiejszy niż myślano bo Answer model był już zaplanowany

**Co było trudne:**
- Duel matchmaking: race condition gdy dwóch graczy jednocześnie dołącza — rozwiązane Redis SETNX
- Survival: gdy gracz straci życia musi zostać w pokoju jako widz — trzeba było przebudować consumer state machine
- Power-up 50/50 musi wybierać deterministycznie te same opcje dla wszystkich — seed z question_index

---

---

# FAZA 4: „Funkcje Społecznościowe — Turnieje i Klany"
**Prezentacja: sesja 4 (tygodnie 7–8)**

## Co pokazujemy

Turnieje z systemem drabinki, klany (grupy graczy), codzienne wyzwania, sklep z walutą i avatarami, system achievementów, system sezonów z ligami.

---

## Pliki dodane w tej fazie (DELTA od Fazy 3)

### BACKEND — nowe/zmienione pliki

```
# Migracje accounts
backend/apps/accounts/migrations/0002_challenge.py          ← model Challenge (daily/weekly)
backend/apps/accounts/migrations/0004_achievements_avatars.py ← model Achievement, pole avatar w UserProfile
backend/apps/accounts/migrations/0005_alter_userprofile_avatar.py ← zmiana avatar field na CharField
backend/apps/accounts/migrations/0006_merge_0002_challenge_0005_alter_userprofile_avatar.py
backend/apps/accounts/migrations/0007_season_clan_claninvite_clanmembership_seasonresult.py
backend/apps/accounts/migrations/0008_shop_system.py
backend/apps/accounts/migrations/0009_seed_shop_items.py    ← dane: 20 avatarów w sklepie

# Migracje rooms
backend/apps/rooms/migrations/0005_publictournamentconfig.py
backend/apps/rooms/migrations/0007_room_game_mode_alter_publictournamentconfig_id.py

# Nowe/zaktualizowane modele accounts
backend/apps/accounts/models.py    ← +Achievement(user, type, earned_at, metadata)
                                      +Challenge(type, topic, target_score, expires_at, reward_coins)
                                      +Season(number, starts_at, ends_at, is_active)
                                      +SeasonResult(user, season, rank, score, league)
                                      +Clan(name, tag, description, owner, members, max_members)
                                      +ClanInvite(clan, inviter, invitee, status)
                                      +ClanMembership(user, clan, role, joined_at, weekly_contribution)
                                      +ShopItem(name, type, price_coins, avatar_emoji, is_active)
                                      +ShopPurchase(user, item, purchased_at)
                                      +UserProfile: +coins, +total_xp, +current_league, +clan FK

backend/apps/accounts/serializers.py ← +AchievementSerializer, +ChallengeSerializer
                                        +SeasonSerializer, +ClanSerializer, +ClanMembershipSerializer
                                        +ShopItemSerializer, +ShopPurchaseSerializer

backend/apps/accounts/views.py      ← +achievements_list, +daily_challenges, +complete_challenge
                                       +seasons_list, +current_season, +season_leaderboard
                                       +clan_list, +create_clan, +join_clan, +leave_clan
                                       +clan_detail, +clan_members, +invite_to_clan
                                       +shop_items, +buy_item, +owned_items
                                       +update_avatar

backend/apps/accounts/urls.py       ← +/achievements/, /daily-challenges/
                                       +/seasons/, /seasons/current/, /seasons/<id>/leaderboard/
                                       +/clans/, /clans/<id>/, /clans/<id>/members/, /clans/invite/
                                       +/shop/, /shop/buy/, /shop/owned/
                                       +/avatar/

backend/apps/accounts/achievements.py ← logika: check_achievements(user, event_type, metadata)
                                          ACHIEVEMENT_DEFINITIONS = { first_win, win_streak_5, ... }

# Rooms — turnieje i publiczne gry
backend/apps/rooms/models.py        ← +PublicTournamentConfig(topic, schedule_cron, max_players, prize_coins)
                                       +Room.game_mode rozszerzony o 'tournament'

backend/apps/rooms/views.py         ← +tournament_list, +tournament_detail, +join_tournament
                                       +public_games_list, +join_public_game

backend/apps/rooms/urls.py          ← +/tournaments/, /tournaments/<id>/, /tournaments/<id>/join/
                                       +/public/, /public/<code>/join/

backend/apps/rooms/consumers.py     ← +tournament bracket progression
                                       +prize distribution na zakończenie turnieju

# Nowe management commands
backend/apps/accounts/management/__init__.py
backend/apps/accounts/management/commands/__init__.py
backend/apps/accounts/management/commands/generate_daily_challenges.py  ← generuje daily challenges każdy dzień o 00:00
backend/apps/accounts/management/commands/manage_seasons.py             ← zamknij stary sezon, otwórz nowy, rozdaj nagrody

backend/apps/rooms/management/commands/create_public_game.py       ← tworzy publiczną grę wg konfiguracji
backend/apps/rooms/management/commands/run_public_game_scheduler.py ← scheduler publicznych gier (co godzinę)
```

### FRONTEND — nowe pliki

```
# Nowe strony
frontend/src/app/achievements/page.tsx          ← galeria achievementów: zdobyte (z datą) + locked
frontend/src/app/clans/page.tsx                 ← lista klanów: wyszukiwanie, moje klany
frontend/src/app/clans/create/page.tsx          ← kreator klanu: nazwa, tag (3 litery), opis
frontend/src/app/clans/[id]/page.tsx            ← profil klanu: członkowie, ranking tygodniowy, historia
frontend/src/app/tournaments/page.tsx           ← lista turniejów: nadchodzące, trwające, archiwum
frontend/src/app/tournaments/create/page.tsx    ← (admin only) tworzenie turnieju
frontend/src/app/tournaments/[id]/page.tsx      ← drabinka turnieju, matchupy, wyniki
frontend/src/app/shop/page.tsx                  ← sklep: avatary, powiadomienia, filtr kategorii
frontend/src/app/public/page.tsx                ← lista publicznych gier (dołącz bez kodu)

# Nowe komponenty
frontend/src/components/TournamentBanner.tsx    ← banner "Turniej za 10 minut!" w Navbar
frontend/src/components/NotificationsMount.tsx  ← mount point dla WS powiadomień accounts

# Nowe biblioteki
frontend/src/lib/avatars.ts                     ← mapowanie slug→emoji dla 50+ avatarów
frontend/src/lib/useNotifications.ts            ← hook: WS /ws/notifications/, nowe zaproszenia, alerty
```

---

## Co UKRYWAMY w tej fazie

- i18n, dark mode, PWA
- Dźwięki (soundManager jest, ale nie promujemy)
- Docker, CI/CD, testy
- Admin panel

---

## Podział pracy — Faza 4

| Osoba | Zadanie |
|-------|---------|
| **Jakub** | Tournament bracket logic w consumer, achievements.py + triggerowanie po grze, season management command |
| **Anna** | Shop page + koszyk, Achievements page, NotificationsMount + useNotifications hook |
| **Piotr** | Clan models/views/serializers, daily challenges management command, public game scheduler |
| **Marta** | Clan pages (list/create/detail), Tournaments pages, TournamentBanner, Public games page |

---

## Punkty prezentacji — Faza 4

1. **"System klanów"** — zakładanie klanów, zaproszenia, ranking tygodniowy klanów
2. **"Turnieje z drabinką"** — automatyczne matchupy, awansowanie w turnieju
3. **"Daily Challenges"** — codzienne wyzwanie z nagrodą w monetach, reset o północy
4. **"Sklep i waluta"** — zdobywaj monety grając, kupuj avatary i kosmetyki
5. **"Achievementy"** — 20+ osiągnięć, automatycznie przyznawane po spełnieniu warunków
6. **"System sezonów"** — 4 ligi (Bronze→Diamond), reset co miesiąc z nagrodami

### Pytania od prowadzącego i odpowiedzi

**P: Jak działa drabinka turnieju?**
O: Przy zapisach dobieramy uczestników losowo w pary. Po każdej grze winner przechodzi dalej — bracket stored w Redis jako JSON. Przy nieparzystej liczbie — bye (automatyczny awans).

**P: Jak monety są bezpieczne przed manipulacją?**
O: Monety zmieniają się tylko server-side — przy zakończeniu gry, kupnie w sklepie, daily challenge. Klient nigdy nie wysyła `+coins`, tylko requesty do konkretnych endpointów z walidacją.

**P: Achievementy są sprawdzane real-time?**
O: `check_achievements(user, event)` wywoływane po każdym znaczącym evencie (koniec gry, first win, etc.). Jest O(N) gdzie N=liczba achievementów (ok. 25) — szybkie.

---

## Sprint Retrospective — Faza 4

**Co poszło dobrze:**
- achievements.py jako osobny moduł z definicjami to czyste rozwiązanie — łatwo dodać nowe
- Sklep z wstępnie załadowanymi itemami (migration 0009) = gotowe demo od razu
- useNotifications hook z WebSocket accounts consumer działa elegancko z NotificationsMount

**Co było trudne:**
- Tournament bracket dla nieparzystej liczby — edge case z BYE trudny do przetestowania
- Daily challenges muszą być unikalnie generowane dla każdego dnia — SHA256 seed z daty
- Clan weekly contribution — trzeba było patchować consumers.py by aktualizował ClanMembership.weekly_contribution po każdej grze

---

---

# FAZA 5: „Jakość Produktu — UX i Dostępność"
**Prezentacja: sesja 5 (tygodnie 9–10)**

## Co pokazujemy

Ciemny motyw, internacjonalizacja (PL/EN), PWA (instalacja na telefonie), dźwięki (Web Audio), animacje przejść, skeleton loading states, responsywność mobilna, strona statystyk, admin panel, ErrorBoundary.

---

## Pliki dodane w tej fazie (DELTA od Fazy 4)

### BACKEND — nowe/zmienione pliki

```
# Accounts consumer (WebSocket powiadomień)
backend/apps/accounts/consumers.py     ← NotificationConsumer: connect/disconnect
                                          wysyła: friend_request, achievement_unlocked,
                                          tournament_starting, clan_invite

# Routing WebSocket
backend/quizarena/asgi.py              ← +ws/notifications/ → NotificationConsumer

# Auth utilities
backend/quizarena/auth.py              ← get_user_from_token() dla WebSocket auth
                                          JWTAuthMiddleware dla ASGI

# Throttling
backend/quizarena/throttles.py         ← AnonRateThrottle (20/min), UserRateThrottle (100/min)
                                          GameActionThrottle (10/sec per user)
                                          — dodane do settings.py DEFAULT_THROTTLE_CLASSES

# Admin panel rozszerzony
backend/apps/accounts/admin.py         ← UserProfileAdmin z filtrami, akcją ban/unban
                                          AchievementAdmin, ClanAdmin
backend/apps/rooms/admin.py            ← RoomAdmin z filtrem po game_mode
                                          QuestionPackAdmin z inline CustomQuestion
```

### FRONTEND — nowe pliki

```
# Nowa strona
frontend/src/app/stats/page.tsx          ← zaawansowane statystyki: wykresy win rate po czasie,
                                            ulubione tematy, najlepszy tryb, streaki historyczne

# Internationalizacja
frontend/src/lib/i18n.ts                 ← słownik PL/EN: ~400 kluczy (wszystkie texty UI)
frontend/src/lib/LocaleContext.tsx       ← context: locale (pl|en), setLocale(), t() funkcja

# Komponenty UI
frontend/src/components/LanguageSwitcher.tsx ← toggle PL/EN w Navbar
frontend/src/components/Skeleton.tsx         ← skeleton loader: SkeletonCard, SkeletonTable, SkeletonProfile
frontend/src/components/ErrorBoundary.tsx    ← catches React errors, pokazuje fallback UI
frontend/src/components/NotFound.tsx         ← custom 404 z linkami nawigacji
frontend/src/components/TabBar.tsx           ← dolna nawigacja mobilna (5 ikon)

# Aktualizacje istniejących plików
frontend/src/app/layout.tsx              ← +LocaleProvider, +ThemeProvider (dark/light),
                                            +ErrorBoundary, +meta PWA, +manifest link
frontend/src/components/Navbar.tsx       ← +LanguageSwitcher, +dark mode toggle, +mobile hamburger
frontend/src/app/globals.css             ← +dark mode CSS vars (--bg, --text, etc.)
                                            +@media (max-width: 768px) overrides
                                            ← pełne responsive styles dla wszystkich stron
```

### Pliki konfiguracyjne PWA (nowe)
```
frontend/public/manifest.json            ← PWA manifest: name, icons, theme_color, display: standalone
frontend/public/sw.js                    ← Service Worker: cache static assets, offline fallback
frontend/public/icon-192.png             ← PWA icon (192x192)
frontend/public/icon-512.png             ← PWA icon (512x512)
```

---

## Co UKRYWAMY w tej fazie

- Docker, CI/CD (nie pokazujemy infrastruktury)
- Testy (unit + E2E)
- Seed data scripts

---

## Podział pracy — Faza 5

| Osoba | Zadanie |
|-------|---------|
| **Jakub** | NotificationConsumer + JWTAuthMiddleware, throttles.py, admin panel extensions |
| **Anna** | i18n.ts (tłumaczenia), LocaleContext, LanguageSwitcher, integracja t() w WSZYSTKICH stronach |
| **Piotr** | PWA manifest + Service Worker, Stats page (API endpoint + dane), ErrorBoundary |
| **Marta** | Dark mode CSS vars + Tailwind dark:, Skeleton components, TabBar, responsive styles |

---

## Punkty prezentacji — Faza 5

1. **"Dark mode"** — przełącznik w Navbar, persystencja w localStorage
2. **"PL/EN"** — przełączanie języka bez przeładowania, 400+ przetłumaczonych stringów
3. **"PWA"** — "Zainstaluj aplikację" na Chrome/Safari, działa offline (cached assets)
4. **"Responsywność"** — pokazać na telefonie: TabBar zamiast Navbar, karty zamiast tabel
5. **"Skeleton loading"** — płynne ładowanie zamiast "pustego ekranu"
6. **"Rate limiting"** — ochrona przed spam-kliknięciami i atakami brute-force
7. **"Admin panel"** — /admin/ z filtrowaniem, ban userów, przegląd gier

### Pytania od prowadzącego i odpowiedzi

**P: Jak implementowaliście dark mode?**
O: CSS custom properties (variables) na poziomie `:root` i `[data-theme="dark"]`. Tailwind `dark:` klasy. Wartość zapisana w localStorage, odczytywana przy montowaniu — bez FOUC (flash of unstyled content) dzięki `<script>` inline w `<head>`.

**P: Jak PWA działa offline?**
O: Service Worker cache'uje: Next.js chunks, CSS, fonty. Dane z API mają fallback na `cacheFirst` strategię dla statycznych zasobów. Strony z danymi real-time (gra) wymagają połączenia — pokazujemy baner "offline".

**P: Skąd wzięliście tłumaczenia?**
O: Tworzymy klucze w i18n.ts ręcznie — ~400 kluczy to 1-2 dni pracy przy 4 osobach. Alternatywą byłoby next-intl, ale chcieliśmy mieć pełną kontrolę bez dodatkowej zależności.

---

## Sprint Retrospective — Faza 5

**Co poszło dobrze:**
- CSS variables dla dark mode to o wiele lepsze podejście niż `darkMode: 'class'` w Tailwind — działa ze wszystkimi komponentami
- ErrorBoundary kilka razy uratował demo od białego ekranu
- TabBar na mobile znacząco poprawia UX — nawigacja jednym kciukiem

**Co było trudne:**
- FOUC przy dark mode — rozwiązane blokckim skryptem w `_document.tsx`
- i18n: niektóre klucze były dynamiczne (interpolacja) — trzeba było stworzyć `t('key', {var})` z template literals
- PWA na iOS Safari ma ograniczenia — Service Worker nie cachuje wszystkiego, musieliśmy to udokumentować

---

---

# FAZA 6: „Wdrożenie i Jakość Kodu"
**Prezentacja: sesja 6 (finalna)**

## Co pokazujemy

Docker (dev + prod z nginx), CI/CD pipeline (GitHub Actions), pełne testy (unit + E2E Playwright), dokumentacja API (Swagger), README, diagram architektury, seed data, rate limiting, CORS, structured logging.

---

## Pliki dodane w tej fazie (DELTA od Fazy 5)

### INFRASTRUKTURA — nowe pliki

```
# Docker — development
docker/dev/Dockerfile.backend          ← Python 3.12-slim, pip install -r requirements.txt, dev server
docker/dev/Dockerfile.frontend         ← node:20-alpine, npm install, next dev --port 3000

# Docker — produkcja
docker/prod/Dockerfile.backend         ← multi-stage: builder (deps) → runtime (minimal image)
                                          gunicorn + uvicorn workers, collectstatic
docker/prod/Dockerfile.frontend        ← multi-stage: builder (npm build) → runner (tylko .next/standalone)
docker/prod/nginx/Dockerfile           ← nginx:alpine, custom nginx.conf
docker/prod/nginx/nginx.conf           ← (zakładamy że istnieje lub jest w Dockerfile)
docker/prod/entrypoint.sh              ← wait-for-db, migrate, collectstatic, run server

# Docker Compose
docker-compose.dev.yml                 ← services: backend, frontend, postgres:15, redis:7
                                          volumes: kodu (hot reload), volumes: postgres_data, redis_data

# Zmienne środowiskowe
.env.example                           ← root: DATABASE_URL, REDIS_URL, SECRET_KEY, GEMINI_API_KEY
backend/.env.example                   ← backend specific
frontend/.env.local.example            ← NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
```

### CI/CD — nowe pliki

```
.github/workflows/ci.yml               ← trigger: push/PR to main
                                          jobs:
                                            backend-tests: postgres service, pytest, coverage
                                            frontend-lint: npm ci, eslint, tsc --noEmit
                                            e2e-tests: docker-compose up, playwright test
                                            docker-build: docker build backend + frontend
```

### TESTY BACKENDOWE — nowe pliki

```
backend/conftest.py                    ← fixtures: db, api_client, auth_client, room_factory, user_factory
backend/tests/__init__.py

# Testy jednostkowe i integracyjne
backend/tests/test_auth.py             ← register, login, token refresh, me endpoint
backend/tests/test_accounts.py         ← UserProfile CRUD, score update
backend/tests/test_account_management.py ← zmiana hasła, usunięcie konta
backend/tests/test_friends.py          ← send/accept/reject/remove friendship
backend/tests/test_friends_extended.py ← edge cases: duplikat zaproszenia, self-friend
backend/tests/test_achievements.py     ← check_achievements triggers, edge cases
backend/tests/test_rooms.py            ← create/join/start room, room code uniqueness
backend/tests/test_consumers.py        ← WebSocket: connect, submit_answer, game flow, reconnect
backend/tests/test_game_modes.py       ← Classic / Duel / Survival — pełne rundy
backend/tests/test_custom_packs.py     ← CRUD paczek, walidacja pytań
backend/tests/test_daily_challenges.py ← generowanie, completion, nagrody
backend/tests/test_rankings.py         ← global + weekly rankings, sorting
backend/tests/test_scoring.py          ← calculate_score, streak_bonus, time_bonus
backend/tests/test_seasons.py          ← manage_seasons command, liga assignments
backend/tests/test_clans.py            ← clan CRUD, membership, invites
backend/tests/test_tournaments.py      ← bracket generation, progression, prizes
backend/tests/test_shop.py             ← buy item, insufficient coins, duplicate purchase
backend/tests/test_stats.py            ← stats endpoint, data accuracy
backend/tests/test_powerups.py         ← apply powerup, invalid use, server-side validation
backend/tests/test_replay.py           ← replay data completeness, ordering
backend/tests/test_websocket_extended.py ← reconnect, grace period, edge cases
backend/tests/test_admin_api.py        ← admin endpoints, ban/unban, game management
```

### TESTY E2E FRONTENDOWE — nowe pliki

```
frontend/playwright.config.ts          ← baseURL, webServer, screenshots on failure

frontend/e2e/helpers.ts                ← loginAs(), createRoom(), joinRoom() utilities

# Testy E2E (Playwright)
frontend/e2e/auth.spec.ts              ← register, login, logout, token refresh
frontend/e2e/game.spec.ts              ← pełny flow gry: create→join→play→results
frontend/e2e/room.spec.ts              ← lobby mechanics, ready state, start game
frontend/e2e/ranking.spec.ts           ← widoczność rankingu, zmiana filtrów
frontend/e2e/shop.spec.ts              ← przeglądanie, zakup avatara
frontend/e2e/stats.spec.ts             ← ładowanie strony statystyk
frontend/e2e/profile.spec.ts           ← widok profilu, edycja
frontend/e2e/friends.spec.ts           ← invite, accept, remove
frontend/e2e/clans.spec.ts             ← create, join, leave
frontend/e2e/tournaments.spec.ts       ← list, join, bracket view
frontend/e2e/daily-challenges.spec.ts  ← widok wyzwań, status ukończenia
frontend/e2e/custom-packs.spec.ts      ← create pack, add questions, make public
frontend/e2e/matchmaking.spec.ts       ← enter queue, cancel
frontend/e2e/survival.spec.ts          ← survival game flow
frontend/e2e/duel.spec.ts              ← duel game flow
frontend/e2e/powerups.spec.ts          ← użycie power-upa w grze
frontend/e2e/replay.spec.ts            ← obejrzenie replay zakończonej gry
frontend/e2e/responsive.spec.ts        ← mobile viewport, TabBar visible, Navbar hidden
frontend/e2e/i18n.spec.ts              ← language switch PL↔EN, persystencja
frontend/e2e/dark-mode.spec.ts         ← toggle dark mode, persystencja
frontend/e2e/admin.spec.ts             ← admin panel dostępny dla superuser
frontend/e2e/toast.spec.ts             ← toast na błędzie logowania, toast na zakupie
```

### DOKUMENTACJA — nowe pliki

```
README.md                              ← opis projektu, screenshot, features list,
                                          quick start (Docker), tech stack, team

SETUP.md                               ← szczegółowy setup: wymagania, kroki dev/prod,
                                          zmienne środowiskowe, troubleshooting

docs/ARCHITECTURE.md                   ← diagram sekwencji (auth + gra), ERD modeli,
                                          opis każdej warstwy, decyzje architekturalne

docs/STATUS.md                         ← obecny status projektu, znane problemy
docs/ANALIZA_STATUSU.md               ← szczegółowa analiza techniczna (PL)
docs/AUDIT_REPORT.md                   ← raport audytu kodu, znalezione i naprawione problemy
```

### SEED DATA — nowe pliki

```
backend/apps/rooms/management/commands/seed_data.py  ← tworzy: 10 userów testowych,
                                                         5 question packs z pytaniami,
                                                         1 klan, kilka zakończonych gier
                                                         (do demo w adminie i rankingu)
```

---

## Podział pracy — Faza 6

| Osoba | Zadanie |
|-------|---------|
| **Jakub** | Testy backendu (test_consumers, test_game_modes, test_scoring, test_websocket_extended), Dockerfile.backend (dev+prod), entrypoint.sh |
| **Anna** | E2E testy (game.spec, room.spec, powerups.spec, replay.spec, duel.spec, survival.spec), playwright.config.ts, helpers.ts |
| **Piotr** | CI/CD (ci.yml), docker-compose.dev.yml, testy backendu (test_rooms, test_auth, test_accounts, test_friends*), seed_data.py |
| **Marta** | README.md + SETUP.md, docs/ARCHITECTURE.md, E2E testy (auth.spec, responsive.spec, i18n.spec, dark-mode.spec, rest of frontend tests), Dockerfile.frontend |

---

## Punkty prezentacji — Faza 6

1. **"Środowisko Docker"** — `docker-compose up` → cały stack działa lokalnie bez instalacji czegokolwiek
2. **"Produkcyjny Docker"** — multi-stage build: backend 80MB (vs 800MB naiwny), nginx jako reverse proxy
3. **"CI/CD"** — każdy push uruchamia testy, build check, E2E — pokaż zielone checkmarks w GitHub
4. **"Pokrycie testami"** — backend: `pytest --cov` ~80%+, E2E: 23 spec files, happy paths
5. **"Swagger API"** — /api/schema/swagger-ui/ — interaktywna dokumentacja 50+ endpointów
6. **"Rate limiting"** — pokaż 429 przy 101. requecie/minutę
7. **"Seed data"** — `python manage.py seed_data` → gotowe demo z danymi testowymi

### Pytania od prowadzącego i odpowiedzi

**P: Dlaczego multi-stage Docker build?**
O: Stage `builder` instaluje kompilatory, headers (gcc, libpq-dev). Stage `runtime` kopiuje tylko wheel'e. Rezultat: obraz 80MB zamiast 800MB. Mniejszy obraz = szybszy deploy, mniejsza powierzchnia ataku.

**P: Jak testujecie WebSocket w pytest?**
O: Django Channels dostarcza `WebsocketCommunicator` — symuluje połączenie WebSocket bez rzeczywistego serwera. Testy wysyłają JSON, odbierają odpowiedzi, sprawdzają state.

**P: Co testują E2E testy a co unit testy?**
O: Unit/integracyjne (backend) = logika biznesowa, izolowana, szybka (2-3 sek dla całego suite). E2E (Playwright) = user journey od A do Z przez przeglądarkę — wolniejsze (2-3 min), ale gwarantują że całość działa razem.

**P: Jak zabezpieczyliście aplikację produkcyjnie?**
O: CORS (whitelist domen), rate limiting (throttles.py), HTTPS przez nginx (self-signed na dev, Let's Encrypt w prod), JWT z krótkim TTL (15min) + refresh token (7 dni), brak SECRET_KEY w repo (.env.example zamiast .env).

**P: Jak działa Swagger?**
O: `drf-spectacular` automatycznie generuje OpenAPI 3.0 schema ze wszystkich ViewSetów i APIViews. Dodaliśmy `@extend_schema` dekoratory dla endpointów WebSocket (dokumentacja ręczna). Dostępne pod `/api/schema/swagger-ui/`.

---

## Sprint Retrospective — Faza 6

**Co poszło dobrze:**
- Multi-stage Docker build był szybszy do skonfigurowania niż myśleliśmy — 2h vs planowane 6h
- GitHub Actions CI działa z pierwszego podejścia — dobra dokumentacja GitHub
- seed_data.py bardzo przydatny do demo — nigdy więcej ręcznego klikania
- E2E testy znalazły 2 prawdziwe bugi których nie widzieliśmy w unit testach

**Co było trudne:**
- E2E testy wymagają stabilnego środowiska — flakey tests przy WebSocket timing — rozwiązane `waitFor` z timeoutem
- Coverage w pytest: osiągnięcie 80% wymagało testowania management commands i consumers — nieoczywiste setup
- README.md — wydaje się trywialne ale napisanie dobrego README zajęło cały dzień

---

---

# PODSUMOWANIE — Quick Reference

## Co mamy na każdej sesji

| Faza | Sesja | Kluczowe feature |
|------|-------|-----------------|
| **1** | Tygodnie 1-2 | Auth (JWT), Create/Join Room, Gra Real-Time (WS), AI Pytania |
| **2** | Tygodnie 3-4 | Znajomi, Ranking, Historia Gier, Profil, Toast, Transitions |
| **3** | Tygodnie 5-6 | Power-upy, Duel/Survival, Streak Multiplier, Custom Packs, Replay |
| **4** | Tygodnie 7-8 | Turnieje, Klany, Daily Challenges, Sklep, Achievementy, Sezony |
| **5** | Tygodnie 9-10 | Dark Mode, PL/EN i18n, PWA, Mobile, Skeletons, Admin Panel |
| **6** | Tygodnie 11-12 | Docker, CI/CD, Testy (unit+E2E), Swagger, README, Seed Data |

---

## Liczba plików per faza

| Faza | Backend (nowe) | Frontend (nowe) | Inne | Łącznie |
|------|---------------|-----------------|------|---------|
| 1 | ~20 | ~16 | 2 | ~38 |
| 2 | ~5 | ~9 | 0 | ~14 |
| 3 | ~8 | ~10 | 0 | ~18 |
| 4 | ~14 | ~10 | 0 | ~24 |
| 5 | ~5 | ~8 | 4 | ~17 |
| 6 | ~22 | ~26 | ~12 | ~60 |
| **SUMA** | **~74** | **~79** | **~18** | **~171** |

---

## Linia obrony — odpowiedzi na "trudne" pytania

**"Skąd mieliście czas na to wszystko w 2 tygodnie?"**
→ Faza 1-4 to główna praca — 4 osoby × 2 tygodnie × ~10h/tydz = 80 roboczogodzin per faza. Przy dobrym podziale (każdy swój moduł) jest to realistyczne.

**"Dlaczego tak dużo rzeczy na Fazie 6?"**
→ Infrastruktura i testy to główne zadania ostatnich 2 tygodni — gdy features są gotowe, skupiamy się na quality i deployment. To standardowe w Agile.

**"Czy testowaliście bezpieczeństwo?"**
→ Tak: CORS whitelist, JWT, rate limiting, input validation (DRF serializers), CSRF protection (Django built-in), brak SQL injection (ORM), XSS prevention (React escapes by default).
