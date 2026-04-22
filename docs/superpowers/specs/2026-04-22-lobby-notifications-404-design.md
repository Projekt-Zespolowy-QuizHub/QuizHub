# Design — Poprawki lobby, powiadomienia znajomych, tooltipy trybów, 404

**Data:** 2026-04-22
**Projekt:** QuizHub / QuizArena
**Zakres:** Cztery niezależne zadania zgłoszone przez prowadzącego.

---

## Kontekst

Prowadzący zgłosił cztery problemy do naprawy:

1. Hover/tooltip na trybach gry — brak opisu co robią.
2. Lobby gry nie odświeża listy graczy poprawnie przez WS.
3. Zaproszenia do znajomych — brak powiadomień push i możliwości szybkiego zatwierdzenia.
4. 404 requesty widoczne w DevTools / Network.

---

## Zadanie 1 — Tooltipy na trybach gry

### Problem
Na `/create` są dwie sekcje wyboru:
- **Źródło pytań**: 🤖 AI vs 📦 Paczka.
- **Tryb gry**: 🎯 Klasyczny / ⚔️ Pojedynek / 💀 Przetrwanie.

Użytkownik nie wie co każdy wybór znaczy.

### Rozwiązanie
Nowy lekki komponent `InfoTooltip` (React, Tailwind), pokazujący dymek na hover (desktop) i tap (mobile).

**Lokalizacja:** `frontend/src/components/InfoTooltip.tsx`.

**API komponentu:**
```tsx
<InfoTooltip content="Tekst opisu">
  <span>ikonka ℹ️ lub cały button</span>
</InfoTooltip>
```

**Implementacja:** `position: absolute` na hover/focus, `pointer-events: none`, `max-w-xs`, tło `bg-black/90`, strzałka CSS `::before`.

**Teksty (PL, przez `i18n` jeśli jest):**

| Tryb | Treść |
|---|---|
| 🤖 AI | Pytania generowane przez AI (Gemini) na żywo z podanych kategorii. |
| 📦 Paczka | Własna paczka pytań stworzona przez Ciebie lub społeczność. |
| 🎯 Klasyczny | 5–20 rund. Punkty za szybkość i serię poprawnych odpowiedzi. |
| ⚔️ Pojedynek | Szybki mecz 1v1 na 5 rund. Zwycięzca dostaje bonus 50 monet. |
| 💀 Przetrwanie | Jedna błędna odpowiedź eliminuje. Grasz do ostatniego gracza. |

**Pliki do zmiany:**
- `frontend/src/components/InfoTooltip.tsx` — nowy.
- `frontend/src/app/create/page.tsx` — otoczyć każdy przycisk trybu `<InfoTooltip>`.
- `frontend/src/lib/i18n.ts` — dodać klucze tłumaczeń (PL + EN).

---

## Zadanie 2 — Lobby gry, fix refreshu graczy

### Diagnoza

**Problem (C) — race condition w `lobby/page.tsx`:**

```ts
// useEffect [code, send, myAvatar]
api.getRoom(code).then(room => {
  ...
  send({ type: 'join', nickname: nick, avatar: myAvatar });
});
```

`send()` sprawdza `wsRef.current?.readyState === WebSocket.OPEN` i **cicho nic nie wysyła**, jeśli WS jeszcze nie jest połączony. Jeśli `api.getRoom()` (HTTP) rozwiąże się **przed** `ws.onopen`, wiadomość `join` nigdy nie trafia do serwera — inni gracze nie widzą nowego gracza.

Istniejący useEffect:
```ts
useEffect(() => {
  if (status === 'connected' && myNick) {
    send({ type: 'rejoin', nickname: myNick });
  }
}, [status]);
```
wysyła `rejoin`, który tylko odsyła `game_state` do samego gracza (nie broadcastuje `player_joined` do pozostałych).

**Problem (B) — 30s grace period dla lobby:**

W `rooms/consumers.py` `GameConsumer.GRACE_PERIOD_SECONDS = 30`. Ma to sens podczas **aktywnej gry** (reconnect). W **lobby** (`Room.Status.LOBBY`) gra się jeszcze nie rozpoczęła — nie ma po co trzymać „ducha" 30 sekund.

### Rozwiązanie

**Fix C (frontend):**
- Usunąć `send({ type: 'join' })` z `.then(getRoom)`.
- Rozszerzyć useEffect na `status`: przy pierwszym `connected` wysłać `join`, przy kolejnych `rejoin` (flaga `hasJoinedRef`).

