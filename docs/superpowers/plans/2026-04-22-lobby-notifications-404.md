# Lobby WS + Powiadomienia znajomych + Tooltipy + 404 — Plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Naprawić cztery zgłoszone problemy — wyciszyć 404 w DevTools, naprawić refresh graczy w lobby, dodać pushowane powiadomienia o zaproszeniach do znajomych, dodać tooltipy objaśniające tryby gry.

**Architecture:** Frontend Next.js 14 + TS + Tailwind, backend Django 5 + Channels. Każde zadanie jest niezależnym commitem. Kolejność 4 → 2 → 1 → 3 (od najprostszego/najbardziej widocznego do najbardziej złożonego). TDD tylko dla zmian w Python/Channels (backend ma pytest); frontend weryfikowany przez `next build` + manualny test w dev serverze (brak jest testów FE w projekcie).

**Tech Stack:** Next.js 14, React 18, TypeScript, TailwindCSS, Django 5, DRF, Django Channels, pytest-asyncio, channels-testing.

**Spec:** [docs/superpowers/specs/2026-04-22-lobby-notifications-404-design.md](../specs/2026-04-22-lobby-notifications-404-design.md)

**Reguła commitów dla tego projektu:** commity nie zawierają wzmianek o AI / Claude / Co-Authored-By.

---

## Zadanie 1 — 404: usunięcie martwych linków nav + endpoint turniejów + dead file

**Files:**
- Modify: `frontend/src/components/Navbar.tsx` (GROUP_DEFS + link /shop)
- Modify: `backend/apps/rooms/views.py` (nowy view na końcu pliku)
- Modify: `backend/apps/rooms/urls.py` (nowa trasa)
- Delete: `frontend/src/lib/serverApi.ts`
- Test: `backend/tests/test_rooms_endpoints.py` (nowy plik jeśli nie istnieje — w przeciwnym razie dopisać test)

- [ ] **Krok 1.1: Zawęź `GROUP_DEFS` w Navbar do istniejących stron**

W pliku `frontend/src/components/Navbar.tsx` zastąp definicję `GROUP_DEFS` (linie 26–59) przez:

```ts
const GROUP_DEFS: GroupDef[] = [
  {
    key: 'play',
    labelKey: 'nav_play',
    items: [
      { href: '/dashboard', labelKey: 'nav_dashboard' },
      { href: '/create',    labelKey: 'nav_create'    },
      { href: '/join',      labelKey: 'nav_join'      },
    ],
  },
  {
    key: 'community',
    labelKey: 'nav_community',
    items: [
      { href: '/friends', labelKey: 'nav_friends' },
      { href: '/ranking', labelKey: 'nav_ranking' },
    ],
  },
  {
    key: 'my',
    labelKey: 'nav_my',
    items: [
      { href: '/profile', labelKey: 'nav_profile' },
      { href: '/history', labelKey: 'nav_history' },
    ],
  },
];
```

- [ ] **Krok 1.2: Usuń link `/shop` z desktopu i mobile w Navbar**

Usuń w `Navbar.tsx` fragment `<Link href="/shop">…</Link>` w sekcji „Desktop groups" (~linie 226–235) oraz blok „Shop direct" w mobile (~linie 366–378). Element dziadka (`<div className="hidden md:flex ...">` i `<div className="space-y-1">`) pozostaje — usuwamy tylko Link shop.

- [ ] **Krok 1.3: Weryfikacja `next build`**

```bash
cd "D:/studia/projekt grupowy/frontend"
npm run build
```
Expected: build przechodzi bez errorów, bez warningów o nieużywanych translacjach (klucze `nav_matchmaking`, `nav_survival`, `nav_clans`, `nav_tournaments`, `nav_stats`, `nav_achievements`, `nav_packs`, `nav_shop` pozostają w i18n — nie są błędem).

- [ ] **Krok 1.4: Napisz failing test dla `/api/tournaments/next-public/`**

Sprawdź czy plik `backend/tests/test_rooms_endpoints.py` istnieje; jeśli nie, stwórz go z treścią:

```python
import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


@pytest.mark.django_db
def test_next_public_tournament_returns_204_when_none(client):
    """Gdy brak publicznych turniejów — 204 No Content, nigdy 404."""
    res = client.get('/api/tournaments/next-public/')
    assert res.status_code == 204
```

Jeśli plik istnieje — dopisz ten test na końcu.

- [ ] **Krok 1.5: Uruchom test — ma failować**

```bash
cd "D:/studia/projekt grupowy/backend"
pytest tests/test_rooms_endpoints.py::test_next_public_tournament_returns_204_when_none -v
```
Expected: FAIL — 404 (endpoint nie istnieje).

- [ ] **Krok 1.6: Dodaj view `NextPublicTournamentView` w `rooms/views.py`**

Na końcu pliku `backend/apps/rooms/views.py` dopisz:

