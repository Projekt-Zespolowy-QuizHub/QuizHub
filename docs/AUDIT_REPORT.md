# QuizArena — Raport Audytu Kodu

**Data:** 2026-03-21
**Projekt:** QuizArena (Django 5 backend + Next.js 14 frontend)
**Audytowane:** backend/ i frontend/src/ — wszystkie pliki Python i TypeScript

---

## Podsumowanie

| Poziom | Liczba | Status |
|--------|--------|--------|
| CRITICAL | 2 | ✅ Naprawione w tej sesji |
| WARNING | 11 | ⚠️ Do decyzji właściciela |
| INFO | 7 | ℹ️ Opcjonalne ulepszenia |

---

## CRITICAL — Błędy krytyczne (naprawione)

### C1 — Navbar: avatar wyświetlany jako `<img src>` zamiast emoji
**Plik:** `frontend/src/components/Navbar.tsx` linie 244–246, 304–305
**Problem:** `user.avatar` to klucz tekstowy (np. `'fox'`, `'robot'`), a nie URL. Komponent używał `<img src={user.avatar}>`, co generowało złamane obrazki dla wszystkich zalogowanych użytkowników na każdej stronie.
**Fix:** Zastąpiono `<img>` wywołaniem `getAvatarEmoji(user.avatar)` (tak jak robi to `profile/page.tsx`).
**Wpływ:** Widoczne złamane obrazki w navbarze dla 100% zalogowanych użytkowników.

---

### C2 — packs/create: toast sukcesu pokazuje "Paczka usunięta" zamiast "Paczka utworzona"
**Plik:** `frontend/src/app/packs/create/page.tsx` linia 25
**Problem:** `show(t('packs_delete_success'), 'success')` — klucz `packs_delete_success` to "Paczka usunięta" / "Pack deleted". Wywoływany po *stworzeniu* paczki.
**Fix:** Dodano nowy klucz i18n `packs_create_success` i zmieniono wywołanie.
**Wpływ:** Dezorientujący komunikat dla użytkowników tworzących paczki.

---

## WARNING — Brakujące funkcje / niekompletne implementacje

### W1 — Brak strony `/matchmaking`
**Plik:** `frontend/src/components/Navbar.tsx` linia 33
**Problem:** Navbar zawiera link do `/matchmaking` w grupie "Graj", ale katalog `frontend/src/app/matchmaking/` nie istnieje. Kliknięcie linku daje 404.
**Sugerowane działanie:** Stworzyć stronę placeholder lub usunąć link z nawigacji.

---

### W2 — Frontend: wiele stron z hardkodowanym polskim tekstem (brak i18n)
**Pliki:**
- `frontend/src/app/public/page.tsx` — 5+ hardkodowanych stringów ("Gra publiczna", "Brak zaplanowanych gier", "Następna gra rozpocznie się za:", itd.)
- `frontend/src/app/friends/FriendsClient.tsx` — 15+ stringów ("Nie znaleziono użytkowników", "Zaproszenie wysłane!", "Twoi znajomi", itd.)
- `frontend/src/app/packs/[id]/edit/page.tsx` — 10+ stringów ("Treść pytania *", "Odpowiedzi (zaznacz poprawną)", "Zapisz", "Anuluj", itd.)
- `frontend/src/app/share/[code]/page.tsx` — 7 stringów ("Zwycięzca", "rund", "← Pełne wyniki", itd.)
- `frontend/src/components/StatusBanner.tsx` — 2 stringy

**Problem:** Strony te zawierają zakodowane polskie teksty bez użycia systemu i18n, przez co nie będą przetłumaczone przy zmianie języka.
**Sugerowane działanie:** Przenieść wszystkie teksty do `i18n.ts` i użyć `useLocale()`.

---

