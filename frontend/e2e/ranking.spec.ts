import { test, expect } from '@playwright/test';
import { mockAuth } from './helpers';

const MOCK_GLOBAL_RANKING = [
  { rank: 1, display_name: 'MistrzQuizu', total_score: 15000 },
  { rank: 2, display_name: 'GraczAlfa', total_score: 12500 },
  { rank: 3, display_name: 'QuizKing', total_score: 9800 },
];

const MOCK_WEEKLY_RANKING = [
  { rank: 1, display_name: 'TygodniowySprint', score: 3200 },
  { rank: 2, display_name: 'GraczBeta', score: 2800 },
];

const MOCK_FRIENDS_RANKING = [
  { rank: 1, display_name: 'TestUser', total_score: 1500 },
  { rank: 2, display_name: 'OtherPlayer', total_score: 800 },
];

test.describe('Strona rankingu', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);

    // Domyślnie mockuj wszystkie trzy endpointy rankingu
    await page.route('**/api/rankings/global/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GLOBAL_RANKING),
      });
    });

    await page.route('**/api/rankings/weekly/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_WEEKLY_RANKING),
      });
    });

    await page.route('**/api/rankings/friends/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_FRIENDS_RANKING),
      });
    });
  });

  test('strona rankingu ładuje się z tytułem', async ({ page }) => {
    await page.goto('/ranking');

    await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible();
  });

  test('zakładki Globalny / Tygodniowy / Znajomych są widoczne', async ({ page }) => {
    await page.goto('/ranking');

    await expect(page.getByRole('button', { name: 'Globalny' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tygodniowy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Znajomych' })).toBeVisible();
  });

  test('domyślnie pokazuje ranking globalny', async ({ page }) => {
    await page.goto('/ranking');

    await expect(page.getByText('MistrzQuizu')).toBeVisible();
    await expect(page.getByText('GraczAlfa')).toBeVisible();
    await expect(page.getByText('QuizKing')).toBeVisible();
  });

  test('tabela ma nagłówki Miejsce, Gracz, Punkty', async ({ page }) => {
    await page.goto('/ranking');

    await expect(page.getByRole('columnheader', { name: 'Miejsce' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Gracz' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Punkty' })).toBeVisible();
  });

  test('kliknięcie zakładki Tygodniowy ładuje ranking tygodniowy', async ({ page }) => {
    await page.goto('/ranking');

    await page.getByRole('button', { name: 'Tygodniowy' }).click();

    await expect(page.getByText('TygodniowySprint')).toBeVisible();
    await expect(page.getByText('GraczBeta')).toBeVisible();
    // Dane globalne nie powinny być widoczne
    await expect(page.getByText('MistrzQuizu')).not.toBeVisible();
  });

  test('kliknięcie zakładki Znajomych ładuje ranking znajomych', async ({ page }) => {
    await page.goto('/ranking');

    await page.getByRole('button', { name: 'Znajomych' }).click();

    await expect(page.getByText('TestUser')).toBeVisible();
    await expect(page.getByText('OtherPlayer')).toBeVisible();
  });

  test('można przełączać między zakładkami wielokrotnie', async ({ page }) => {
    await page.goto('/ranking');

    // Globalny → Tygodniowy → Globalny
    await page.getByRole('button', { name: 'Tygodniowy' }).click();
    await expect(page.getByText('TygodniowySprint')).toBeVisible();

    await page.getByRole('button', { name: 'Globalny' }).click();
    await expect(page.getByText('MistrzQuizu')).toBeVisible();
  });

  test('pusta lista rankingu wyświetla komunikat', async ({ page }) => {
    // Nadpisz globalny ranking pustą listą
    await page.route('**/api/rankings/global/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/ranking');

    await expect(page.getByText('Brak danych w rankingu')).toBeVisible();
  });

  test('aktywna zakładka jest wizualnie wyróżniona', async ({ page }) => {
    await page.goto('/ranking');

    // Domyślnie aktywny jest "Globalny" — sprawdź że ma żółte tło
    const globalButton = page.getByRole('button', { name: 'Globalny' });
    await expect(globalButton).toHaveClass(/bg-yellow-400/);

    // Po kliknięciu Tygodniowy — on powinien być aktywny
    await page.getByRole('button', { name: 'Tygodniowy' }).click();
    const weeklyButton = page.getByRole('button', { name: 'Tygodniowy' });
    await expect(weeklyButton).toHaveClass(/bg-yellow-400/);
  });

  test('ranking tygodniowy ładuje się poprawnie po bezpośredniej nawigacji', async ({ page }) => {
    await page.goto('/ranking');

    await page.getByRole('button', { name: 'Tygodniowy' }).click();

    // Numery miejsc widoczne
    await expect(page.getByText('1')).toBeVisible();
    await expect(page.getByText('2')).toBeVisible();
    await expect(page.getByText('TygodniowySprint')).toBeVisible();
  });
});