```python
class NextPublicTournamentView(APIView):
    """GET /api/tournaments/next-public/ — informacje o nadchodzącym publicznym turnieju."""
    permission_classes = [AllowAny]

    def get(self, request):
        from django.utils import timezone
        from .models import Room, PublicTournamentConfig

        config = PublicTournamentConfig.objects.filter(is_active=True).first()
        if not config:
            return Response(status=status.HTTP_204_NO_CONTENT)

        room = (
            Room.objects
            .filter(is_public=True, status=Room.Status.LOBBY)
            .order_by('scheduled_start_time')
            .first()
        )
        if not room or not room.scheduled_start_time:
            return Response(status=status.HTTP_204_NO_CONTENT)

        now = timezone.now()
        seconds_until_start = max(0, int((room.scheduled_start_time - now).total_seconds()))

        return Response({
            'room_id': room.code,
            'start_time': room.scheduled_start_time.isoformat(),
            'player_count': room.players.count(),
            'max_players': config.max_players,
            'seconds_until_start': seconds_until_start,
            'interval_minutes': config.interval_minutes,
            'categories': room.categories,
        })
```

Upewnij się że importy na górze `views.py` zawierają `AllowAny`, `status`, `APIView`, `Response` (najczęściej już są — nie duplikuj). Jeśli pola `Room.scheduled_start_time`, `Room.is_public`, `PublicTournamentConfig.max_players` lub `interval_minutes` nie istnieją z dokładnie tymi nazwami, wejdź w `backend/apps/rooms/models.py` i dopasuj nazwy atrybutów do istniejącego modelu.

- [ ] **Krok 1.7: Dodaj trasę w `rooms/urls.py`**

W pliku `backend/apps/rooms/urls.py` dopisz import `NextPublicTournamentView` do bloku `from .views import (...)` i dodaj trasę po linii `PublicTournamentConfigView`:

```python
path('tournaments/next-public/', NextPublicTournamentView.as_view(), name='next-public-tournament'),
```

- [ ] **Krok 1.8: Uruchom test — ma przejść**

```bash
cd "D:/studia/projekt grupowy/backend"
pytest tests/test_rooms_endpoints.py::test_next_public_tournament_returns_204_when_none -v
```
Expected: PASS.

- [ ] **Krok 1.9: Usuń `serverApi.ts` (martwy kod)**

```bash
rm "D:/studia/projekt grupowy/frontend/src/lib/serverApi.ts"
```

- [ ] **Krok 1.10: Weryfikacja — brak referencji do serverApi**

```bash
cd "D:/studia/projekt grupowy"
grep -r "serverApi\|serverFetch" frontend/src || echo "OK — zero referencji"
```
Expected: `OK — zero referencji`.

- [ ] **Krok 1.11: Commit**

```bash
cd "D:/studia/projekt grupowy"
git add frontend/src/components/Navbar.tsx backend/apps/rooms/views.py backend/apps/rooms/urls.py backend/tests/test_rooms_endpoints.py
git rm frontend/src/lib/serverApi.ts
git commit -m "fix: remove dead nav links, add tournaments/next-public, drop serverApi"
```

---

## Zadanie 2 — Lobby WS: fix race condition + krótszy grace period w lobby

**Files:**
- Modify: `frontend/src/app/room/[code]/lobby/page.tsx` (~linie 58–80)
- Modify: `backend/apps/rooms/consumers.py` (metody `disconnect`, `_delayed_player_left`)
- Test: `backend/tests/test_consumers.py` (nowy test)

- [ ] **Krok 2.1: Dopisz test WS — lobby grace period == krótki**

W `backend/tests/test_consumers.py` dopisz na końcu:

```python
@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_disconnect_in_lobby_uses_short_grace_period():
    """W pokoju w statusie LOBBY gracz znika szybko (≤ 5s), nie 30s."""
    from apps.rooms.models import Room, Player

    room = await database_sync_to_async(Room.objects.create)(
        categories=['Historia'], total_rounds=5, status=Room.Status.LOBBY,
    )
    await database_sync_to_async(Player.objects.create)(
        room=room, nickname='A', is_host=True,
    )

    grace = await GameConsumer(scope={'url_route': {'kwargs': {'room_code': room.code}}})._get_grace_period_for(room.code)
    assert grace <= 5
```

Jeśli API instancyjne jest niewygodne, zamiast tego test otwiera komunikator, robi disconnect i mierzy czas broadcastu `player_left`; ale wersja testu-jednostki metody `_get_grace_period_for(room_code)` jest prostsza.

- [ ] **Krok 2.2: Dopisz test — grace period w grze trwa 30s**

Po poprzednim teście:

```python
@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_disconnect_in_game_uses_long_grace_period():
    from apps.rooms.models import Room

    room = await database_sync_to_async(Room.objects.create)(
        categories=['Historia'], total_rounds=5, status=Room.Status.IN_PROGRESS,
    )
    grace = await GameConsumer(scope={'url_route': {'kwargs': {'room_code': room.code}}})._get_grace_period_for(room.code)
    assert grace == 30
```

- [ ] **Krok 2.3: Uruchom testy — mają failować**

```bash
cd "D:/studia/projekt grupowy/backend"
pytest tests/test_consumers.py -k "grace_period" -v
```
Expected: FAIL (metoda `_get_grace_period_for` nie istnieje).

- [ ] **Krok 2.4: Dodaj metodę `_get_grace_period_for` i zmień `disconnect` + `_delayed_player_left` w consumerze**

W `backend/apps/rooms/consumers.py`:

a) Stała `GRACE_PERIOD_SECONDS = 30` pozostaje (backward compat, używana domyślnie jeśli pokój nieznany).

b) W klasie `GameConsumer` dodaj metodę:

