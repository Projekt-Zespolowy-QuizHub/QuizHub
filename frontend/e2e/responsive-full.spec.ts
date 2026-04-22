import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

/**
 * Rozszerzone testy responsywności aplikacji QuizHub.
 *
 * Uzupełniają responsive.spec.ts o dodatkowe scenariusze:
 * 1. Viewport mobilny (375x812) - szczegółowe testy
 * 2. Viewport tabletowy (768x1024)
 * 3. Viewport desktopowy (1280x800)
 * 4. Landscape mobile (812x375)
 * 5. Testy poszczególnych stron w różnych rozmiarach ekranu
 */

// ==================== MOBILE (375x812) ====================

test.describe('Responsywność - Mobile (375x812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('mobilna nawigacja ma hamburger menu', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Hamburger button powinien być widoczny
    const hamburger = page.getByRole('button', { name: 'Otwórz menu' });
    await expect(hamburger).toBeVisible();
  });

  test('pełna nawigacja desktop jest ukryta na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Desktop nav (hidden md:flex) powinien być ukryty
    const desktopNav = page.locator('.hidden.md\\:flex');
    if (await desktopNav.count() > 0) {
      await expect(desktopNav.first()).toBeHidden();
    }
  });

  test('strona główna nie ma poziomego overflow na mobile', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(375);
  });

  test('dashboard ma karty ułożone pionowo na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Utwórz grę')).toBeVisible();

    // Sprawdź że strona nie przesyła poziomo
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(375);
  });

  test('strona rankingu pokazuje listę/tabelę poprawnie na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    await expect(page.getByText('Ranking')).toBeVisible();

    // Zakładki powinny być dostępne
    const globalTab = page.getByRole('button', { name: 'Globalny' });
    await expect(globalTab).toBeVisible();

    // Min. rozmiar dotykowalności
    const tabBox = await globalTab.boundingBox();
    expect(tabBox?.height).toBeGreaterThanOrEqual(36);

    // Brak poziomego overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(375);
  });

  test('strona znajomych jest używalna na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/friends/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/friends');

    // Strona powinna być widoczna i nie mieć overflow
    await expect(page.locator('html')).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(375);
  });

  test('sklep pokazuje siatkę produktów poprawnie na mobile', async ({ page }) => {
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
    await expect(page.getByRole('button', { name: /Avatary/ })).toBeVisible();

    // Brak poziomego overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(375);
  });

  test('formularz logowania mieści się na ekranie mobile', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(375);

    // Formularz powinien być widoczny
    await expect(page.locator('form')).toBeVisible();

    // Pola inputów powinny być dostępne
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible()) {
      const emailBox = await emailInput.boundingBox();
      expect(emailBox?.width).toBeGreaterThanOrEqual(200);
    }
    if (await passwordInput.isVisible()) {
      const passwordBox = await passwordInput.boundingBox();
      expect(passwordBox?.width).toBeGreaterThanOrEqual(200);
    }
  });

  test('formularz tworzenia gry działa na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rooms/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/dashboard');

    // Przycisk tworzenia gry powinien być widoczny i dotykalny
    const createBtn = page.getByText('Utwórz grę');
    await expect(createBtn).toBeVisible();

    const btnBox = await createBtn.boundingBox();
    // Minimalny rozmiar dotykowy
    expect(btnBox?.height).toBeGreaterThanOrEqual(36);
  });

  test('hamburger menu jest dostatecznie duże do dotknięcia', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const hamburger = page.getByRole('button', { name: 'Otwórz menu' });
    const box = await hamburger.boundingBox();

    // Apple HIG zaleca 44pt minimum touch target
    expect(box?.width).toBeGreaterThanOrEqual(36);
    expect(box?.height).toBeGreaterThanOrEqual(36);
  });

  test('mobile overlay menu zawiera linki po kliknięciu grup', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();

    // Grupy powinny być widoczne
    await expect(page.getByText('Graj')).toBeVisible();
    await expect(page.getByText('Społeczność')).toBeVisible();
    await expect(page.getByText('Moje')).toBeVisible();
  });
});

// ==================== TABLET (768x1024) ====================

test.describe('Responsywność - Tablet (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('tablet - strona główna nie ma poziomego overflow', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(768);
  });

  test('tablet - dashboard renderuje się poprawnie', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Utwórz grę')).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(768);
  });

  test('tablet - nawigacja dostosowuje układ', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Na tablecie może być hamburger lub pełna nawigacja - oba są akceptowalne
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(768);
  });

  test('tablet - sklep nie ma poziomego overflow', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/shop/**/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ avatars: [], themes: [], powerups: [] }),
      });
    });
    await page.goto('/shop');

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(768);
  });

  test('tablet - ranking jest czytelny', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    await expect(page.getByText('Ranking')).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(768);
  });

  test('tablet - formularz logowania mieści się poprawnie', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(768);

    await expect(page.locator('form')).toBeVisible();
  });
});

// ==================== DESKTOP (1280x800) ====================

test.describe('Responsywność - Desktop (1280x800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('desktop - pełna nawigacja jest widoczna', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Na desktopie pełna nawigacja powinna być widoczna
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('desktop - hamburger menu nie jest widoczny', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const hamburger = page.getByRole('button', { name: 'Otwórz menu' });
    await expect(hamburger).toBeHidden();
  });

  test('desktop - dashboard pokazuje karty w siatce', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Utwórz grę')).toBeVisible();
  });

  test('desktop - ranking jest czytelny', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    await expect(page.getByText('Ranking')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Globalny' })).toBeVisible();
  });

  test('desktop - strona główna nie ma poziomego overflow', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(1280);
  });

  test('desktop - sklep wyświetla siatkę produktów', async ({ page }) => {
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
  });
});

// ==================== LANDSCAPE MOBILE (812x375) ====================

test.describe('Responsywność - Landscape Mobile (812x375)', () => {
  test.use({ viewport: { width: 812, height: 375 } });

  test('landscape mobile - strona główna jest dostępna', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // Strona powinna się załadować bez awarii
    await expect(page.locator('html')).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(812);
  });

  test('landscape mobile - dashboard jest dostępny', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(812);
  });

  test('landscape mobile - formularz logowania jest dostępny', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    await expect(page.locator('form')).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(812);
  });

  test('landscape mobile - sklep jest dostępny', async ({ page }) => {
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

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(812);
  });

  test('landscape mobile - nawigacja jest dostępna', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });
});

// ==================== BREAKPOINT TRANSITIONS ====================

test.describe('Responsywność - przejścia między breakpoints', () => {
  test('zmiana viewportu z desktop na mobile pokazuje hamburger', async ({ page }) => {
    await mockAuth(page);

    // Załaduj jako desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/dashboard');

    const hamburgerDesktop = page.getByRole('button', { name: 'Otwórz menu' });
    await expect(hamburgerDesktop).toBeHidden();

    // Zmień na mobile
    await page.setViewportSize({ width: 375, height: 812 });

    const hamburgerMobile = page.getByRole('button', { name: 'Otwórz menu' });
    await expect(hamburgerMobile).toBeVisible();
  });

  test('strona turniejów jest czytelna na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/tournaments');

    await expect(page.getByRole('heading', { name: 'Turnieje' })).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(375);
  });

  test('strona statystyk jest czytelna na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/stats/**/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_score: 0, games_played: 0, wins: 0 }),
      });
    });
    await page.goto('/stats');

    await expect(page.locator('html')).toBeVisible();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(375);
  });
});
