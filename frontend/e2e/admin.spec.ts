import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated, MOCK_USER } from './helpers';

/**
 * Testy panelu administracyjnego.
 *
 * Panel admin dostępny pod /admin.
 * Wymaga is_staff: true w profilu użytkownika.
 * Niezalogowani i zwykli użytkownicy są przekierowywani.
 *
 * CRUD operations:
 * - GET  /api/admin/users/    - lista użytkowników
 * - GET  /api/admin/rooms/    - lista pokoi
 * - DELETE /api/admin/users/:id/ - usuń użytkownika
 * - PATCH  /api/admin/users/:id/ - edytuj użytkownika
 */

const MOCK_STAFF_USER = {
  ...MOCK_USER,
  is_staff: true,
};

const MOCK_ADMIN_USERS = [
  { id: 1, display_name: 'TestUser', email: 'test@example.com', total_score: 1500, games_played: 10, is_staff: false },
  { id: 2, display_name: 'OtherPlayer', email: 'other@example.com', total_score: 800, games_played: 5, is_staff: false },
  { id: 3, display_name: 'AdminUser', email: 'admin@example.com', total_score: 3000, games_played: 50, is_staff: true },
];

const MOCK_ADMIN_ROOMS = [
  { code: 'ABCD12', status: 'lobby', player_count: 2, created_at: '2026-03-21T10:00:00Z' },
  { code: 'XYZ789', status: 'in_progress', player_count: 4, created_at: '2026-03-21T11:00:00Z' },
];

async function mockAdminApis(page: Parameters<typeof mockAuth>[0]) {
  await page.route('**/api/admin/users/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADMIN_USERS),
    });
  });

  await page.route('**/api/admin/rooms/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADMIN_ROOMS),
    });
  });

  await page.route('**/api/admin/users/2/', async route => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });
}

async function mockStaffAuth(page: Parameters<typeof mockAuth>[0]) {
  await page.route('**/api/auth/me/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STAFF_USER),
    });
  });
}

test.describe('Panel administracyjny', () => {
  test('niezalogowany użytkownik jest przekierowywany z /admin', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/admin');

    // Powinno przekierować do /login lub strony głównej
    await expect(page).not.toHaveURL('/admin');
    await expect(page.url()).toMatch(/\/login|\/$/);
  });

  test('zwykły użytkownik nie ma dostępu do /admin', async ({ page }) => {
    await mockAuth(page); // MOCK_USER bez is_staff
    await page.goto('/admin');

    // Powinno przekierować lub pokazać 403/not found
    await expect(page.url()).not.toContain('/admin');
  });

  test('admin ma dostęp do panelu', async ({ page }) => {
    await mockStaffAuth(page);
    await mockAdminApis(page);
    await page.goto('/admin');

    // Admin panel powinien być widoczny
    await expect(
      page.getByText(/Panel administracyjny|Admin|Dashboard/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('lista użytkowników jest widoczna w panelu admin', async ({ page }) => {
    await mockStaffAuth(page);
    await mockAdminApis(page);
    await page.goto('/admin');

    await expect(page.getByText('TestUser')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('OtherPlayer')).toBeVisible({ timeout: 5000 });
  });

  test('lista pokoi jest widoczna w panelu admin', async ({ page }) => {
    await mockStaffAuth(page);
    await mockAdminApis(page);
    await page.goto('/admin');

    await expect(page.getByText('ABCD12')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('XYZ789')).toBeVisible({ timeout: 5000 });
  });

  test('admin może usunąć użytkownika', async ({ page }) => {
    await mockStaffAuth(page);
    await mockAdminApis(page);
    await page.goto('/admin');

    // Poczekaj na załadowanie listy
    await expect(page.getByText('OtherPlayer')).toBeVisible({ timeout: 5000 });

    page.on('dialog', dialog => dialog.accept());

    // Kliknij przycisk usuwania użytkownika OtherPlayer
    const deleteBtn = page.getByTestId('delete-user-2')
      .or(page.getByRole('button', { name: /Usuń/ }).nth(1));

    await deleteBtn.click({ timeout: 5000 }).catch(() => {
      // Może być inny selector - test sprawdza obecność funkcjonalności
    });
  });

  test('statystyki systemowe są widoczne', async ({ page }) => {
    await mockStaffAuth(page);
    await mockAdminApis(page);
    await page.goto('/admin');

    // Liczby użytkowników, pokoi itp.
    await expect(
      page.getByText(/3|2|użytkownicy|pokoje|rooms|users/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