```python
    LOBBY_GRACE_SECONDS = 3

    async def _get_grace_period_for(self, room_code: str) -> int:
        from .models import Room
        try:
            room = await database_sync_to_async(Room.objects.get)(code=room_code)
        except Room.DoesNotExist:
            return self.LOBBY_GRACE_SECONDS
        if room.status == Room.Status.LOBBY:
            return self.LOBBY_GRACE_SECONDS
        return self.GRACE_PERIOD_SECONDS
```

c) Zmień `disconnect` i `_delayed_player_left`:

```python
    async def disconnect(self, close_code):
        logger.info(
            'WS disconnect: pokój=%s nick=%s code=%s',
            self.room_code, self.nickname, close_code,
        )
        if self.nickname:
            grace = await self._get_grace_period_for(self.room_code)
            key = (self.room_code, self.nickname)
            existing = _disconnect_tasks.get(key)
            if existing and not existing.done():
                existing.cancel()
            task = asyncio.create_task(self._delayed_player_left(key, grace))
            _disconnect_tasks[key] = task
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def _delayed_player_left(self, key: tuple[str, str], grace_seconds: int):
        await asyncio.sleep(grace_seconds)
        room_code, nickname = key
        _disconnect_tasks.pop(key, None)
        await self.channel_layer.group_send(f'room_{room_code}', {
            'type': 'player_left',
            'nickname': nickname,
        })
```

- [ ] **Krok 2.5: Uruchom testy grace period — mają przejść**

```bash
pytest tests/test_consumers.py -k "grace_period" -v
```
Expected: PASS.

- [ ] **Krok 2.6: Uruchom wszystkie istniejące testy consumera — żaden nie może się zepsuć**

```bash
pytest tests/test_consumers.py -v
```
Expected: wszystkie PASS. Istniejący fixture `short_grace` ustawia `GRACE_PERIOD_SECONDS = 0.05`; po zmianach `_delayed_player_left` przyjmuje parametr — w istniejących testach grace period jest wyliczany z fixture dla pokoi w grze. Jeśli fixture przestanie działać, sprawdź czy stare testy używają `Room.Status.IN_PROGRESS` (tak powinno być) — jeśli tak, zadbaj że `LOBBY_GRACE_SECONDS` również respektuje monkeypatch: w fixture dopisz `monkeypatch.setattr(GameConsumer, 'LOBBY_GRACE_SECONDS', 0.05)`.

- [ ] **Krok 2.7: Fix race condition we frontendzie — lobby `page.tsx`**

W `frontend/src/app/room/[code]/lobby/page.tsx`:

a) **Usuń** `send({ type: 'join', nickname: nick, avatar: myAvatar });` z wewnątrz `.then(room => {...})` (obecnie linia ~78).

b) **Dodaj** `useRef` na początku komponentu obok pozostałych stanów:

```tsx
const hasJoinedRef = useRef(false);
```

c) **Zastąp** istniejący useEffect reagujący na `status`:

```tsx
useEffect(() => {
  if (status !== 'connected' || !myNick) return;
  if (!hasJoinedRef.current) {
    send({ type: 'join', nickname: myNick, avatar: myAvatar });
    hasJoinedRef.current = true;
  } else {
    send({ type: 'rejoin', nickname: myNick });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [status, myNick]);
```

(Zależność na `myAvatar` celowo pominięta — avatar pobierany raz przy pierwszym connect; zmiana avatara podczas lobby nie wymaga re-sendowania.)

d) **Upewnij się** że useEffect ładujący pokój nie wywołuje już `send`:

```tsx
useEffect(() => {
  const nick = sessionStorage.getItem(`nick_${code}`) ?? '';
  setMyNick(nick);

  api.getRoom(code).then(room => {
    setPlayers(room.players);
    const me = room.players.find(p => p.nickname === nick);
    setIsHost(me?.is_host ?? false);
    setLoading(false);
  });
}, [code]);
```

- [ ] **Krok 2.8: Weryfikacja `next build`**

```bash
cd "D:/studia/projekt grupowy/frontend"
npm run build
```
Expected: bez błędów TS.

- [ ] **Krok 2.9: Manualny test lobby w dev serverze**

W jednym terminalu: `cd backend && python manage.py runserver` (lub `daphne`). W drugim: `cd frontend && npm run dev`.

Otwórz 2 karty przeglądarki, w obu zaloguj się (różne konta), jedno konto utwórz pokój, drugie dołącz przez kod. Oczekiwane:
- Host widzi gościa natychmiast (bez F5). Gość widzi hosta.
- Gość zamyka kartę → z listy hosta znika **w ciągu ~3-4 sekund**, nie 30.

- [ ] **Krok 2.10: Commit**

```bash
cd "D:/studia/projekt grupowy"
git add frontend/src/app/room/[code]/lobby/page.tsx backend/apps/rooms/consumers.py backend/tests/test_consumers.py
git commit -m "fix: lobby join race + 3s grace period for lobby disconnects"
```

---

## Zadanie 3 — Tooltipy na trybach gry

**Files:**
- Create: `frontend/src/components/InfoTooltip.tsx`
- Modify: `frontend/src/app/create/page.tsx`
- Modify: `frontend/src/lib/i18n.ts`

- [ ] **Krok 3.1: Stwórz komponent `InfoTooltip`**

Utwórz plik `frontend/src/components/InfoTooltip.tsx`:

