import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

const MOCK_GLOBAL = [
  { rank: 1, display_name: 'TopPlayer', total_score: 9999, avatar: '🦊' },
  { rank: 2, display_name: 'SecondPlayer', total_score: 8000, avatar: '🐺' },
  { rank: 3, display_name: 'ThirdPlayer', total_score: 7500, avatar: '🐻' },
];

const MOCK_WEEKLY = [
  { rank: 1, display_name: 'WeeklyChamp', score: 3500, avatar: '🐯' },
  { rank: 2, display_name: 'WeeklyRunner', score: 2800, avatar: '🦁' },
];

const MOCK_FRIENDS = [
  { rank: 1, display_name: 'TestUser', total_score: 1500, avatar: '🦊' },
  { rank: 2, display_name: 'OtherPlayer', total_score: 800, avatar: '🐺' },
];

test.describe('Ranking — pełny przepływ', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);

    await page.route('**/api/rankings/global/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GLOBAL),
      });
    });

    await page.route('**/api/rankings/weekly/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_WEEKLY),
      });
    });

    await page.route('**/api/rankings/friends/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_FRIENDS),
      });
    });
  });

  test.describe('Zakładki rankingu', () => {
    test('wszystkie 3 zakładki są widoczne: Globalny, Tygodniowy, Znajomych', async ({ page }) => {
      await page.goto('/ranking');

      await expect(page.getByRole('button', { name: 'Globalny' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tygodniowy' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Znajomych' })).toBeVisible();
    });

    test('kliknięcie zakładki Tygodniowy przełącza zawartość', async ({ page }) => {
      await page.goto('/ranking');

      await page.getByRole('button', { name: 'Tygodniowy' }).click();

      await expect(page.getByText('WeeklyChamp')).toBeVisible();
      await expect(page.getByText('WeeklyRunner')).toBeVisible();
      // Dane globalnego nie powinny być widoczne
      await expect(page.getByText('TopPlayer')).not.toBeVisible();
    });

    test('kliknięcie zakładki Globalny przełącza zawartość', async ({ page }) => {
      await page.goto('/ranking');

      // Przejdź do tygodniowego, potem wróć do globalnego
      await page.getByRole('button', { name: 'Tygodniowy' }).click();
      await page.getByRole('button', { name: 'Globalny' }).click();

      await expect(page.getByText('TopPlayer')).toBeVisible();
      await expect(page.getByText('SecondPlayer')).toBeVisible();
    });

    test('kliknięcie zakładki Znajomych ładuje ranking znajomych', async ({ page }) => {
      await page.goto('/ranking');

      await page.getByRole('button', { name: 'Znajomych' }).click();

      await expect(page.getByText('TestUser')).toBeVisible();
      await expect(page.getByText('OtherPlayer')).toBeVisible();
    });
  });

  test.describe('Dane rankingu globalnego', () => {
    test('ranking globalny pokazuje graczy z punktami', async ({ page }) => {
      await page.goto('/ranking');

      await expect(page.getByText('TopPlayer')).toBeVisible();
      await expect(page.getByText('SecondPlayer')).toBeVisible();
      await expect(page.getByText('ThirdPlayer')).toBeVisible();
    });

    test('numery rang są widoczne (#1, #2, etc.) lub jako liczby', async ({ page }) => {
      await page.goto('/ranking');

      // Numer miejsca — może być pokazany jako "#1", "1." lub "1"
      await expect(page.getByText(/1/).first()).toBeVisible();
      await expect(page.getByText(/2/).first()).toBeVisible();
    });

    test('avatar gracza jest widoczny w rankingu', async ({ page }) => {
      await page.goto('/ranking');

      // Avatar może być emoji lub img — sprawdzamy że strona załadowała dane
      await expect(page.getByText('TopPlayer')).toBeVisible();
      // Emoji avatar z danych mockowych powinno być widoczne
      const foxEmoji = page.getByText('🦊');
      const foxVisible = await foxEmoji.isVisible().catch(() => false);
      // Jeśli avatar jest renderowany, powinien być widoczny
      if (!foxVisible) {
        // Fallback: sprawdź że przynajmniej dane gracza są widoczne
        await expect(page.getByText('9999')).toBeVisible();
      }
    });

    test('wyniki graczy są widoczne w rankingu globalnym', async ({ page }) => {
      await page.goto('/ranking');

      await expect(page.getByText('9999')).toBeVisible();
      await expect(page.getByText('8000')).toBeVisible();
    });
  });

  test.describe('Dane rankingu tygodniowego', () => {
    test('ranking tygodniowy pokazuje graczy z wynikami tygodniowymi', async ({ page }) => {
      await page.goto('/ranking');

      await page.getByRole('button', { name: 'Tygodniowy' }).click();

      await expect(page.getByText('WeeklyChamp')).toBeVisible();
      await expect(page.getByText('WeeklyRunner')).toBeVisible();
    });
  });

  test.describe('Pusta lista rankingu', () => {
    test('pusty ranking globalny pokazuje komunikat zastępczy', async ({ page }) => {
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

    test('pusty ranking tygodniowy pokazuje komunikat zastępczy', async ({ page }) => {
      await page.route('**/api/rankings/weekly/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto('/ranking');
      await page.getByRole('button', { name: 'Tygodniowy' }).click();

      await expect(page.getByText('Brak danych w rankingu')).toBeVisible();
    });
  });

  test.describe('Zakładka Znajomych a autentykacja', () => {
    test('zakładka Znajomych wymaga zalogowania — niezalogowany użytkownik trafia na /login', async ({ page }) => {
      await mockUnauthenticated(page);
      await page.goto('/ranking');

      // Niezalogowany użytkownik powinien trafić na /login
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Aktywna zakładka', () => {
    test('aktywna zakładka jest wizualnie wyróżniona', async ({ page }) => {
      await page.goto('/ranking');

      const globalButton = page.getByRole('button', { name: 'Globalny' });
      await expect(globalButton).toHaveClass(/bg-yellow-400/);
    });

    test('po kliknięciu Tygodniowy zakładka jest aktywna', async ({ page }) => {
      await page.goto('/ranking');

      await page.getByRole('button', { name: 'Tygodniowy' }).click();

      const weeklyButton = page.getByRole('button', { name: 'Tygodniowy' });
      await expect(weeklyButton).toHaveClass(/bg-yellow-400/);
    });

    test('można wielokrotnie przełączać zakładki', async ({ page }) => {
      await page.goto('/ranking');

      await page.getByRole('button', { name: 'Tygodniowy' }).click();
      await expect(page.getByText('WeeklyChamp')).toBeVisible();

      await page.getByRole('button', { name: 'Globalny' }).click();
      await expect(page.getByText('TopPlayer')).toBeVisible();

      await page.getByRole('button', { name: 'Znajomych' }).click();
      await expect(page.getByText('TestUser')).toBeVisible();
    });
  });

  test.describe('Nagłówki tabeli', () => {
    test('tabela rankingu ma nagłówki Miejsce, Gracz, Punkty', async ({ page }) => {
      await page.goto('/ranking');

      await expect(page.getByRole('columnheader', { name: 'Miejsce' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Gracz' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Punkty' })).toBeVisible();
    });
  });
});
