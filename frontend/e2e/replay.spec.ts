import { test, expect } from '@playwright/test';
import { mockAuth, MOCK_ROOM_CODE } from './helpers';

const MOCK_REPLAY_DATA = {
  room_code: MOCK_ROOM_CODE,
  questions: [
    {
      round: 1,
      content: 'Kto napisał "Pan Tadeusz"?',
      options: ['Adam Mickiewicz', 'Juliusz Słowacki', 'Zygmunt Krasiński', 'Cyprian Norwid'],
      correct: 'A',
      explanation: 'Adam Mickiewicz napisał "Pan Tadeusz" w 1834 roku.',
      fastest_nick: 'TestUser',
      answers: [
        {
          nickname: 'TestUser',
          chosen_option: 'A',
          is_correct: true,
          response_time_ms: 3200,
          points_earned: 850,
        },
        {
          nickname: 'OtherPlayer',
          chosen_option: 'B',
          is_correct: false,
          response_time_ms: 7100,
          points_earned: 0,
        },
      ],
    },
    {
      round: 2,
      content: 'Ile planet ma Układ Słoneczny?',
      options: ['7', '8', '9', '10'],
      correct: 'B',
      explanation: 'Od 2006 roku Układ Słoneczny oficjalnie ma 8 planet.',
      fastest_nick: 'OtherPlayer',
      answers: [
        {
          nickname: 'TestUser',
          chosen_option: 'C',
          is_correct: false,
          response_time_ms: 5000,
          points_earned: 0,
        },
        {
          nickname: 'OtherPlayer',
          chosen_option: 'B',
          is_correct: true,
          response_time_ms: 2100,
          points_earned: 1000,
        },
      ],
    },
  ],
};

async function mockReplayApi(page: Parameters<typeof mockAuth>[0], code = MOCK_ROOM_CODE) {
  await page.route(`**/api/rooms/${code}/replay/`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REPLAY_DATA),
    });
  });
}

test.describe('Replay gry', () => {
  test('strona replay się ładuje', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByRole('heading', { name: /Szczegóły gry/ })).toBeVisible();
  });

  test('tytuł zawiera kod pokoju', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText(MOCK_ROOM_CODE)).toBeVisible();
  });

  test('wyświetlane są wszystkie pytania', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText('Kto napisał "Pan Tadeusz"?')).toBeVisible();
    await expect(page.getByText('Ile planet ma Układ Słoneczny?')).toBeVisible();
  });

  test('numery rund są wyświetlane', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText(/Runda 1/)).toBeVisible();
    await expect(page.getByText(/Runda 2/)).toBeVisible();
  });

  test('odpowiedzi graczy są wyświetlane', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText('Odpowiedzi graczy:').first()).toBeVisible();
    await expect(page.getByText('TestUser').first()).toBeVisible();
    await expect(page.getByText('OtherPlayer').first()).toBeVisible();
  });

  test('poprawne odpowiedzi mają zielone oznaczenie ✓', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText('✓').first()).toBeVisible();
  });

  test('błędne odpowiedzi mają czerwone oznaczenie ✗', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText('✗').first()).toBeVisible();
  });

  test('zdobyte punkty są wyświetlane', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText('850 pkt')).toBeVisible();
    await expect(page.getByText('1000 pkt')).toBeVisible();
  });

  test('najszybszy gracz jest wyróżniony', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    // fastest_nick: 'TestUser' dla rundy 1
    await expect(page.getByText(/Najszybszy/).first()).toBeVisible();
    await expect(page.getByText(/TestUser/).first()).toBeVisible();
  });

  test('wyjaśnienia odpowiedzi są widoczne', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText('Adam Mickiewicz napisał "Pan Tadeusz" w 1834 roku.')).toBeVisible();
  });

  test('poprawna odpowiedź ma zielone tło', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    // Poprawna opcja A powinna mieć green styling
    const correctOption = page.locator('.bg-green-500\\/20').first();
    await expect(correctOption).toBeVisible();
  });

  test('czas odpowiedzi jest wyświetlany', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    // 3200ms = 3.2s
    await expect(page.getByText('3.2s')).toBeVisible();
  });

  test('przycisk Wróć jest widoczny', async ({ page }) => {
    await mockAuth(page);
    await mockReplayApi(page);
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByRole('button', { name: 'Wróć' })).toBeVisible();
  });

  test('gdy replay nie istnieje - wyświetla komunikat błędu', async ({ page }) => {
    await mockAuth(page);
    await page.route(`**/api/rooms/${MOCK_ROOM_CODE}/replay/`, async route => {
      await route.fulfill({ status: 404, body: '{}' });
    });
    await page.goto(`/room/${MOCK_ROOM_CODE}/replay`);

    await expect(page.getByText(/Nie znaleziono replaya/)).toBeVisible();
  });
});