```tsx
'use client';

import { ReactNode, useState } from 'react';

interface Props {
  content: string;
  children: ReactNode;
}

export function InfoTooltip({ content, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen(v => !v)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 rounded-lg bg-black/95 border border-white/10 text-white text-xs font-normal leading-snug shadow-xl z-50 pointer-events-none"
        >
          {content}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-[6px] border-transparent border-t-black/95" />
        </span>
      )}
    </span>
  );
}
```

- [ ] **Krok 3.2: Dodaj klucze tłumaczeń w `i18n.ts`**

Znajdź w `frontend/src/lib/i18n.ts` blok `pl:` i dodaj (przed zamykającym `}` sekcji PL):

```ts
    // Tryby gry — tooltips
    mode_ai_tooltip: 'Pytania generowane przez AI (Gemini) na żywo z podanych kategorii.',
    mode_pack_tooltip: 'Własna paczka pytań stworzona przez Ciebie lub społeczność.',
    mode_classic_tooltip: '5–20 rund. Punkty za szybkość i serię poprawnych odpowiedzi.',
    mode_duel_tooltip: 'Szybki mecz 1v1 na 5 rund. Zwycięzca dostaje bonus 50 monet.',
    mode_survival_tooltip: 'Jedna błędna odpowiedź eliminuje. Grasz do ostatniego gracza.',
```

Następnie odszukaj blok `en:` i dodaj analogiczne:

```ts
    mode_ai_tooltip: 'Questions generated live by AI (Gemini) from your chosen categories.',
    mode_pack_tooltip: 'A custom question pack created by you or the community.',
    mode_classic_tooltip: '5–20 rounds. Points for speed and correct-answer streaks.',
    mode_duel_tooltip: 'Fast 1v1 match over 5 rounds. Winner gets a 50-coin bonus.',
    mode_survival_tooltip: 'One wrong answer eliminates you. Play until one player remains.',
```

- [ ] **Krok 3.3: Zaktualizuj typ `TranslationKey` jeśli jest zdefiniowany jako union**

Jeśli plik `i18n.ts` ma `export type TranslationKey = keyof typeof translations.pl;` — żadna zmiana nie jest potrzebna. Jeśli typ jest zdefiniowany ręcznie jako union — dopisz 5 nowych kluczy. Sprawdź to przed commitem (typecheck w kroku 3.5).

- [ ] **Krok 3.4: Podepnij `InfoTooltip` do przycisków trybów w `create/page.tsx`**

W `frontend/src/app/create/page.tsx`:

a) Dodaj import na górze:

```tsx
import { InfoTooltip } from '@/components/InfoTooltip';
```

b) Zastąp blok wyboru źródła (mode AI vs Pack, obecnie linie ~73–88) przez:

