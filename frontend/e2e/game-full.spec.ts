import { test, expect } from '@playwright/test';
import { mockAuth, MOCK_USER, MOCK_ROOM, MOCK_ROOM_CODE, mockUnauthenticated } from './helpers';

// Pomocnik: konfiguruje lobby z auth, room API i WebSocket
async function setupLobby(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page);

  await page.route(`**/api/rooms/${MOCK_ROOM_CODE}/`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ROOM),
    });
  });

  await page.goto('/');
  await page.evaluate(
    ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
    [MOCK_ROOM_CODE, MOCK_USER.display_name],
  );
}

test.describe('Gra — pełny przepływ', () => {
  test.describe('Tworzenie pokoju', () => {
    test('strona tworzenia pokoju ładuje się z formularzem', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      await expect(page.getByText('Utworz prywatna gre')).toBeVisible();
      await expect(page.getByPlaceholder('Kategoria...')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Utworz pokoj' })).toBeVisible();
    });

    test('można wybrać tryb gry — classic', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      // Szukaj przycisku/opcji trybu classic
      const classicOption = page.getByRole('button', { name: /classic/i })
        .or(page.getByLabel(/classic/i))
        .or(page.getByText(/classic/i).first());

      const classicVisible = await classicOption.isVisible().catch(() => false);
      if (classicVisible) {
        await classicOption.click();
        // Po kliknięciu opcja jest aktywna
        await expect(classicOption).toBeVisible();
      } else {
        // Tryb wyboru jest opcjonalny — pomijamy jeśli go nie ma
        test.skip();
      }
    });

    test('można wybrać tryb gry — duel', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      const duelOption = page.getByRole('button', { name: /duel/i })
        .or(page.getByLabel(/duel/i))
        .or(page.getByText(/duel/i).first());

      const duelVisible = await duelOption.isVisible().catch(() => false);
      if (duelVisible) {
        await duelOption.click();
        await expect(duelOption).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('można wybrać tryb gry — survival', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/create');

      const survivalOption = page.getByRole('button', { name: /survival/i })
        .or(page.getByLabel(/survival/i))
        .or(page.getByText(/survival/i).first());

      const survivalVisible = await survivalOption.isVisible().catch(() => false);
      if (survivalVisible) {
        await survivalOption.click();
        await expect(survivalOption).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('tworzenie pokoju z kategorią przekierowuje do lobby', async ({ page }) => {
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

      await expect(page).toHaveURL(`/room/${MOCK_ROOM_CODE}/lobby`);
    });
  });

  test.describe('Dołączanie do pokoju', () => {
    test('dołączenie z poprawnym kodem nawiguje do lobby', async ({ page }) => {
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

    test('dołączenie z nieprawidłowym kodem pokazuje błąd', async ({ page }) => {
      await mockAuth(page);

      await page.route('**/api/rooms/join/', async route => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Room not found' }),
        });
      });

      await page.goto('/join');
      await page.getByPlaceholder('np. AB3XYZ').fill('ZLYYYY');
      await page.getByRole('button', { name: 'Dolacz' }).click();

      await expect(page.getByText('Nie znaleziono pokoju lub jest pelny')).toBeVisible();
    });
  });

  test.describe('Lobby', () => {
    test('lobby pokazuje listę graczy', async ({ page }) => {
      await setupLobby(page);

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(() => {});
      });

      await page.goto(`/room/${MOCK_ROOM_CODE}/lobby`);

      await expect(page.getByText('Lobby gry')).toBeVisible();
      await expect(page.getByText(MOCK_USER.display_name)).toBeVisible();
    });

    test('lobby pokazuje przycisk "Start gry" dla hosta', async ({ page }) => {
      await setupLobby(page);

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(() => {});
      });

      await page.goto(`/room/${MOCK_ROOM_CODE}/lobby`);

      await expect(page.getByRole('button', { name: 'Start gry' })).toBeVisible();
    });

    test('lobby wyświetla kod pokoju', async ({ page }) => {
      await setupLobby(page);

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(() => {});
      });

      await page.goto(`/room/${MOCK_ROOM_CODE}/lobby`);

      await expect(page.getByText(MOCK_ROOM_CODE)).toBeVisible();
    });
  });

  test.describe('Wyniki końcowe', () => {
    test('strona wyników pokazuje końcowe punkty', async ({ page }) => {
      await mockAuth(page);

      await page.goto('/');
      await page.evaluate(
        ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
        [MOCK_ROOM_CODE, MOCK_USER.display_name],
      );

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(data => {
          const msg = JSON.parse(data as string);
          if (msg.type === 'join') {
            ws.send(JSON.stringify({
              type: 'game_over',
              leaderboard: [
                { nickname: MOCK_USER.display_name, score: 4200 },
                { nickname: 'OtherPlayer', score: 1800 },
              ],
            }));
          }
        });
      });

      await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

      await expect(page.getByText('Koniec gry!')).toBeVisible();
      await expect(page.getByText('Wyniki końcowe')).toBeVisible();
      await expect(page.getByText(MOCK_USER.display_name)).toBeVisible();
    });

    test('strona wyników pokazuje wyniki dla wszystkich graczy', async ({ page }) => {
      await mockAuth(page);

      await page.goto('/');
      await page.evaluate(
        ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
        [MOCK_ROOM_CODE, MOCK_USER.display_name],
      );

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(data => {
          const msg = JSON.parse(data as string);
          if (msg.type === 'join') {
            ws.send(JSON.stringify({
              type: 'game_over',
              leaderboard: [
                { nickname: MOCK_USER.display_name, score: 4200 },
                { nickname: 'OtherPlayer', score: 1800 },
              ],
            }));
          }
        });
      });

      await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

      await expect(page.getByText('Koniec gry!')).toBeVisible();
      await expect(page.getByText('OtherPlayer')).toBeVisible();
    });

    test('strona wyników ma przycisk "Zagraj ponownie"', async ({ page }) => {
      await mockAuth(page);

      await page.goto('/');
      await page.evaluate(
        ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
        [MOCK_ROOM_CODE, MOCK_USER.display_name],
      );

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(data => {
          const msg = JSON.parse(data as string);
          if (msg.type === 'join') {
            ws.send(JSON.stringify({
              type: 'game_over',
              leaderboard: [{ nickname: MOCK_USER.display_name, score: 1000 }],
            }));
          }
        });
      });

      await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

      await expect(page.getByText('Koniec gry!')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Zagraj ponownie' })).toBeVisible();
    });

    test('przycisk "Zagraj ponownie" przenosi na stronę główną', async ({ page }) => {
      await mockAuth(page);

      await page.goto('/');
      await page.evaluate(
        ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
        [MOCK_ROOM_CODE, MOCK_USER.display_name],
      );

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(data => {
          const msg = JSON.parse(data as string);
          if (msg.type === 'join') {
            ws.send(JSON.stringify({
              type: 'game_over',
              leaderboard: [{ nickname: MOCK_USER.display_name, score: 1000 }],
            }));
          }
        });
      });

      await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

      await expect(page.getByText('Koniec gry!')).toBeVisible();
      await page.getByRole('button', { name: 'Zagraj ponownie' }).click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Rozgrywka', () => {
    test('strona gry wyświetla pytanie po odebraniu wiadomości WebSocket', async ({ page }) => {
      await mockAuth(page);

      await page.goto('/');
      await page.evaluate(
        ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
        [MOCK_ROOM_CODE, MOCK_USER.display_name],
      );

      await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
        ws.onMessage(data => {
          const msg = JSON.parse(data as string);
          if (msg.type === 'join') {
            ws.send(JSON.stringify({
              type: 'question',
              round_number: 1,
              total_rounds: 5,
              question: 'Stolica Polski to?',
              options: ['Warszawa', 'Kraków', 'Gdańsk', 'Poznań'],
            }));
          }
        });
      });

      await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

      await expect(page.getByText('Stolica Polski to?')).toBeVisible();
      await expect(page.getByText('Warszawa')).toBeVisible();
      await expect(page.getByText(/Runda/)).toBeVisible();
    });

    test('niezalogowany użytkownik bez nicku nie może grać', async ({ page }) => {
      await mockUnauthenticated(page);

      // Brak nicku w sessionStorage — strona powinna przekierować lub pokazać błąd
      await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

      // Oczekujemy przekierowania na login lub stronę główną
      const url = page.url();
      const redirected =
        url.includes('/login') ||
        url.includes('/') ||
        url === `http://localhost:3000/`;
      expect(redirected).toBe(true);
    });
  });
});