```ts
const hasJoinedRef = useRef(false);

useEffect(() => {
  if (status !== 'connected' || !myNick) return;
  if (!hasJoinedRef.current) {
    send({ type: 'join', nickname: myNick, avatar: myAvatar });
    hasJoinedRef.current = true;
  } else {
    send({ type: 'rejoin', nickname: myNick });
  }
}, [status, myNick, myAvatar, send]);
```

**Fix B (backend):**
- W `disconnect()` sprawdzić status pokoju. Jeśli `LOBBY` → grace period 3s (skraca „ducha" do znikomej wartości, ale zapobiega miganiu przy szybkim refreshu). Jeśli `IN_PROGRESS` → zostawia 30s.

```python
async def disconnect(self, close_code):
    if self.nickname:
        grace = await self._get_grace_period()
        key = (self.room_code, self.nickname)
        existing = _disconnect_tasks.get(key)
        if existing and not existing.done():
            existing.cancel()
        task = asyncio.create_task(self._delayed_player_left(key, grace))
        _disconnect_tasks[key] = task
    await self.channel_layer.group_discard(self.group_name, self.channel_name)

async def _get_grace_period(self) -> int:
    from .models import Room
    try:
        room = await database_sync_to_async(Room.objects.get)(code=self.room_code)
        return 3 if room.status == Room.Status.LOBBY else 30
    except Room.DoesNotExist:
        return 3
```

`_delayed_player_left` przyjmuje parametr `grace_seconds`.

**Pliki do zmiany:**
- `frontend/src/app/room/[code]/lobby/page.tsx` — refactor useEffect.
- `backend/apps/rooms/consumers.py` — per-status grace period.

---

## Zadanie 3 — Powiadomienia WS dla zaproszeń do znajomych

### Problem
`SendFriendRequestView` tworzy `Friendship(status=PENDING)` i zwraca sukces, ale **nie wysyła** powiadomienia WS. Odbiorca dowiaduje się dopiero po wejściu na `/friends` i odświeżeniu strony.

`NotificationConsumer` (`accounts/consumers.py`) obsługuje tylko `challenge_received` / `challenge_cancelled`.

### Rozwiązanie — kompletne: toast + badge

**Backend:**

1. `accounts/consumers.py` — dodać handlery:
   - `friend_request_received` → wysyła `{type, request_id, from_display_name, from_user_id}`.
   - `friend_request_accepted` → wysyła `{type, by_display_name}` (nadawca zaproszenia dostaje info że zostało przyjęte).

2. `SendFriendRequestView.post()` — po `Friendship.objects.create(...)` wywołać:
   ```python
   async_to_sync(channel_layer.group_send)(
       f'user_notifications_{target_user.id}',
       {
           'type': 'friend_request_received',
           'request_id': friendship.id,
           'from_display_name': request.user.profile.display_name,
           'from_user_id': request.user.profile.id,
       },
   )
   ```

3. `RespondFriendRequestView.post()` — gdy `action == 'accept'`, wysłać do nadawcy:
   ```python
   async_to_sync(channel_layer.group_send)(
       f'user_notifications_{friendship.from_user.id}',
       {
           'type': 'friend_request_accepted',
           'by_display_name': request.user.profile.display_name,
       },
   )
   ```

**Frontend:**

1. `useNotifications.ts` — rozszerzyć typ `NotificationMessage`:
   ```ts
   export type NotificationMessage =
     | ChallengeNotification
     | FriendRequestReceivedNotification
     | FriendRequestAcceptedNotification;
   ```

2. Nowy komponent `RichToast` (lub `ActionToast`) — toast z opcjonalnymi przyciskami akcji. Rozszerza istniejący `ToastContext`:
   ```ts
   show(message: string, type: 'info'|'success'|..., actions?: Array<{label, onClick}>)
   ```
   Albo nowa metoda `showAction(message, actions[])`.

3. `NotificationsMount.tsx` — obsłużyć `friend_request_received`:
   - Pokazać `RichToast` z przyciskami **Akceptuj** / **Odrzuć**.
   - Na klik → `api.respondFriendRequest(request_id, action)` → zamknąć toast, pokazać potwierdzenie.
   - Update licznika pending (patrz niżej).

4. **Pending count provider** — wyciągnąć `pendingCount` z `Navbar` do kontekstu `PendingRequestsContext`:
   - Provider fetchuje initial count przez `api.getPendingRequests()`.
   - Udostępnia `{count, increment, decrement, refetch}`.
   - Navbar konsumuje tylko `count`.
   - NotificationsMount na `friend_request_received` woła `increment()`, na `accept/reject` woła `decrement()`.

**Pliki do zmiany:**
- `backend/apps/accounts/consumers.py` — 2 nowe handlery.
- `backend/apps/accounts/views.py` — `group_send` w `SendFriendRequestView` i `RespondFriendRequestView`.
- `frontend/src/lib/useNotifications.ts` — rozszerzone typy.
- `frontend/src/lib/ToastContext.tsx` — wsparcie akcji (lub nowy `RichToast`).
- `frontend/src/components/Toast.tsx` lub nowy `ActionToast.tsx`.
- `frontend/src/lib/PendingRequestsContext.tsx` — nowy plik.
- `frontend/src/app/layout.tsx` — owinąć w `PendingRequestsProvider`.
- `frontend/src/components/Navbar.tsx` — użyć `usePendingRequests()`.
- `frontend/src/components/NotificationsMount.tsx` — obsługa nowych typów, wywołania context.

---

## Zadanie 4 — Wyeliminować 404 w DevTools

### Diagnoza

**Źródło A — Navbar linkuje do nieistniejących stron Next.js:**
`GROUP_DEFS` w `Navbar.tsx` zawiera `/matchmaking`, `/survival`, `/clans`, `/tournaments`, `/stats`, `/achievements`, `/packs`, `/shop`. Żadna z nich nie ma folderu w `frontend/src/app/`. Kliknięcie powoduje Next.js router prefetch / navigation — w Network zobaczymy `*.rsc` 404 oraz finalne 404 na samej nawigacji.

**Źródło B — TournamentBanner wola nieistniejący endpoint:**
`TournamentBanner.tsx:41` → `fetch('/api/tournaments/next-public/')` co 30 sekund. Backend ma tylko `tournaments/config/` i `tournaments/trigger/` w `rooms/urls.py`. Stały 404 w tle.

**Źródło C — nieużywany plik `serverApi.ts`:** nie powoduje 404 sam w sobie, ale kod martwy. Do wyczyszczenia (low priority).

### Rozwiązanie

**A — usunąć martwe linki z Navbara.**
Zawęzić `GROUP_DEFS` do stron które **faktycznie istnieją**:
- `play`: `/dashboard`, `/create`, `/join`.
- `community`: `/friends`, `/ranking`.
- `my`: `/profile`, `/history`.

Usunąć też link do `/shop` po prawej stronie w header desktop + mobile.

**B — dodać endpoint `next-public/` w backendzie.**
Nowy view `NextPublicTournamentView` w `rooms/views.py`. Logika:
- Znajdź najbliższy aktywny konfig `PublicTournamentConfig` (wzorem istniejących views).
- Jeśli istnieje aktywna/oczekująca publiczna gra (Room.is_public, status=LOBBY), zwróć jej dane wraz z polami wymaganymi przez frontend: `{room_id, start_time, player_count, max_players, seconds_until_start, interval_minutes, categories}`.
- Brak danych → 204 No Content lub 200 z `null` (NIE 404 — bo to wtedy znów 404 w konsoli). Frontend interpretuje `!res.ok` jako brak.

Dodać trasę w `rooms/urls.py`:
```python
path('tournaments/next-public/', NextPublicTournamentView.as_view(), name='next-public-tournament'),
```

**C — usunąć `serverApi.ts` (nieużywany).**

**Pliki do zmiany:**
- `frontend/src/components/Navbar.tsx` — zawężyć `GROUP_DEFS`, usunąć link `/shop`.
- `backend/apps/rooms/views.py` — nowy `NextPublicTournamentView`.
- `backend/apps/rooms/urls.py` — nowa trasa.
- `frontend/src/lib/serverApi.ts` — usunąć.

---

## Kolejność wdrażania (proponowana)

1. **Zadanie 4 (404)** — najszybsze, najbardziej widoczne w DevTools. Usuwa „szum" przy debugu pozostałych zadań.
2. **Zadanie 2 (lobby WS)** — bugfix, izolowany.
3. **Zadanie 1 (tooltipy)** — mała, kosmetyczna.
4. **Zadanie 3 (powiadomienia znajomych)** — największa, dotyka backend + frontend + state.

Każde zadanie = osobny commit (łatwiejszy review + rollback).

---

## Testowanie

- **1:** wizualnie — hover po każdym trybie, sprawdzić teksty PL/EN.
- **2:** otworzyć lobby w 2 kartach, dołączyć w drugiej → pierwsza widzi natychmiast. Zamknąć drugą → pierwsza widzi zniknięcie w ciągu 3–4s (lobby) / 30s (gra trwa).
- **3:** dwa konta, A wysyła zaproszenie do B → B natychmiast widzi toast z przyciskami, badge w navbarze rośnie. Akceptacja → A dostaje toast „przyjął".
- **4:** otworzyć DevTools → Network → żadnych 404 przy normalnym użytkowaniu aplikacji.