```tsx
<div className="flex gap-2 mb-5">
  <InfoTooltip content={t('mode_ai_tooltip')}>
    <button
      onClick={() => { setMode('ai'); setSelectedPackId(null); }}
      className={`flex-1 rounded-xl py-2 px-3 text-sm font-bold transition ${mode === 'ai' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
    >
      🤖 {t('create_ai')}
    </button>
  </InfoTooltip>
  <InfoTooltip content={t('mode_pack_tooltip')}>
    <button
      onClick={() => { setMode('pack'); if (packs.length > 0) setSelectedPackId(packs[0].id); }}
      className={`flex-1 rounded-xl py-2 px-3 text-sm font-bold transition ${mode === 'pack' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
      disabled={packs.length === 0}
      title={packs.length === 0 ? t('create_no_packs') : undefined}
    >
      📦 {t('create_my_pack')}
    </button>
  </InfoTooltip>
</div>
```

(Uwaga: `InfoTooltip` opakowuje każdy button osobno; `flex-1` na buttonie + brak szerokości na wrapper-span powoduje że span nie rozszerzy buttonów. Dlatego wrapper ma `inline-flex` i musimy dać mu `flex-1`. Poprawka:)

Zamień na:

```tsx
<div className="flex gap-2 mb-5">
  <InfoTooltip content={t('mode_ai_tooltip')}>
    <button className={`...flex-1...`}>...</button>
  </InfoTooltip>
</div>
```

→ **albo** prościej: przekaż `flex-1` do samego `InfoTooltip` przez dodatkowy prop `className`. Wybierzmy to podejście.

Zmień `InfoTooltip.tsx` — dodaj opcjonalny `className`:

```tsx
interface Props {
  content: string;
  children: ReactNode;
  className?: string;
}

export function InfoTooltip({ content, children, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`relative inline-flex ${className ?? ''}`}
      ...
    >
```

Następnie w `create/page.tsx` użyj `<InfoTooltip content={...} className="flex-1">`:

```tsx
<div className="flex gap-2 mb-5">
  <InfoTooltip content={t('mode_ai_tooltip')} className="flex-1">
    <button
      onClick={() => { setMode('ai'); setSelectedPackId(null); }}
      className={`w-full rounded-xl py-2 text-sm font-bold transition ${mode === 'ai' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
    >
      🤖 {t('create_ai')}
    </button>
  </InfoTooltip>
  <InfoTooltip content={t('mode_pack_tooltip')} className="flex-1">
    <button
      onClick={() => { setMode('pack'); if (packs.length > 0) setSelectedPackId(packs[0].id); }}
      className={`w-full rounded-xl py-2 text-sm font-bold transition ${mode === 'pack' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
      disabled={packs.length === 0}
      title={packs.length === 0 ? t('create_no_packs') : undefined}
    >
      📦 {t('create_my_pack')}
    </button>
  </InfoTooltip>
</div>
```

c) Analogicznie zastąp blok wyboru trybu gry (classic/duel/survival, obecnie linie ~133–146):

```tsx
<label className="block text-white text-sm font-bold mb-3 mt-4">Tryb gry</label>
<div className="flex gap-2 mb-5">
  {(['classic', 'duel', 'survival'] as const).map((m) => (
    <InfoTooltip key={m} content={t(`mode_${m}_tooltip` as const)} className="flex-1">
      <button
        onClick={() => setGameMode(m)}
        className={`w-full rounded-xl py-2 text-sm font-bold transition ${gameMode === m ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
      >
        {m === 'classic' && '🎯 Klasyczny'}
        {m === 'duel' && '⚔️ Pojedynek'}
        {m === 'survival' && '💀 Przetrwanie'}
      </button>
    </InfoTooltip>
  ))}
</div>
```

- [ ] **Krok 3.5: Weryfikacja `next build`**

```bash
cd "D:/studia/projekt grupowy/frontend"
npm run build
```
Expected: bez błędów TS. Jeśli `t(`mode_${m}_tooltip` as const)` rzuca TS error, zamień na explicit switch:

```tsx
const tooltipKey = m === 'classic' ? 'mode_classic_tooltip' : m === 'duel' ? 'mode_duel_tooltip' : 'mode_survival_tooltip';
<InfoTooltip key={m} content={t(tooltipKey)} ...>
```

- [ ] **Krok 3.6: Manualny test tooltipów**

`npm run dev`, zaloguj, przejdź do `/create`. Najedź na każdy z 5 przycisków (🤖 AI, 📦 Paczka, 🎯 Klasyczny, ⚔️ Pojedynek, 💀 Przetrwanie). Każdy pokazuje dymek z odpowiednim tekstem. Na mobile (DevTools device emulation) — klik pokazuje/ukrywa tooltip.

- [ ] **Krok 3.7: Commit**

```bash
cd "D:/studia/projekt grupowy"
git add frontend/src/components/InfoTooltip.tsx frontend/src/app/create/page.tsx frontend/src/lib/i18n.ts
git commit -m "feat: add InfoTooltip with mode descriptions on create page"
```

---

## Zadanie 4 — Powiadomienia WS dla zaproszeń do znajomych + toast z akcjami + badge

**Files:**
- Modify: `backend/apps/accounts/consumers.py` (nowe 2 handlery)
- Modify: `backend/apps/accounts/views.py` (group_send w 2 miejscach)
- Modify: `frontend/src/lib/useNotifications.ts` (rozszerzone typy)
- Modify: `frontend/src/lib/ToastContext.tsx` (parametr `actions`)
- Modify: `frontend/src/components/Toast.tsx` (render actions)
- Create: `frontend/src/lib/PendingRequestsContext.tsx`
- Modify: `frontend/src/app/layout.tsx` (owinąć provider)
- Modify: `frontend/src/components/Navbar.tsx` (useContext zamiast własnego state)
- Modify: `frontend/src/components/NotificationsMount.tsx` (obsłużyć nowy typ)
- Test: `backend/tests/test_accounts.py` (2 nowe testy)

### Część A — Backend

- [ ] **Krok 4.1: Napisz failing test — wysłanie zaproszenia emituje WS event**

W `backend/tests/test_accounts.py` dopisz na końcu:

```python
@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_send_friend_request_broadcasts_ws_event(settings):
    """POST /api/friends/request/ wysyła event friend_request_received do odbiorcy."""
    from channels.layers import get_channel_layer
    from django.contrib.auth.models import User
    from apps.accounts.models import UserProfile

    settings.CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}

    from rest_framework.test import APIClient

    sender = await database_sync_to_async(User.objects.create_user)(
        username='s@x.pl', email='s@x.pl', password='x')
    await database_sync_to_async(UserProfile.objects.create)(user=sender, display_name='Sender')
    receiver = await database_sync_to_async(User.objects.create_user)(
        username='r@x.pl', email='r@x.pl', password='x')
    receiver_profile = await database_sync_to_async(UserProfile.objects.create)(
        user=receiver, display_name='Receiver')

    layer = get_channel_layer()
    await layer.group_add(f'user_notifications_{receiver.id}', 'test-channel')

    client = APIClient()
    await database_sync_to_async(client.force_authenticate)(user=sender)
    res = await database_sync_to_async(client.post)(
        '/api/friends/request/', {'user_id': receiver_profile.id}, format='json')
    assert res.status_code == 201

    msg = await layer.receive('test-channel')
    assert msg['type'] == 'friend_request_received'
    assert msg['from_display_name'] == 'Sender'
    assert 'request_id' in msg
```

Jeśli `test_accounts.py` nie używa `pytest-asyncio` — dodaj import `pytest_asyncio` i marker `@pytest.mark.asyncio` zgodnie z istniejącym stylem projektu.

- [ ] **Krok 4.2: Uruchom test — fail**

```bash
cd "D:/studia/projekt grupowy/backend"
pytest tests/test_accounts.py::test_send_friend_request_broadcasts_ws_event -v
```
Expected: FAIL — kanał pusty / brak eventu.

- [ ] **Krok 4.3: Dodaj handlery w `NotificationConsumer`**

W `backend/apps/accounts/consumers.py` dopisz po istniejących handlerach:

```python
    async def friend_request_received(self, event):
        await self.send(json.dumps({
            'type': 'friend_request_received',
            'request_id': event['request_id'],
            'from_display_name': event['from_display_name'],
            'from_user_id': event['from_user_id'],
        }))

    async def friend_request_accepted(self, event):
        await self.send(json.dumps({
            'type': 'friend_request_accepted',
            'by_display_name': event['by_display_name'],
        }))
