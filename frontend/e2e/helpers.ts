import { Page } from '@playwright/test';

export const MOCK_USER = {
  id: 1,
  display_name: 'TestUser',
  email: 'test@example.com',
  total_score: 1500,
  games_played: 10,
  created_at: '2024-01-01T00:00:00Z',
};

export const MOCK_USER_2 = {
  id: 2,
  display_name: 'OtherPlayer',
  email: 'other@example.com',
  total_score: 800,
  games_played: 5,
  created_at: '2024-01-01T00:00:00Z',
};

/**
 * Mockuje /api/auth/me/ zwracając zalogowanego użytkownika.
 * Konieczne dla stron wymagających autentykacji.
 */
export async function mockAuth(page: Page, user = MOCK_USER) {
  await page.route('**/api/auth/me/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });
}

/**
 * Mockuje /api/auth/me/ zwracając 401 (brak autentykacji).
 * Używane przed zalogowaniem się w testach auth.
 */
export async function mockUnauthenticated(page: Page) {
  await page.route('**/api/auth/me/', async route => {
    await route.fulfill({ status: 401, body: '{}' });
  });
}

/**
 * Ustawia nick gracza w sessionStorage dla danego kodu pokoju.
 * Musi być wywołane po nawigacji do domeny (strona jest załadowana).
 */
export async function setPlayerNick(page: Page, roomCode: string, nick: string) {
  await page.evaluate(
    ([code, nickname]) => sessionStorage.setItem(`nick_${code}`, nickname),
    [roomCode, nick],
  );
}

export const MOCK_ROOM_CODE = 'ABCD12';

export const MOCK_ROOM = {
  code: MOCK_ROOM_CODE,
  categories: ['Historia', 'Nauka'],
  status: 'lobby' as const,
  total_rounds: 5,
  current_round: 0,
  player_count: 1,
  players: [
    { id: 1, nickname: MOCK_USER.display_name, score: 0, is_host: true },
  ],
};
