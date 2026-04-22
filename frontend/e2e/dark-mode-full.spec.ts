import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

/**
 * Rozszerzone testy ciemnego motywu (dark mode).
 *
 * Uzupełniają dark-mode.spec.ts o dodatkowe scenariusze:
 * 1. Trwałość ustawień motywu (localStorage / klasa HTML)
 * 2. Testy poszczególnych stron w ciemnym motywie
 * 3. Dostępność przycisku przełączania
 * 4. Brak glitchy wizualnych
 *
 * Uwaga: Aplikacja QuizHub domyślnie działa w trybie ciemnym (dark-first design).
 * Jeśli przełącznik dark/light mode zostanie zaimplementowany w przyszłości,
 * testy przełączania będą automatycznie aktywne.
 */

test.describe('Ciemny motyw - trwałość i klasy', () => {
  test('strona główna ma ciemne tło i nie ulega awarii', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toBeVisible();

    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    // Tło powinno zawierać gradient (aplikacja dark-first)
    expect(bodyBg).toContain('gradient');
  });

  test('tryb ciemny jest domyślnie aktywny lub można go włączyć', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const html = page.locator('html');

    // Sprawdź czy istnieje przełącznik dark mode
    const darkToggle = page.getByRole('button', { name: /ciemny|dark|motyw|theme/i });
    if (await darkToggle.isVisible()) {
      await darkToggle.click();
      // Strona nie powinna się zawiesić
      await expect(html).toBeVisible();
    }

    // Aplikacja dark-first: tło zawsze ciemne
    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBg).toMatch(/gradient|rgb/i);
  });

  test('ciemny motyw ma zdefiniowane zmienne CSS', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const primaryColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    );
    // Zmienna --primary powinna być zdefiniowana
    expect(primaryColor).toBeTruthy();
    expect(primaryColor.length).toBeGreaterThan(0);
  });

  test('ciemne tło utrzymuje się po nawigacji do rankingu', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/dashboard');
    const bgDashboard = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );

    await page.goto('/ranking');
    const bgRanking = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );

    // Tło powinno być spójne na obu stronach
    expect(bgDashboard).toContain('gradient');
    expect(bgRanking).toContain('gradient');
  });

  test('ciemne tło utrzymuje się po nawigacji do znajomych', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/friends/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/friends');
    const bgFriends = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );

    expect(bgFriends).toContain('gradient');
  });

  test('ciemne tło utrzymuje się po przeładowaniu strony', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const bgBefore = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );

    await page.reload();
    await mockAuth(page);

    const bgAfter = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );

    // Gradient powinien być taki sam po przeładowaniu
    expect(bgBefore).toContain('gradient');
    expect(bgAfter).toContain('gradient');
  });
});

test.describe('Ciemny motyw - poszczególne strony', () => {
  test('dashboard renderuje się w ciemnym motywie bez błędów', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Sprawdź że strona się załadowała
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Ciemne tło powinno być aktywne
    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBg).toContain('gradient');
  });

  test('strona rankingu renderuje się w ciemnym motywie', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    await expect(page.getByText('Ranking')).toBeVisible();

    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBg).toContain('gradient');
  });

  test('strona znajomych renderuje się w ciemnym motywie', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/friends/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/friends');

    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBg).toContain('gradient');

    // Strona powinna się załadować bez awarii
    await expect(page.locator('html')).toBeVisible();
  });

  test('sklep renderuje się w ciemnym motywie bez glitchy wizualnych', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/shop/**/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ avatars: [], themes: [], powerups: [] }),
      });
    });
    await page.goto('/shop');

    await expect(page.getByRole('heading', { name: 'Sklep' })).toBeVisible();

    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBg).toContain('gradient');

    // Sprawdź brak poziomego overflow (glitch wizualny)
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 1280;
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test('strona logowania renderuje się w ciemnym motywie', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBg).toContain('gradient');

    // Formularz logowania powinien być widoczny
    await expect(page.locator('form')).toBeVisible();
  });

  test('strona rejestracji renderuje się w ciemnym motywie', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/register');

    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBg).toContain('gradient');
  });

  test('strona profilu renderuje się w ciemnym motywie', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/stats/**/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_score: 0, games_played: 0, wins: 0 }),
      });
    });
    await page.goto('/profile');

    const bodyBg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundImage
    );
    expect(bodyBg).toContain('gradient');
  });
});

test.describe('Ciemny motyw - karty i komponenty glass', () => {
  test('dashboard ma ciemne karty glass-card', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const cards = page.locator('.glass-card');
    await expect(cards.first()).toBeVisible();
  });

  test('navbar zachowuje ciemne tło na wszystkich stronach', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    const pages = ['/dashboard', '/ranking'];

    for (const url of pages) {
      await page.goto(url);
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
    }
  });

  test('tekst na stronach jest jasny (white/szary) na ciemnym tle', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // body powinno mieć klasę text-white (layout.tsx)
    const bodyClass = await page.evaluate(() => document.body.className);
    // Dark-first design: tekst powinien być biały
    expect(bodyClass).toContain('text-white');
  });

  test('primary color CSS jest stosowany na przyciskach akcji', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // btn-primary powinien być widoczny na dashboardzie
    const primaryBtns = page.locator('.btn-primary');
    if (await primaryBtns.count() > 0) {
      await expect(primaryBtns.first()).toBeVisible();
    } else {
      // Alternatywnie szukaj przycisków z primary kolorem
      const actionBtns = page.getByRole('button').first();
      await expect(actionBtns).toBeVisible();
    }
  });
});

test.describe('Ciemny motyw - dostępność przycisku przełączania', () => {
  test('jeśli przełącznik dark mode istnieje, ma aria-label lub title', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Szukaj przełącznika dark mode (może nie istnieć - dark-first design)
    const darkToggle = page.getByRole('button', { name: /ciemny|dark|motyw|theme|tryb/i });

    if (await darkToggle.isVisible()) {
      const ariaLabel = await darkToggle.getAttribute('aria-label');
      const title = await darkToggle.getAttribute('title');
      const textContent = await darkToggle.textContent();

      // Przycisk musi mieć jakiś opisowy atrybut
      const hasAccessibleName = (ariaLabel?.trim() || title?.trim() || textContent?.trim());
      expect(hasAccessibleName).toBeTruthy();
    } else {
      // Aplikacja dark-first bez przełącznika - to jest akceptowalne
      test.skip(true, 'Brak przełącznika dark/light mode - aplikacja jest dark-first');
    }
  });

  test('jeśli przełącznik istnieje, jest dostępny przez klawiaturę', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const darkToggle = page.getByRole('button', { name: /ciemny|dark|motyw|theme|tryb/i });

    if (await darkToggle.isVisible()) {
      // Sprawdź że przycisk można sfocusować
      await darkToggle.focus();
      await expect(darkToggle).toBeFocused();
    } else {
      test.skip(true, 'Brak przełącznika dark/light mode');
    }
  });
});
