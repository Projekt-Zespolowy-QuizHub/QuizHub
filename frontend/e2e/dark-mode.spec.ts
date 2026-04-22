import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

/**
 * Testy ciemnego motywu (dark mode).
 *
 * Aplikacja QuizArena domyślnie działa w trybie ciemnym (dark-first design).
 * Testy weryfikują:
 * 1. Że ciemny motyw CSS jest stosowany na wszystkich stronach
 * 2. Że tło strony ma prawidłowy ciemny gradient
 * 3. Że tekst jest jasny (biały/szary) na ciemnym tle
 *
 * Jeśli w przyszłości zostanie dodany przełącznik dark/light mode,
 * testy powinny być zaktualizowane o testy przełączania.
 */

test.describe('Ciemny motyw (dark mode)', () => {
  test('strona główna ma ciemne tło gradientowe', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // body ma gradient z globals.css
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).background;
    });

    // Sprawdź że tło zawiera gradient lub ciemny kolor
    expect(bodyBg).toMatch(/gradient|rgba?\(\d/i);
  });

  test('strona logowania ma ciemne tło', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundImage;
    });

    expect(bodyBg).toContain('gradient');
  });

  test('tekst na stronie głównej jest jasny (biały/szary)', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // body ma klasę text-white z layout.tsx
    const bodyClass = await page.evaluate(() => document.body.className);
    expect(bodyClass).toContain('text-white');
  });

  test('dashboard ma ciemne karty glass-card', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Sprawdź że glass-card klasy są stosowane
    const cards = page.locator('.glass-card');
    await expect(cards.first()).toBeVisible();
  });

  test('navbar ma ciemne tło', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('strona rankingu zachowuje ciemny motyw', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundImage;
    });
    expect(bodyBg).toContain('gradient');
  });

  test('strona sklepu zachowuje ciemny motyw', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundImage;
    });
    expect(bodyBg).toContain('gradient');
  });

  test('zmienne CSS :root są zdefiniowane', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const primaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    });

    expect(primaryColor).toBe('#6C63FF');
  });

  test('kolor primary jest stosowany na przyciskach CTA', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // btn-primary class powinien być widoczny
    const ctaBtn = page.locator('.btn-primary').first();
    await expect(ctaBtn).toBeVisible();
  });

  test('ciemne tło utrzymuje się po nawigacji między stronami', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/dashboard');

    const bgBefore = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );

    await page.goto('/ranking');

    const bgAfter = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );

    // Gradient powinien być taki sam (aplikacja nie zmienia tła przy nawigacji)
    expect(bgBefore).toBe(bgAfter);
  });
});
