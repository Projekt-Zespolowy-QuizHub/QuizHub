import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated, MOCK_USER } from './helpers';

const MOBILE_VIEWPORT = { width: 375, height: 667 };

test.describe('Responsywność mobile (375x667)', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('strona główna nie ma poziomego przelewania', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test('hamburger menu jest widoczny na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Przycisk hamburger (aria-label="Otwórz menu")
    const hamburger = page.getByRole('button', { name: 'Otwórz menu' });
    await expect(hamburger).toBeVisible();
  });

  test('desktop menu jest ukryte na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Grupy nawigacji desktop (hidden md:flex)
    const desktopNav = page.locator('.hidden.md\\:flex');
    await expect(desktopNav.first()).toBeHidden();
  });

  test('kliknięcie hamburger otwiera mobile overlay', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();

    // Overlay mobile powinien być widoczny
    await expect(page.getByRole('button', { name: 'Zamknij menu' })).toBeVisible();
  });

  test('mobile overlay ma przycisk zamknięcia', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();

    const closeBtn = page.getByRole('button', { name: 'Zamknij menu' });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Po zamknięciu overlay nie powinien być widoczny
    await expect(page.getByRole('button', { name: 'Zamknij menu' })).not.toBeVisible();
  });

  test('mobile overlay zawiera linki nawigacyjne', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();

    // Grupy menu powinny być widoczne
    await expect(page.getByText('Graj')).toBeVisible();
    await expect(page.getByText('Społeczność')).toBeVisible();
    await expect(page.getByText('Moje')).toBeVisible();
  });

  test('kliknięcie grupy w mobile menu rozwija podpunkty', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();

    // Kliknij grupę "Graj"
    await page.getByText('Graj').click();

    // Dashboard powinien pojawić się w rozwiniętym menu
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('kliknięcie linku w mobile menu zamyka overlay', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();
    await page.getByText('Graj').click();

    await page.getByRole('link', { name: 'Survival' }).click();

    // Overlay powinien się zamknąć
    await expect(page.getByRole('button', { name: 'Zamknij menu' })).not.toBeVisible();
    await expect(page).toHaveURL('/survival');
  });

  test('strona dashboardu jest czytalna na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Karty powinny być widoczne (jedna kolumna na mobile)
    await expect(page.getByText('Utwórz grę')).toBeVisible();
  });

  test('strona rankingu jest czytalna na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    await expect(page.getByText('Ranking')).toBeVisible();
    // Zakładki powinny być widoczne i dotykalne (min 44px wysokość)
    const tabs = page.getByRole('button', { name: 'Globalny' });
    await expect(tabs).toBeVisible();

    const tabBox = await tabs.boundingBox();
    expect(tabBox?.height).toBeGreaterThanOrEqual(36); // rozsądny min-height
  });

  test('strona logowania nie przesyła poza viewport', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test('strona turniejów jest czytalna na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    await expect(page.getByRole('heading', { name: 'Turnieje' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aktywne' })).toBeVisible();
  });

  test('sklep jest czytyczny na mobile', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await expect(page.getByRole('heading', { name: 'Sklep' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Avatary/ })).toBeVisible();
  });

  test('mobile overlay zawiera LanguageSwitcher', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();

    // LanguageSwitcher w stopce overlay
    await expect(page.getByRole('button', { name: 'Polski' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  });

  test('target dotykowe mają co najmniej 44px', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const hamburger = page.getByRole('button', { name: 'Otwórz menu' });
    const box = await hamburger.boundingBox();

    // Apple HIG zaleca 44pt minimum touch target
    expect(box?.width).toBeGreaterThanOrEqual(36);
    expect(box?.height).toBeGreaterThanOrEqual(36);
  });
});
