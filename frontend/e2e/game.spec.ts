import { test, expect } from '@playwright/test';
import { mockAuth, MOCK_USER, MOCK_ROOM, MOCK_ROOM_CODE } from './helpers';

/** Pomocnik: ustawia środowisko lobby (auth + room API + WebSocket mock). */
async function setupLobby(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page);

  await page.route(`**/api/rooms/${MOCK_ROOM_CODE}/`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ROOM),
    });
  });

  // Ustaw nick przed nawigacją do lobby
  await page.goto('/');
  await page.evaluate(
    ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
    [MOCK_ROOM_CODE, MOCK_USER.display_name],
  );
}

test.describe('Przebieg gry', () => {
  test('host może rozpocząć grę z lobby', async ({ page }) => {
    await setupLobby(page);

    // WebSocket: odpowiedz na join + game_start po starcie
    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
      ws.onMessage(data => {
        const msg = JSON.parse(data as string);

        if (msg.type === 'join') {
          ws.send(JSON.stringify({ type: 'player_joined', nickname: msg.nickname }));
        }

        if (msg.type === 'start_game') {
          ws.send(JSON.stringify({
            type: 'game_start',
            total_rounds: 5,
            categories: ['Historia'],
          }));
        }
      });
    });

    await page.goto(`/room/${MOCK_ROOM_CODE}/lobby`);
    await expect(page.getByRole('button', { name: 'Start gry' })).toBeVisible();

    await page.getByRole('button', { name: 'Start gry' }).click();

    // Po kliknięciu "Start gry" router.push przenosi do /game
    await expect(page).toHaveURL(`/room/${MOCK_ROOM_CODE}/game`);
  });

  test('strona gry wyświetla pytanie po odebraniu wiadomości WebSocket', async ({ page }) => {
    await mockAuth(page);

    await page.goto('/');
    await page.evaluate(
      ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
      [MOCK_ROOM_CODE, MOCK_USER.display_name],
    );

    // WebSocket: natychmiast wyślij pytanie po dołączeniu
    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
      ws.onMessage(data => {
        const msg = JSON.parse(data as string);

        if (msg.type === 'join') {
          ws.send(JSON.stringify({
            type: 'question',
            round_number: 1,
            total_rounds: 5,
            question: 'Kto napisał "Pan Tadeusz"?',
            options: ['Adam Mickiewicz', 'Juliusz Słowacki', 'Zygmunt Krasiński', 'Cyprian Kamil Norwid'],
          }));
        }
      });
    });

    await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

    await expect(page.getByText('Kto napisał "Pan Tadeusz"?')).toBeVisible();
    await expect(page.getByText('Adam Mickiewicz')).toBeVisible();
    await expect(page.getByText('Juliusz Słowacki')).toBeVisible();
    // Numer rundy i timer powinny być widoczne
    await expect(page.getByText(/Runda/)).toBeVisible();
  });

  test('gracz może wybrać odpowiedź i widzi wynik', async ({ page }) => {
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
            question: 'Kto napisał "Pan Tadeusz"?',
            options: ['Adam Mickiewicz', 'Juliusz Słowacki', 'Zygmunt Krasiński', 'Cyprian Kamil Norwid'],
          }));
        }

        if (msg.type === 'answer') {
          ws.send(JSON.stringify({
            type: 'answer_result',
            is_correct: true,
            correct_answer: 'A',
            explanation: 'Adam Mickiewicz napisał "Pan Tadeusz" w 1834 roku.',
            points_earned: 1000,
            total_score: 1000,
          }));
        }
      });
    });

    await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

    // Poczekaj na pojawienie się pytania
    await expect(page.getByText('Kto napisał "Pan Tadeusz"?')).toBeVisible();

    // Kliknij pierwszą odpowiedź (A)
    await page.getByText('Adam Mickiewicz').click();

    // Wynik powinien być widoczny
    await expect(page.getByText(/Poprawnie/)).toBeVisible();
    await expect(page.getByText(/1000 pkt/)).toBeVisible();
  });

  test('błędna odpowiedź wyświetla prawidłową odpowiedź', async ({ page }) => {
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
            question: 'Kto napisał "Pan Tadeusz"?',
            options: ['Adam Mickiewicz', 'Juliusz Słowacki', 'Zygmunt Krasiński', 'Cyprian Kamil Norwid'],
          }));
        }

        if (msg.type === 'answer') {
          ws.send(JSON.stringify({
            type: 'answer_result',
            is_correct: false,
            correct_answer: 'A',
            explanation: 'Adam Mickiewicz napisał "Pan Tadeusz" w 1834 roku.',
            points_earned: 0,
            total_score: 0,
          }));
        }
      });
    });

    await page.goto(`/room/${MOCK_ROOM_CODE}/game`);
    await expect(page.getByText('Kto napisał "Pan Tadeusz"?')).toBeVisible();

    // Kliknij błędną odpowiedź (B)
    await page.getByText('Juliusz Słowacki').click();

    await expect(page.getByText(/Blad/)).toBeVisible();
    await expect(page.getByText(/Prawidłowa odpowiedź: A/)).toBeVisible();
  });

  test('strona wyników pojawia się po zakończeniu gry', async ({ page }) => {
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
          // Od razu wyślij game_over
          ws.send(JSON.stringify({
            type: 'game_over',
            leaderboard: [
              { nickname: MOCK_USER.display_name, score: 3500 },
              { nickname: 'OtherPlayer', score: 2100 },
            ],
          }));
        }
      });
    });

    await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

    // Ekran końca gry
    await expect(page.getByText('Koniec gry!')).toBeVisible();
    await expect(page.getByText('Wyniki końcowe')).toBeVisible();
    await expect(page.getByText(MOCK_USER.display_name)).toBeVisible();
    await expect(page.getByText('3 500')).toBeVisible({ timeout: 5000 }).catch(() =>
      // Różne locale formatowania liczb — sprawdź alternatywnie
      expect(page.getByText(/3.500|3 500|3500/)).toBeVisible()
    );
  });

  test('przycisk "Zagraj ponownie" prowadzi na stronę główną', async ({ page }) => {
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

  test('ekran oczekiwania pojawia się podczas generowania pytania', async ({ page }) => {
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
          // Wyślij game_state z trwającą grą, ale bez bieżącego pytania
          ws.send(JSON.stringify({
            type: 'game_state',
            room_status: 'in_progress',
            current_round: 1,
            total_rounds: 5,
            score: 0,
            current_question: null,
          }));
        }
      });
    });

    await page.goto(`/room/${MOCK_ROOM_CODE}/game`);

    await expect(page.getByText('AI generuje pytanie...')).toBeVisible();
  });
});