### W3 — Backend: duplikat URL pattern dla `NextPublicGameView`
**Plik:** `backend/apps/rooms/urls.py` linie 13, 18
**Problem:** `NextPublicGameView` zamapowany do dwóch URL-i:
- `GET /api/rooms/public/next/`
- `GET /api/tournaments/next-public/`

**Sugerowane działanie:** Usunąć jeden z nich lub uzasadnić w komentarzu, dlaczego oba istnieją.

---

### W4 — Backend: docstring consumers.py wspomina event `round_end`, który nie istnieje
**Plik:** `backend/apps/rooms/consumers.py` linia 56
**Problem:** Docstring klasy `GameConsumer` dokumentuje event `round_end → koniec rundy, leaderboard`, ale w kodzie nie ma ani implementacji wysyłania tego eventu, ani handlera po stronie frontendu.
**Sugerowane działanie:** Usunąć `round_end` z docstringa lub zaimplementować event.

---

### W5 — Backend: dane seed nie zgadzają się z ACHIEVEMENT_DEFINITIONS
**Plik:** `backend/apps/rooms/management/commands/seed_data.py`
**Plik wzorcowy:** `backend/apps/accounts/achievements.py`
**Problem:** Plik seed definiuje osiągnięcia (np. `hot_streak_10` z ikoną `"🔥🔥"`) innymi opisami i ikonami niż `ACHIEVEMENT_DEFINITIONS` (ikona `"💥"`). Baza danych po seedzie będzie miała inne dane niż produkowane przez kod.
**Sugerowane działanie:** Zmienić seed_data, by importował i używał `ACHIEVEMENT_DEFINITIONS` z `achievements.py`.

---

### W6 — Frontend: `game/page.tsx` — avatar gracza w leaderboardzie to już emoji, nie klucz
**Plik:** `frontend/src/app/room/[code]/game/page.tsx` linia 91
**Problem:** `entry.avatar ?? getAvatarEmoji('fox')` — zakłada, że `entry.avatar` może już być emoji, albo używa domyślnego 'fox'. Backend wysyła `avatar` jako klucz tekstowy ('fox', 'robot'), więc `entry.avatar` nigdy nie będzie emoji. Wyświetlone zostanie surowe 'fox' zamiast emoji.
**Sugerowane działanie:** Zmienić na `getAvatarEmoji(entry.avatar ?? 'fox')`.

---

### W7 — Frontend: `PlayerSerializer` nie zwraca `current_streak` / `best_streak`
**Plik:** `backend/apps/rooms/serializers.py`
**Problem:** `PlayerSerializer` eksponuje tylko `['id', 'nickname', 'score', 'is_host', 'avatar']`. Modele `Player` mają pola `current_streak` i `best_streak`, które mogłyby być użyteczne do wyświetlenia paska postępu streaka w lobby/grze.
**Sugerowane działanie:** Dodać te pola jeśli frontend potrzebuje wyświetlać streak.

---

### W8 — Frontend: packs/create — walidacja wyświetla etykietę pola zamiast komunikatu o błędzie
**Plik:** `frontend/src/app/packs/create/page.tsx` linia 21
**Problem:** `show(t('pack_name_label'), 'error')` — gdy nazwa jest pusta, toast pokazuje etykietę pola ("Nazwa paczki *") zamiast komunikatu błędu jak "Nazwa paczki jest wymagana".
**Sugerowane działanie:** Dodać dedykowany klucz i18n dla błędu walidacji.

---

### W9 — Backend: achievements.py — porównanie statusu pokoju za pomocą literału stringa
**Plik:** `backend/apps/accounts/achievements.py` linia 118
**Problem:** `p.room.status == 'finished'` — używa literału stringa zamiast `Room.Status.FINISHED`. Działa poprawnie (TextChoices wartość to string), ale nie jest odporne na refaktoryzację.
**Sugerowane działanie:** Użyć `Room.Status.FINISHED` po zaimportowaniu Room (wystarczy dodać import w tej samej funkcji).

---

