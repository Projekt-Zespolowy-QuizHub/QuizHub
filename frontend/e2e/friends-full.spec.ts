import { test, expect } from '@playwright/test';
import { mockAuth } from './helpers';

test.describe('Znajomi - pelny przeplyw', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test.describe('Sekcja oczekujacych zaproszen', () => {
    test('sekcja oczekujacych zaproszen jest widoczna na stronie', async ({ page }) => {
      await page.route('**/api/friends/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });
      await page.route('**/api/friends/pending/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto('/friends');

      await expect(page.getByText('Zaproszenia')).toBeVisible();
      await expect(page.getByText(/Brak zaprosze/)).toBeVisible();
    });

    test('przyjecie zaproszenia pobiera pending klientowo i odswieza stan po akceptacji', async ({ page }) => {
      let requestAccepted = false;
      let respondCalled = false;

      await page.route('**/api/friends/respond/', async route => {
        respondCalled = true;
        requestAccepted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Friend request accepted' }),
        });
      });

      await page.route('**/api/friends/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            requestAccepted
              ? [{ id: 3, display_name: 'NowyZnajomy', total_score: 500 }]
              : []
          ),
        });
      });

      await page.route('**/api/friends/pending/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            requestAccepted
              ? []
              : [{ id: 91, from_display_name: 'NowyZnajomy' }]
          ),
        });
      });

      await page.goto('/friends');

      await expect(page.getByText(/Zaproszenia\s*\(1\)/)).toBeVisible();
      await expect(page.getByText('NowyZnajomy')).toBeVisible();

      await page.getByRole('button', { name: /Akceptuj/i }).click();

      expect(respondCalled).toBe(true);
      await expect(page.getByText(/Zaproszenia\s*\(0\)/)).toBeVisible();
      await expect(page.getByText(/Brak zaprosze/)).toBeVisible();
      await expect(page.getByText('Lista znajomych')).toBeVisible();
      await expect(page.getByText('NowyZnajomy')).toBeVisible();
    });

    test('odrzucenie zaproszenia wywoluje endpoint respond z action=reject', async ({ page }) => {
      let respondBody: string | null = null;

      await page.route('**/api/friends/respond/', async route => {
        respondBody = route.request().postData();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Friend request rejected' }),
        });
      });

      await page.route('**/api/friends/pending/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 92, from_display_name: 'DoOdrzucenia' }]),
        });
      });

      await page.goto('/friends');
      await expect(page.getByText('DoOdrzucenia')).toBeVisible();

      await page.getByRole('button', { name: /Odrzu/i }).click();

      expect(respondBody).toContain('reject');
    });

    test('pusta sekcja oczekujacych zaproszen nie pokazuje mylacego UI', async ({ page }) => {
      await page.route('**/api/friends/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });
      await page.route('**/api/friends/pending/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto('/friends');

      await expect(page.getByText('Znajomi')).toBeVisible();
      await expect(page.getByText(/Zaproszenia\s*\(0\)/)).toBeVisible();
      await expect(page.getByText(/Brak zaprosze/)).toBeVisible();
      await expect(page.getByRole('button', { name: /Akceptuj/i })).toHaveCount(0);
    });
  });

  test.describe('Wyszukiwanie uzytkownikow', () => {
    test('wynik wyszukiwania pokazuje badge "Dodaj" dla nowego uzytkownika', async ({ page }) => {
      await page.route('**/api/friends/search/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 10, display_name: 'NowyGracz', is_friend: false },
          ]),
        });
      });

      await page.goto('/friends');
      await page.getByPlaceholder(/Wyszukaj/).fill('Nowy');
      await page.getByRole('button', { name: 'Szukaj' }).click();

      await expect(page.getByText('NowyGracz')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Dodaj' })).toBeVisible();
    });

    test('wynik wyszukiwania pokazuje badge "Znajomy" dla istniejacego znajomego', async ({ page }) => {
      await page.route('**/api/friends/search/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 2, display_name: 'IstniejacyZnajomy', is_friend: true },
          ]),
        });
      });

      await page.goto('/friends');
      await page.getByPlaceholder(/Wyszukaj/).fill('Istniejacy');
      await page.getByRole('button', { name: 'Szukaj' }).click();

      await expect(page.getByText('IstniejacyZnajomy')).toBeVisible();
      await expect(page.getByText('Znajomy', { exact: true })).toBeVisible();
    });

    test('wyszukiwanie z 1 znakiem nie uruchamia zapytania API', async ({ page }) => {
      let searchCalled = false;

      await page.route('**/api/friends/search/**', async route => {
        searchCalled = true;
        await route.continue();
      });

      await page.goto('/friends');
      await page.getByPlaceholder(/Wyszukaj/).fill('A');
      await page.getByRole('button', { name: 'Szukaj' }).click();

      await page.waitForTimeout(300);
      expect(searchCalled).toBe(false);
    });

    test('wyszukiwanie zwraca wiele wynikow naraz', async ({ page }) => {
      await page.route('**/api/friends/search/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 5, display_name: 'GraczAlfa', is_friend: false },
            { id: 6, display_name: 'GraczBeta', is_friend: false },
            { id: 7, display_name: 'GraczGamma', is_friend: true },
          ]),
        });
      });

      await page.goto('/friends');
      await page.getByPlaceholder(/Wyszukaj/).fill('Gracz');
      await page.getByRole('button', { name: 'Szukaj' }).click();

      await expect(page.getByText('GraczAlfa')).toBeVisible();
      await expect(page.getByText('GraczBeta')).toBeVisible();
      await expect(page.getByText('GraczGamma')).toBeVisible();
    });
  });

  test.describe('Lista znajomych', () => {
    test('lista znajomych pokazuje total_score', async ({ page }) => {
      await page.route('**/api/friends/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 2, display_name: 'GraczAlfa', total_score: 2500 },
          ]),
        });
      });
      await page.route('**/api/friends/pending/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto('/friends');

      await expect(page.getByText('Lista znajomych')).toBeVisible();
      await expect(page.getByText('2500 pkt')).toBeVisible();
    });

    test('pusta lista znajomych wyswietla informacje', async ({ page }) => {
      await page.route('**/api/friends/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });
      await page.route('**/api/friends/pending/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.goto('/friends');

      await expect(page.getByText('Lista znajomych')).toBeVisible();
      await expect(page.getByText(/Brak znajomych/)).toBeVisible();
    });
  });

  test.describe('Wysylanie zaproszen', () => {
    test('klikniecie "Dodaj" wysyla zaproszenie i usuwa gracza z wynikow', async ({ page }) => {
      await page.route('**/api/friends/search/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 5, display_name: 'GraczAlfa', is_friend: false },
            { id: 6, display_name: 'GraczBeta', is_friend: false },
          ]),
        });
      });

      await page.route('**/api/friends/request/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Friend request sent' }),
        });
      });

      await page.goto('/friends');
      await page.getByPlaceholder(/Wyszukaj/).fill('Gracz');
      await page.getByRole('button', { name: 'Szukaj' }).click();

      await expect(page.getByText('GraczAlfa')).toBeVisible();
      await page.getByRole('button', { name: 'Dodaj' }).first().click();

      await expect(page.getByText('GraczAlfa')).not.toBeVisible();
      await expect(page.getByText('GraczBeta')).toBeVisible();
    });
  });

  test.describe('Nawigacja i wyszukiwanie przez klawiature', () => {
    test('wyszukiwanie przez Enter uruchamia zapytanie', async ({ page }) => {
      await page.route('**/api/friends/search/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 5, display_name: 'GraczAlfa', is_friend: false }]),
        });
      });

      await page.goto('/friends');
      const input = page.getByPlaceholder(/Wyszukaj/);
      await input.fill('Gracz');
      await input.press('Enter');

      await expect(page.getByText('GraczAlfa')).toBeVisible();
    });
  });
});
