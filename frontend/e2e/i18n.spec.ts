import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

test.describe('Internacjonalizacja (i18n)', () => {
  test.beforeEach(async ({ page }) => {
    // Wyczyść locale z localStorage przed każdym testem
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('locale'));
  });

  test('domyślny język to polski', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await expect(page.getByText('Quiz Multiplayer')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Zagraj teraz' })).toBeVisible();
  });

  test('przełącznik języka PL/EN jest widoczny', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Polski' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  });

  test('przełączenie na angielski zmienia teksty', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // Przed przełączeniem - polski
    await expect(page.getByText('Zagraj teraz')).toBeVisible();

    // Przełącz na angielski
    await page.getByRole('button', { name: 'English' }).click();

    // Po przełączeniu - angielski
    await expect(page.getByText('Play now')).toBeVisible();
    await expect(page.getByText('Zagraj teraz')).not.toBeVisible();
  });

  test('przełączenie na angielski zmienia tekst "Dowiedz sie wiecej"', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'English' }).click();

    await expect(page.getByText('Learn more')).toBeVisible();
  });

  test('preferencja języka jest zapisywana w localStorage', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'English' }).click();

    const savedLocale = await page.evaluate(() => localStorage.getItem('locale'));
    expect(savedLocale).toBe('en');
  });

  test('preferencja języka utrzymuje się po odświeżeniu', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('Play now')).toBeVisible();

    // Odśwież stronę
    await page.reload();
    await mockUnauthenticated(page);

    // Angielski powinien się utrzymać
    await expect(page.getByText('Play now')).toBeVisible();
  });

  test('przełączenie z EN na PL przywraca polski', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // Przełącz na EN
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('Play now')).toBeVisible();

    // Przełącz z powrotem na PL
    await page.getByRole('button', { name: 'Polski' }).click();
    await expect(page.getByText('Zagraj teraz')).toBeVisible();
  });

  test('angielska wersja nawigacji ma prawidłowe tłumaczenia', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Przełącz na EN
    await page.getByRole('button', { name: 'English' }).click();

    // Dashboard po angielsku
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('strona rankingu zmienia nagłówki zakładek na angielski', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    await page.getByRole('button', { name: 'English' }).click();

    await expect(page.getByRole('button', { name: 'Global' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weekly' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Friends' })).toBeVisible();
  });

  test('strona survival zmienia tytuł i opis po przełączeniu', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    // PL
    await expect(page.getByRole('heading', { name: 'Tryb Przetrwania' })).toBeVisible();

    await page.getByRole('button', { name: 'English' }).click();

    // EN
    await expect(page.getByRole('heading', { name: 'Survival Mode' })).toBeVisible();
  });

  test('strona paczek zmienia tytuł po przełączeniu na EN', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/packs/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/packs');

    await page.getByRole('button', { name: 'English' }).click();

    await expect(page.getByRole('heading', { name: 'Question packs' })).toBeVisible();
  });

  test('aktywny przycisk języka ma żółty kolor', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // PL jest aktywne - ma text-yellow-400
    const plButton = page.getByRole('button', { name: 'Polski' });
    const plClass = await plButton.getAttribute('class');
    expect(plClass).toContain('yellow');

    // Przełącz na EN
    await page.getByRole('button', { name: 'English' }).click();

    // EN jest teraz aktywne
    const enButton = page.getByRole('button', { name: 'English' });
    const enClass = await enButton.getAttribute('class');
    expect(enClass).toContain('yellow');
  });

  test('preferencja EN zapisuje się i ładuje przy wejściu na inną stronę', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // Ustaw EN przez localStorage
    await page.evaluate(() => localStorage.setItem('locale', 'en'));

    // Przejdź na stronę logowania
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });
});