### W10 — Frontend: brak strony wyników dla `/duel`, `/survival`, `/tournaments`
**Pliki:** `frontend/src/app/duel/page.tsx`, `survival/page.tsx`, `tournaments/[id]/page.tsx`
**Problem:** Strony te mają mock UI, ale żaden z trybów nie jest połączony z backendem. Widoczne są jako "w budowie".
**Sugerowane działanie:** Oznaczyć jako "coming soon" w UI lub usunąć z nawigacji.

---

### W11 — Frontend: `FriendsClient.tsx` — wyszukiwanie używa `/api/friends/search/`, ale tylko szuka po nicku
**Plik:** `frontend/src/app/friends/FriendsClient.tsx`
**Problem:** Logika wyszukiwania wysyła zapytanie i wyświetla wyniki, ale interfejs nie rozróżnia między "użytkownikiem już znajomym" a "nowym użytkownikiem" — przycisk "Dodaj" pojawia się zawsze.
**Sugerowane działanie:** Backend może zwracać flagę `is_friend`, żeby ukryć/zmienić przycisk dla istniejących znajomych.

---

## INFO — Jakość kodu / martwy kod

### I1 — Frontend: `soundManager.ts` — martwy kod (nie importowany nigdzie)
**Plik:** `frontend/src/lib/soundManager.ts`
**Problem:** Plik definiuje cały system dźwięków, ale żaden komponent go nie importuje.
**Sugerowane działanie:** Usunąć lub zintegrować z grą.

---

### I2 — Backend: import `CACHE_TTL_ROOM_HISTORY` — nieuporządkowane importy
**Plik:** `backend/apps/rooms/views.py`
**Problem:** Kolejność importów sugeruje potencjalne bałagan — drobna kwestia estetyczna.
**Sugerowane działanie:** Posortować importy (isort).

---

### I3 — Backend: brak logowania kategorii przy fallback w generatorze pytań
**Plik:** `backend/apps/ai/generator.py`
**Problem:** Gdy API zawodzi i wchodzi fallback na `FALLBACK_QUESTIONS`, nie loguje się która kategoria zawiodła.
**Sugerowane działanie:** Dodać `logger.warning(f"AI generation failed for category {category}, using fallback")`.

---

### I4 — Backend: brak walidacji treści odpowiedzi w `PackQuestionCreateView`
**Plik:** `backend/apps/rooms/views.py`
**Problem:** Sprawdzany jest typ, ale nie zawartość — puste stringi jako odpowiedzi są dopuszczone.
**Sugerowane działanie:** Dodać walidację `if not all(isinstance(a, str) and a.strip() for a in answers)`.

---

### I5 — Frontend: `ErrorBoundary.tsx` — minimalna implementacja
**Plik:** `frontend/src/components/ErrorBoundary.tsx`
**Problem:** Error boundary istnieje, ale UI błędu jest bardzo podstawowe bez możliwości raportowania.
**Sugerowane działanie:** Dodać przycisk "Odśwież" i ewentualnie logowanie błędów.

---

### I6 — Frontend: `game/page.tsx` — `getAvatarEmoji('fox')` hardkodowane
**Plik:** `frontend/src/app/room/[code]/game/page.tsx` linia 91
**Problem:** Fallback avatar jest hardkodowany jako `'fox'`, zamiast importować domyślną wartość.
**Sugerowane działanie:** Drobna kosmetyka, bez wpływu na działanie.

---

### I7 — Frontend: strony `/clans` i `/tournaments` z mockowym danymi
**Pliki:** `frontend/src/app/clans/**`, `frontend/src/app/tournaments/**`
**Problem:** Strony mają hardkodowane mock dane (`MOCK_CLANS`, `MOCK_TOURNAMENTS`) bez połączenia z backendem.
**Sugerowane działanie:** OK jako placeholder, ale należy oznaczyć w UI lub usunąć mock dane przed produkcją.

---

## Referencja: kompletne endpointy API

