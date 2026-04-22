import { test, expect } from '@playwright/test';
import { mockAuth, MOCK_USER, MOCK_ROOM, MOCK_ROOM_CODE } from './helpers';

test.describe('Tworzenie i dołączanie do pokoju', () => {
  test.describe('Tworzenie pokoju', () => {
    test('formularz tworzenia pokoju jest dostępny po zalogowaniu', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      await expect(page.getByText('Utworz prywatna gre')).toBeVisible();
      await expect(page.getByPlaceholder('Kategoria...')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Utworz pokoj' })).toBeVisible();
    });

    test('użytkownik może dodać kategorię przez Enter', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      const input = page.getByPlaceholder('Kategoria...');
      await input.fill('Historia');
      await input.press('Enter');

      await expect(page.getByText('Historia')).toBeVisible();
    });

    test('użytkownik może dodać kategorię przez przycisk +', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      await page.getByPlaceholder('Kategoria...').fill('Nauka');
      await page.getByRole('button', { name: '+' }).click();

      await expect(page.getByText('Nauka')).toBeVisible();
    });

    test('można dodać maksymalnie 3 kategorie', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      const input = page.getByPlaceholder('Kategoria...');
      for (const cat of ['Historia', 'Nauka', 'Sport']) {
        await input.fill(cat);
        await input.press('Enter');
      }

      // Czwarta kategoria nie powinna być możliwa — input jest zablokowany
      await expect(input).toBeDisabled();
    });

    test('można usunąć kategorię', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      await page.getByPlaceholder('Kategoria...').fill('Historia');
      await page.getByRole('button', { name: '+' }).click();
      await expect(page.getByText('Historia')).toBeVisible();

      // Kliknij przycisk usunięcia (tekst "x")
      await page.getByRole('button', { name: 'x' }).click();
      await expect(page.getByText('Historia')).not.toBeVisible();
    });

    test('błąd gdy brak kategorii', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      await page.getByRole('button', { name: 'Utworz pokoj' }).click();

      await expect(page.getByText('Dodaj przynajmniej 1 kategorie')).toBeVisible();
    });

    test('tworzenie pokoju przekierowuje do lobby', async ({ page }) => {
      await mockAuth(page);

      await page.route('**/api/rooms/', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ room_code: MOCK_ROOM_CODE }),
          });
        } else {
          await route.continue();
        }
      });

      // Lobby potrzebuje danych pokoju
      await page.route(`**/api/rooms/${MOCK_ROOM_CODE}/`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ROOM),
        });
      });

      // Lobby otwiera WebSocket — mockujemy aby uniknąć błędów połączenia
      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(() => {});
      });

      await page.goto('/create');
      await page.getByPlaceholder('Kategoria...').fill('Historia');
      await page.getByRole('button', { name: '+' }).click();
      await page.getByRole('button', { name: 'Utworz pokoj' }).click();

      await expect(page).toHaveURL(`/room/${MOCK_ROOM_CODE}/lobby`);
    });

    test('kod pokoju jest widoczny w lobby po utworzeniu', async ({ page }) => {
      await mockAuth(page);

      await page.route('**/api/rooms/', async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ room_code: MOCK_ROOM_CODE }),
          });
        } else {
          await route.continue();
        }
      });

      await page.route(`**/api/rooms/${MOCK_ROOM_CODE}/`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ROOM),
        });
      });

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(() => {});
      });

      await page.goto('/create');
      await page.getByPlaceholder('Kategoria...').fill('Historia');
      await page.getByRole('button', { name: '+' }).click();
      await page.getByRole('button', { name: 'Utworz pokoj' }).click();

      await expect(page.getByText(MOCK_ROOM_CODE)).toBeVisible();
    });
  });

  test.describe('Dołączanie do pokoju', () => {
    test('formularz dołączania do pokoju jest dostępny', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/join');

      await expect(page.getByText('Dolacz do gry')).toBeVisible();
      await expect(page.getByPlaceholder('np. AB3XYZ')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Dolacz' })).toBeVisible();
    });

    test('dołączenie do pokoju z poprawnym kodem przekierowuje do lobby', async ({ page }) => {
      await mockAuth(page);

      await page.route('**/api/rooms/join/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            room_code: MOCK_ROOM_CODE,
            player_id: 2,
            nickname: MOCK_USER.display_name,
          }),
        });
      });

      await page.route(`**/api/rooms/${MOCK_ROOM_CODE}/`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ROOM),
        });
      });

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(() => {});
      });

      await page.goto('/join');
      await page.getByPlaceholder('np. AB3XYZ').fill(MOCK_ROOM_CODE);
      await page.getByRole('button', { name: 'Dolacz' }).click();

      await expect(page).toHaveURL(`/room/${MOCK_ROOM_CODE}/lobby`);
    });

    test('nieprawidłowy kod pokoju wyświetla błąd', async ({ page }) => {
      await mockAuth(page);

      await page.route('**/api/rooms/join/', async route => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Room not found' }),
        });
      });

      await page.goto('/join');
      await page.getByPlaceholder('np. AB3XYZ').fill('ZLYXXX');
      await page.getByRole('button', { name: 'Dolacz' }).click();

      await expect(page.getByText('Nie znaleziono pokoju lub jest pelny')).toBeVisible();
    });

    test('kod pokoju jest automatycznie zamieniany na wielkie litery', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/join');

      const input = page.getByPlaceholder('np. AB3XYZ');
      await input.fill('abcdef');

      await expect(input).toHaveValue('ABCDEF');
    });
  });

  test.describe('Lobby', () => {
    test('lobby wyświetla graczy i kod pokoju', async ({ page }) => {
      await mockAuth(page);

      await page.route(`**/api/rooms/${MOCK_ROOM_CODE}/`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ROOM),
        });
      });

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(() => {});
      });

      // Ustaw nick zanim wejdziemy do lobby
      await page.goto('/');
      await page.evaluate(
        ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
        [MOCK_ROOM_CODE, MOCK_USER.display_name],
      );

      await page.goto(`/room/${MOCK_ROOM_CODE}/lobby`);

      await expect(page.getByText('Lobby gry')).toBeVisible();
      await expect(page.getByText(MOCK_ROOM_CODE)).toBeVisible();
      await expect(page.getByText(MOCK_USER.display_name)).toBeVisible();
    });

    test('host widzi przycisk Start gry', async ({ page }) => {
      await mockAuth(page);

      await page.route(`**/api/rooms/${MOCK_ROOM_CODE}/`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ROOM),
        });
      });

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(() => {});
      });

      await page.goto('/');
      await page.evaluate(
        ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
        [MOCK_ROOM_CODE, MOCK_USER.display_name],
      );

      await page.goto(`/room/${MOCK_ROOM_CODE}/lobby`);

      await expect(page.getByRole('button', { name: 'Start gry' })).toBeVisible();
    });
  });
});
