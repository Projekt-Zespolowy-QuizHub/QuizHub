import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated, MOCK_USER, MOCK_ROOM_CODE } from './helpers';

async function mockPublicGameApi(page: Parameters<typeof mockAuth>[0], code = MOCK_ROOM_CODE) {
  await page.route('**/api/rooms/public/next/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code, starts_at: new Date(Date.now() + 5000).toISOString() }),
    });
  });

  await page.route('**/api/rooms/join/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code, status: 'lobby' }),
    });
  });
}

async function mockPublicGameNotFound(page: Parameters<typeof mockAuth>[0]) {
  await page.route('**/api/rooms/public/next/', async route => {
    await route.fulfill({ status: 404, body: '{}' });
  });
}

test.describe('Matchmaking', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/matchmaking');
    await expect(page).toHaveURL('/login');
  });

  test('pokazuje animację szukania przeciwnika', async ({ page }) => {
    await mockAuth(page);
    await mockPublicGameApi(page);

    // Mockujemy WS żeby nie następowało przekierowanie
    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
      // Nie odpowiadamy - zostajemy w trybie searching
    });

    await page.goto('/matchmaking');

    await expect(page.getByText('Szukam przeciwnika...')).toBeVisible();
  });

  test('pokazuje licznik czasu oczekiwania', async ({ page }) => {
    await mockAuth(page);
    await mockPublicGameApi(page);

    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {});

    await page.goto('/matchmaking');

    await expect(page.getByText(/Czas oczekiwania:/)).toBeVisible();
  });

  test('przycisk Anuluj jest widoczny', async ({ page }) => {
    await mockAuth(page);
    await mockPublicGameApi(page);

    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {});

    await page.goto('/matchmaking');

    await expect(page.getByRole('button', { name: 'Anuluj' })).toBeVisible();
  });

  test('kliknięcie Anuluj wraca do poprzedniej strony', async ({ page }) => {
    await mockAuth(page);
    await mockPublicGameApi(page);

    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {});

    // Najpierw idź na dashboard, potem na matchmaking
    await page.goto('/dashboard');
    await page.goto('/matchmaking');

    await page.getByRole('button', { name: 'Anuluj' }).click();

    // Powinno wrócić do poprzedniej strony (dashboard)
    await expect(page).toHaveURL('/dashboard');
  });

  test('gdy znaleziono grę - wyświetla komunikat o przekierowaniu', async ({ page }) => {
    await mockAuth(page);
    await mockPublicGameApi(page);

    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
      ws.onMessage(data => {
        const msg = JSON.parse(data as string);
        if (msg.type === 'join') {
          ws.send(JSON.stringify({ type: 'game_start', total_rounds: 5 }));
        }
      });
    });

    await page.goto('/matchmaking');

    await expect(page.getByText('Znaleziono grę! Przekierowuję...')).toBeVisible({ timeout: 5000 });
  });

  test('gdy brak dostępnych gier - wyświetla błąd', async ({ page }) => {
    await mockAuth(page);
    await mockPublicGameNotFound(page);

    await page.goto('/matchmaking');

    await expect(page.getByText('Brak dostępnych gier. Spróbuj ponownie za chwilę.')).toBeVisible();
  });

  test('spinner animacyjny jest widoczny podczas szukania', async ({ page }) => {
    await mockAuth(page);
    await mockPublicGameApi(page);

    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {});

    await page.goto('/matchmaking');

    // Ikona ⚔️ jest w środku spinnera
    await expect(page.getByText('⚔️')).toBeVisible();
  });

  test('licznik sekund oczekiwania się zwiększa', async ({ page }) => {
    await mockAuth(page);
    await mockPublicGameApi(page);

    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {});

    await page.goto('/matchmaking');

    // Poczekaj 2 sekundy - licznik powinien wzrosnąć
    await expect(page.getByText(/Czas oczekiwania: \d+s/)).toBeVisible();
    await page.waitForTimeout(2100);
    await expect(page.getByText(/Czas oczekiwania: [2-9]\d*s/)).toBeVisible();
  });
});