```

- [ ] **Krok 4.4: Dodaj `group_send` w `SendFriendRequestView`**

W `backend/apps/accounts/views.py`, w metodzie `SendFriendRequestView.post()`, tuż przed `return Response({'message': 'Request sent'}, ...)`:

```python
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

friendship = Friendship.objects.create(from_user=request.user, to_user=target_user)
channel_layer = get_channel_layer()
async_to_sync(channel_layer.group_send)(
    f'user_notifications_{target_user.id}',
    {
        'type': 'friend_request_received',
        'request_id': friendship.id,
        'from_display_name': request.user.profile.display_name,
        'from_user_id': request.user.profile.id,
    },
)
return Response({'message': 'Request sent'}, status=status.HTTP_201_CREATED)
```

(Zastępuje dotychczasowe `Friendship.objects.create(...)` + `return Response(...)`.)

- [ ] **Krok 4.5: Uruchom test — pass**

```bash
pytest tests/test_accounts.py::test_send_friend_request_broadcasts_ws_event -v
```
Expected: PASS.

- [ ] **Krok 4.6: Test dla akceptacji — napisz failing test**

W tym samym pliku:

```python
@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
async def test_accept_friend_request_broadcasts_ws_event(settings):
    """POST /api/friends/respond/ z action=accept wysyła friend_request_accepted do nadawcy."""
    from channels.layers import get_channel_layer
    from django.contrib.auth.models import User
    from apps.accounts.models import UserProfile, Friendship

    settings.CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}

    from rest_framework.test import APIClient

    sender = await database_sync_to_async(User.objects.create_user)(
        username='s@x.pl', email='s@x.pl', password='x')
    await database_sync_to_async(UserProfile.objects.create)(user=sender, display_name='Sender')
    receiver = await database_sync_to_async(User.objects.create_user)(
        username='r@x.pl', email='r@x.pl', password='x')
    await database_sync_to_async(UserProfile.objects.create)(user=receiver, display_name='Receiver')

    friendship = await database_sync_to_async(Friendship.objects.create)(
        from_user=sender, to_user=receiver)

    layer = get_channel_layer()
    await layer.group_add(f'user_notifications_{sender.id}', 'test-channel')

    client = APIClient()
    await database_sync_to_async(client.force_authenticate)(user=receiver)
    res = await database_sync_to_async(client.post)(
        '/api/friends/respond/', {'request_id': friendship.id, 'action': 'accept'}, format='json')
    assert res.status_code == 200

    msg = await layer.receive('test-channel')
    assert msg['type'] == 'friend_request_accepted'
    assert msg['by_display_name'] == 'Receiver'
```

- [ ] **Krok 4.7: Uruchom test — fail**

```bash
pytest tests/test_accounts.py::test_accept_friend_request_broadcasts_ws_event -v
```
Expected: FAIL.

- [ ] **Krok 4.8: Dodaj `group_send` w `RespondFriendRequestView`**

W `backend/apps/accounts/views.py`, w `RespondFriendRequestView.post()`, gałąź `action == 'accept'`:

```python
if request.data.get('action') == 'accept':
    friendship.status = Friendship.Status.ACCEPTED
    friendship.save()

    from channels.layers import get_channel_layer
    from asgiref.sync import async_to_sync
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'user_notifications_{friendship.from_user.id}',
        {
            'type': 'friend_request_accepted',
            'by_display_name': request.user.profile.display_name,
        },
    )

    return Response({'message': 'Accepted'})
```

- [ ] **Krok 4.9: Test — pass**

```bash
pytest tests/test_accounts.py -k "friend_request" -v
```
Expected: oba PASS.

### Część B — Frontend: Toast z akcjami

- [ ] **Krok 4.10: Rozszerz `ToastContext.tsx`**

W `frontend/src/lib/ToastContext.tsx` zamień treść na:

```tsx
'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
  style?: 'primary' | 'danger';
}

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  actions?: ToastAction[];
}

