import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

test.describe('Turnieje', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/tournaments');
    await expect(page).toHaveURL('/login');
  });

  test('lista turniejów się ładuje', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    await expect(page.getByRole('heading', { name: 'Turnieje' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aktywne' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nadchodzące' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zakończone' })).toBeVisible();
  });

  test('domyślnie wyświetlane są aktywne turnieje', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    // Aktywne turnieje z mockowanych danych
    await expect(page.getByText('Mistrzostwa Wiedzy')).toBeVisible();
    await expect(page.getByText('Quiz Naukowy')).toBeVisible();
  });

  test('filtrowanie po zakładce "Nadchodzące"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    await page.getByRole('button', { name: 'Nadchodzące' }).click();

    await expect(page.getByText('Historia Świata')).toBeVisible();
    await expect(page.getByText('Wiosenny Turniej')).toBeVisible();
    // Aktywne nie powinny być widoczne
    await expect(page.getByText('Mistrzostwa Wiedzy')).not.toBeVisible();
  });

  test('filtrowanie po zakładce "Zakończone"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    await page.getByRole('button', { name: 'Zakończone' }).click();

    await expect(page.getByText('Turniej Filmowy')).toBeVisible();
    await expect(page.getByText('Liga Sportowa')).toBeVisible();
  });

  test('zakończone turnieje mają przycisk "Wyniki"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    await page.getByRole('button', { name: 'Zakończone' }).click();

    // Powinna być przynajmniej jedna karta z "Wyniki"
    await expect(page.getByRole('link', { name: 'Wyniki' }).first()).toBeVisible();
  });

  test('nadchodzący turniej ma przycisk "Dołącz"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    await page.getByRole('button', { name: 'Nadchodzące' }).click();

    // Historia Świata (participants: 12, max: 64) ma przycisk Dołącz
    await expect(page.getByRole('link', { name: 'Dołącz' }).first()).toBeVisible();
  });

  test('pełny turniej wyświetla status "Pełny"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    // Quiz Naukowy (32/32 = pełny)
    await expect(page.getByText('Pełny')).toBeVisible();
  });

  test('przycisk "+ Utwórz turniej" jest widoczny', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    await expect(page.getByRole('link', { name: /Utwórz turniej/ })).toBeVisible();
  });

  test('karty turniejów zawierają datę, kategorię i nagrodę', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    // Mistrzostwa Wiedzy - prize: '1000 monet', category: 'Ogólna wiedza'
    await expect(page.getByText('Ogólna wiedza')).toBeVisible();
    await expect(page.getByText('1000 monet')).toBeVisible();
  });

  test('odznaka statusu "Aktywny" jest wyświetlana', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/tournaments');

    await expect(page.getByText('Aktywny').first()).toBeVisible();
  });
});