### Backend (Django) — wszystkie zarejestrowane URL-e

| Endpoint | Metoda | View |
|----------|--------|------|
| `/api/auth/register/` | POST | RegisterView |
| `/api/auth/login/` | POST | LoginView |
| `/api/auth/logout/` | POST | LogoutView |
| `/api/auth/me/` | GET | MeView |
| `/api/profile/stats/` | GET | UserStatsView |
| `/api/profile/history/` | GET | UserGameHistoryView |
| `/api/profile/achievements/` | GET | AchievementsView |
| `/api/profile/avatar/` | PATCH | UpdateAvatarView |
| `/api/friends/` | GET | FriendsListView |
| `/api/friends/search/` | GET | SearchUsersView |
| `/api/friends/request/` | POST | SendFriendRequestView |
| `/api/friends/pending/` | GET | PendingRequestsView |
| `/api/friends/respond/` | POST | RespondFriendRequestView |
| `/api/friends/challenge/` | POST | ChallengeFriendView |
| `/api/friends/challenge/respond/` | POST | ChallengeRespondView |
| `/api/rankings/global/` | GET | GlobalRankingView |
| `/api/rankings/weekly/` | GET | WeeklyRankingView |
| `/api/rankings/friends/` | GET | FriendsRankingView |
| `/api/rooms/` | POST | CreateRoomView |
| `/api/rooms/join/` | POST | JoinRoomView |
| `/api/rooms/<code>/` | GET | RoomDetailView |
| `/api/rooms/<code>/history/` | GET | RoomHistoryView |
| `/api/rooms/<code>/replay/` | GET | RoomReplayView |
| `/api/rooms/public/next/` | GET | NextPublicGameView ⚠️ duplikat |
| `/api/packs/` | GET/POST | PackListView / PackCreateView |
| `/api/packs/<id>/` | GET/PATCH/DELETE | PackDetailView |
| `/api/packs/<id>/questions/` | POST | PackQuestionCreateView |
| `/api/packs/<id>/questions/<q_id>/` | PATCH/DELETE | PackQuestionDetailView |
| `/api/tournaments/next-public/` | GET | NextPublicGameView ⚠️ duplikat |
| `/api/tournaments/config/` | GET/PATCH | PublicTournamentConfigView |
| `/api/tournaments/trigger/` | POST | TriggerPublicTournamentView |
| `ws://.../ws/room/<code>/` | WS | GameConsumer |
| `ws://.../ws/notifications/` | WS | NotificationConsumer |

### Frontend — wywołania API (wszystkie zgodne z backendem ✅)

Wszystkie 33 wywołania API w `frontend/src/lib/api.ts` są zgodne z zarejestrowanymi URL-ami backendu.

---

## Referencja: WebSocket message types

| Kierunek | Typ | Obsługiwany |
|----------|-----|-------------|
| Server → Client | `player_joined` | ✅ |
| Server → Client | `player_left` | ✅ |
| Server → Client | `game_start` | ✅ |
| Server → Client | `question` | ✅ |
| Server → Client | `answer_result` | ✅ |
| Server → Client | `game_over` | ✅ |
| Server → Client | `game_state` | ✅ |
| Server → Client | `powerup_result` | ✅ |
| Server → Client | `chat_message` | ✅ |
| Server → Client | `error` | ✅ |
| Server → Client | `round_end` | ⚠️ w docstringu, nie zaimplementowany |
| Client → Server | `join` | ✅ |
| Client → Server | `rejoin` | ✅ |
| Client → Server | `start_game` | ✅ |
| Client → Server | `answer` | ✅ |
| Client → Server | `use_powerup` | ✅ |
| Client → Server | `chat_message` | ✅ |
| Notification WS | `challenge_received` | ✅ |
| Notification WS | `challenge_cancelled` | ✅ |

---

*Raport wygenerowany przez audyt manualny + AI-assisted code review.*