interface ToastContextValue {
  toasts: Toast[];
  show: (message: string, type?: ToastType, actions?: ToastAction[]) => number;
  hide: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const hide = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info', actions?: ToastAction[]) => {
    const id = ++counter;
    setToasts(prev => [...prev, { id, type, message, actions }]);
    if (!actions || actions.length === 0) {
      const timer = setTimeout(() => hide(id), 3000);
      timers.current.set(id, timer);
    }
    return id;
  }, [hide]);

  return (
    <ToastContext.Provider value={{ toasts, show, hide }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

- [ ] **Krok 4.11: Zaktualizuj `Toast.tsx` aby renderował akcje**

W `frontend/src/components/Toast.tsx` zamień komponent na:

```tsx
'use client';

import clsx from 'clsx';
import { Toast as ToastData } from '@/lib/ToastContext';

const STYLES: Record<ToastData['type'], string> = {
  success: 'bg-green-600/90 border-green-500/50',
  error:   'bg-red-600/90 border-red-500/50',
  info:    'bg-blue-600/90 border-blue-500/50',
  warning: 'bg-yellow-500/90 border-yellow-400/50 text-black',
};

const ICONS: Record<ToastData['type'], string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

interface Props {
  toast: ToastData;
  onClose: (id: number) => void;
}

export function ToastItem({ toast, onClose }: Props) {
  const hasActions = !!toast.actions && toast.actions.length > 0;
  return (
    <div
      className={clsx(
        'flex flex-col gap-2 px-4 py-3 rounded-xl border text-white text-sm font-medium',
        'shadow-lg animate-fade-in-up backdrop-blur-sm max-w-sm',
        STYLES[toast.type],
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 font-bold">{ICONS[toast.type]}</span>
        <span className="flex-1 leading-snug">{toast.message}</span>
        <button
          onClick={() => onClose(toast.id)}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1 text-base leading-none"
          aria-label="Zamknij"
        >
          ✕
        </button>
      </div>
      {hasActions && (
        <div className="flex gap-2 justify-end">
          {toast.actions!.map((action, i) => (
            <button
              key={i}
              onClick={() => { action.onClick(); onClose(toast.id); }}
              className={clsx(
                'px-3 py-1 rounded-md text-xs font-semibold transition-colors',
                action.style === 'danger'
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white text-black hover:bg-white/90',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Krok 4.12: Build — weryfikacja**

```bash
cd "D:/studia/projekt grupowy/frontend"
npm run build
```
Expected: bez błędów.

### Część C — Frontend: PendingRequestsContext

- [ ] **Krok 4.13: Utwórz `PendingRequestsContext.tsx`**

Nowy plik `frontend/src/lib/PendingRequestsContext.tsx`:

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';

interface PendingRequestsContextValue {
  count: number;
  increment: () => void;
  decrement: () => void;
  refetch: () => Promise<void>;
}

const PendingRequestsContext = createContext<PendingRequestsContextValue | null>(null);

export function PendingRequestsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refetch = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const pending = await api.getPendingRequests();
      setCount(pending.length);
    } catch {
      // ignoruj
    }
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => Math.max(0, c - 1)), []);

  return (
    <PendingRequestsContext.Provider value={{ count, increment, decrement, refetch }}>
      {children}
    </PendingRequestsContext.Provider>
  );
}

export function usePendingRequests() {
  const ctx = useContext(PendingRequestsContext);
  if (!ctx) throw new Error('usePendingRequests must be used within PendingRequestsProvider');
  return ctx;
}
```

- [ ] **Krok 4.14: Owinij layout providerem**

W `frontend/src/app/layout.tsx` zaimportuj i owinij istniejące providery (`AuthProvider`, `ToastProvider`, `LocaleProvider`…) — `PendingRequestsProvider` ma być **wewnątrz** `AuthProvider` (bo używa `useAuth`), np.:

```tsx
<AuthProvider>
  <LocaleProvider>
    <ToastProvider>
      <PendingRequestsProvider>
        {children}
        <NotificationsMount />
        <ToastContainer />
      </PendingRequestsProvider>
    </ToastProvider>
  </LocaleProvider>
</AuthProvider>
```

(Dopasuj do istniejącego porządku w `layout.tsx` — zachowaj istniejące, tylko dodaj `PendingRequestsProvider` wewnątrz `AuthProvider`.)

- [ ] **Krok 4.15: Zaktualizuj Navbar — użyj kontekstu**

W `frontend/src/components/Navbar.tsx`:

a) Usuń useState `pendingCount` i jego useEffect (obecnie linie 152 i 157–162).

b) Zamiast tego:

```tsx
import { usePendingRequests } from '@/lib/PendingRequestsContext';
...
const { count: pendingCount } = usePendingRequests();
```

(Wszystkie użycia `pendingCount` w JSX pozostają — zmienił się tylko sposób pozyskania wartości.)

### Część D — Frontend: useNotifications i NotificationsMount

- [ ] **Krok 4.16: Rozszerz `useNotifications.ts` o nowe typy**

W `frontend/src/lib/useNotifications.ts` zmień deklaracje typów:

```ts
export interface ChallengeNotification {
  type: 'challenge_received';
  challenge_id: number;
  room_code: string;
  from_display_name: string;
}

export interface FriendRequestReceivedNotification {
  type: 'friend_request_received';
  request_id: number;
  from_display_name: string;
  from_user_id: number;
}

export interface FriendRequestAcceptedNotification {
  type: 'friend_request_accepted';
  by_display_name: string;
}

export type NotificationMessage =
  | ChallengeNotification
  | FriendRequestReceivedNotification
  | FriendRequestAcceptedNotification;
```

(Zamienia dotychczasowy jednolity `type NotificationMessage = ChallengeNotification`.)

- [ ] **Krok 4.17: Zaktualizuj `NotificationsMount.tsx` — nowa obsługa**

Zastąp treść `frontend/src/components/NotificationsMount.tsx`:

