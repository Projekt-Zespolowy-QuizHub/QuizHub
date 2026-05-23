import { test, expect } from '@playwright/test';
import { mockAuth } from './helpers';

test.describe('Znajomi', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
  });

  test('strona znajomych laduje sie poprawnie', async ({ page }) => {
    await page.goto('/friends');

    await expect(page.getByText('Znajomi')).toBeVisible();
    await expect(page.getByPlaceholder(/Wyszukaj/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Szukaj' })).toBeVisible();
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
    await expect(page.getByText(/Brak zaprosze/)).toBeVisible();
  });

  test('wyszukiwanie uzytkownikow zwraca wyniki', async ({ page }) => {
    await page.route('**/api/friends/search/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 5, display_name: 'GraczAlfa' },
          { id: 6, display_name: 'GraczBeta' },
        ]),
      });
    });

    await page.goto('/friends');

    await page.getByPlaceholder(/Wyszukaj/).fill('Gracz');
    await page.getByRole('button', { name: 'Szukaj' }).click();

    await expect(page.getByText('GraczAlfa')).toBeVisible();
    await expect(page.getByText('GraczBeta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dodaj' }).first()).toBeVisible();
  });

  test('wyszukiwanie przez Enter uruchamia wyszukiwanie', async ({ page }) => {
    await page.route('**/api/friends/search/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 5, display_name: 'GraczAlfa' }]),
      });
    });

    await page.goto('/friends');

    const input = page.getByPlaceholder(/Wyszukaj/);
    await input.fill('Gracz');
    await input.press('Enter');

    await expect(page.getByText('GraczAlfa')).toBeVisible();
  });

  test('wyslanie zaproszenia usuwa uzytkownika z wynikow', async ({ page }) => {
    await page.route('**/api/friends/search/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 5, display_name: 'GraczAlfa' },
          { id: 6, display_name: 'GraczBeta' },
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

  test('zaakceptowanie zaproszenia aktualizuje liste znajomych', async ({ page }) => {
    let requestAccepted = false;

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
            : [{ id: 55, from_display_name: 'NowyZnajomy' }]
        ),
      });
    });

    await page.route('**/api/friends/respond/', async route => {
      requestAccepted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Friend request accepted' }),
      });
    });

    await page.goto('/friends');

    await expect(page.getByText(/Zaproszenia\s*\(1\)/)).toBeVisible();
    await page.getByRole('button', { name: /Akceptuj/i }).click();
    await expect(page.getByText(/Zaproszenia\s*\(0\)/)).toBeVisible();
    await expect(page.getByText(/Brak zaprosze/)).toBeVisible();
    await expect(page.getByText('Lista znajomych')).toBeVisible();
    await expect(page.getByText('NowyZnajomy')).toBeVisible();
  });

  test('wyszukiwanie zbyt krotkiej frazy nie uruchamia zapytania', async ({ page }) => {
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

  test('lista znajomych z danymi pokazuje punkty', async ({ page }) => {
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
});
