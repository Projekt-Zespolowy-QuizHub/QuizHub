import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated, MOCK_USER } from './helpers';

const MOCK_STATS = {
  display_name: MOCK_USER.display_name,
  games_played: 42,
  total_score: 18500,
  wins: 20,
  win_rate: 47,
  correct_percentage: 73,
  avg_response_time_ms: 8400,
  best_streak: 12,
  category_accuracy: [
    { category: 'Historia', accuracy: 85, total_answers: 60 },
    { category: 'Nauka', accuracy: 72, total_answers: 45 },
    { category: 'Sport', accuracy: 91, total_answers: 30 },
  ],
  games_per_day: {
    [new Date().toISOString().split('T')[0]]: 3,
    [new Date(Date.now() - 86400000).toISOString().split('T')[0]]: 1,
  },
  performance_trend: [
    { date: '2026-03-10', score: 1200 },
    { date: '2026-03-11', score: 1450 },
    { date: '2026-03-12', score: 1100 },
    { date: '2026-03-13', score: 1800 },
  ],
};

async function mockStatsApi(page: Parameters<typeof mockAuth>[0]) {
  await page.route('**/api/profile/stats/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STATS),
    });
  });
}

test.describe('Statystyki', () => {
  test('niezalogowany użytkownik widzi komunikat logowania', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/stats');

    await expect(page.getByText(/Zaloguj się/)).toBeVisible();
  });

  test('strona statystyk się ładuje', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByRole('heading', { name: 'Statystyki' })).toBeVisible();
  });

  test('karty podsumowania wyświetlają dane', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByText('Rozegrane gry')).toBeVisible();
    await expect(page.getByText('42')).toBeVisible();
    await expect(page.getByText('Łączne punkty')).toBeVisible();
    await expect(page.getByText('18 500').or(page.getByText('18500'))).toBeVisible();
  });

  test('karta celności wyświetla wartość procentową', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByText('Celność')).toBeVisible();
    await expect(page.getByText('73%')).toBeVisible();
  });

  test('karta wygranych wyświetla liczbę i procent', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByText('Wygrane')).toBeVisible();
    // "20 (47%)" format
    await expect(page.getByText(/20.*47%/)).toBeVisible();
  });

  test('karta najlepszego streaku', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByText('Najlepszy streak')).toBeVisible();
    await expect(page.getByText('12')).toBeVisible();
  });

  test('karta średniego czasu odpowiedzi', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByText('Śr. czas odpowiedzi')).toBeVisible();
    // 8400ms = 8.4s
    await expect(page.getByText('8.4s')).toBeVisible();
  });

  test('sekcja celności wg kategorii jest widoczna', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByText('Celność wg kategorii')).toBeVisible();
    await expect(page.getByText('Historia')).toBeVisible();
    await expect(page.getByText('85%')).toBeVisible();
    await expect(page.getByText('Nauka')).toBeVisible();
    await expect(page.getByText('Sport')).toBeVisible();
  });

  test('heatmapa aktywności się renderuje', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByText('Aktywność (ostatnie 90 dni)')).toBeVisible();
    // Heatmapa z legendą
    await expect(page.getByText('Mniej')).toBeVisible();
    await expect(page.getByText('Więcej')).toBeVisible();
  });

  test('wykres trendu wyników się renderuje', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByText('Trend wyników (ostatnie 10 gier)')).toBeVisible();
    // SVG z wykresem powinien być widoczny
    const svg = page.locator('svg');
    await expect(svg.first()).toBeVisible();
  });

  test('link powrót do profilu jest widoczny', async ({ page }) => {
    await mockAuth(page);
    await mockStatsApi(page);
    await page.goto('/stats');

    await expect(page.getByRole('link', { name: /Profil/ })).toBeVisible();
  });

  test('gdy brak danych kategorii - pokazuje komunikat', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/profile/stats/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_STATS, category_accuracy: [] }),
      });
    });
    await page.goto('/stats');

    await expect(page.getByText('Brak danych kategorii.')).toBeVisible();
  });

  test('gdy za mało gier - trend pokazuje komunikat', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/profile/stats/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_STATS, performance_trend: [{ date: '2026-03-10', score: 100 }] }),
      });
    });
    await page.goto('/stats');

    await expect(page.getByText(/Rozegraj co najmniej 2 gry/)).toBeVisible();
  });

  test('błąd ładowania statystyk pokazuje komunikat błędu', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/profile/stats/', async route => {
      await route.fulfill({ status: 500, body: '{}' });
    });
    await page.goto('/stats');

    await expect(page.getByText('Nie udało się załadować statystyk.')).toBeVisible();
  });
});