```tsx
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/lib/ToastContext';
import {
  useNotifications,
  NotificationMessage,
} from '@/lib/useNotifications';
import { usePendingRequests } from '@/lib/PendingRequestsContext';
import { api } from '@/lib/api';

function NotificationsListener() {
  const router = useRouter();
  const { show } = useToast();
  const { increment, decrement } = usePendingRequests();

  const handleMessage = useCallback(async (msg: NotificationMessage) => {
    if (msg.type === 'challenge_received') {
      const { challenge_id, from_display_name } = msg;
      show(
        `${from_display_name} wyzwał(a) Cię na pojedynek!`,
        'info',
        [
          {
            label: 'Akceptuj',
            style: 'primary',
            onClick: async () => {
              try {
                const res = await api.respondChallenge(challenge_id, 'accept');
                if (res.room_code) {
                  const me = await api.me();
                  sessionStorage.setItem(`nick_${res.room_code}`, me.display_name);
                  router.push(`/room/${res.room_code}/lobby`);
                }
              } catch {
                show('Błąd odpowiedzi na wyzwanie', 'error');
              }
            },
          },
          {
            label: 'Odrzuć',
            style: 'danger',
            onClick: async () => {
              try {
                await api.respondChallenge(challenge_id, 'decline');
                show('Wyzwanie odrzucone', 'info');
              } catch {
                show('Błąd odpowiedzi na wyzwanie', 'error');
              }
            },
          },
        ],
      );
      return;
    }

    if (msg.type === 'friend_request_received') {
      const { request_id, from_display_name } = msg;
      increment();
      show(
        `${from_display_name} chce dodać Cię do znajomych`,
        'info',
        [
          {
            label: 'Akceptuj',
            style: 'primary',
            onClick: async () => {
              try {
                await api.respondFriendRequest(request_id, 'accept');
                decrement();
                show('Zaproszenie zaakceptowane', 'success');
              } catch {
                show('Błąd akceptacji zaproszenia', 'error');
              }
            },
          },
          {
            label: 'Odrzuć',
            style: 'danger',
            onClick: async () => {
              try {
                await api.respondFriendRequest(request_id, 'reject');
                decrement();
                show('Zaproszenie odrzucone', 'info');
              } catch {
                show('Błąd odrzucenia zaproszenia', 'error');
              }
            },
          },
        ],
      );
      return;
    }

    if (msg.type === 'friend_request_accepted') {
      show(`${msg.by_display_name} zaakceptował(a) Twoje zaproszenie`, 'success');
      return;
    }
  }, [router, show, increment, decrement]);

  useNotifications(handleMessage);
  return null;
}

export default function NotificationsMount() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <NotificationsListener />;
}
```

- [ ] **Krok 4.18: Jeśli `FriendsClient` sam aktualizuje listę pending — zsynchronizuj z kontekstem**

W `frontend/src/app/friends/FriendsClient.tsx` funkcja `handleRespond` lokalnie usuwa z pending. Dodaj synchronizację:

a) Import:

```tsx
import { usePendingRequests } from '@/lib/PendingRequestsContext';
```

b) Użycie w komponencie:

```tsx
const { decrement, refetch: refetchPending } = usePendingRequests();
```

c) W `handleRespond`, po `setPending(...)`:

```tsx
decrement();
```

d) W `handleSendRequest` brak zmian (nie dotyczy *moich* pending — tylko moich wysłanych).

- [ ] **Krok 4.19: `next build`**

```bash
cd "D:/studia/projekt grupowy/frontend"
npm run build
```
Expected: bez błędów.

- [ ] **Krok 4.20: Manualny test end-to-end powiadomień**

1. Backend `runserver` / `daphne`, frontend `npm run dev`.
2. Konto A w jednej karcie, konto B w drugiej (różne przeglądarki lub tryb incognito).
3. Z konta A → `/friends` → wyszukaj B → kliknij „Dodaj".
4. **Oczekiwane:** w karcie B natychmiast pojawia się toast „B chce dodać Cię do znajomych" z przyciskami **Akceptuj** / **Odrzuć**. Badge przy „Społeczność" w Navbarze +1.
5. Klik „Akceptuj" → toast znika, pokazuje się „Zaproszenie zaakceptowane", badge wraca. W karcie A pojawia się toast „B zaakceptował(a) Twoje zaproszenie".
6. Odśwież kartę A, wejdź w `/friends` → B jest na liście znajomych.
7. Powtórz z „Odrzuć" dla potwierdzenia drugiej ścieżki.

- [ ] **Krok 4.21: Commit**

```bash
cd "D:/studia/projekt grupowy"
git add backend/apps/accounts/consumers.py backend/apps/accounts/views.py backend/tests/test_accounts.py \
        frontend/src/lib/ToastContext.tsx frontend/src/components/Toast.tsx \
        frontend/src/lib/PendingRequestsContext.tsx frontend/src/app/layout.tsx \
        frontend/src/components/Navbar.tsx frontend/src/components/NotificationsMount.tsx \
        frontend/src/lib/useNotifications.ts frontend/src/app/friends/FriendsClient.tsx
git commit -m "feat: push WS notifications for friend requests with actionable toast"
```

---

## Self-review notes

- Brak placeholderów — każdy krok zawiera pełny kod lub dokładne polecenie.
- Zadania 1–4 są ortogonalne; mogą być wykonane w kolejności 4→2→1→3 (wg numeracji w specu) — aktualna numeracja w planie odzwierciedla kolejność wdrażania.
- Wszystkie commity bez wzmianek o AI / Co-Authored-By.
- Testy backend trafiają do istniejących plików `test_rooms_endpoints.py` / `test_consumers.py` / `test_accounts.py`.
- Frontend nie ma test framework — weryfikacja przez `next build` + manualny test w dev serverze (udokumentowane w każdym zadaniu).
