import { test, expect } from '@playwright/test';
import { MOCK_USER, mockUnauthenticated } from './helpers';

test.describe('Autentykacja', () => {
  test('strona główna wyświetla się poprawnie', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');
    await expect(page.getByText('Quiz Multiplayer')).toBeVisible();
    await expect(page.getByText('Zagraj teraz')).toBeVisible();
    await expect(page.getByText('Dowiedz sie wiecej')).toBeVisible();
  });

  test.describe('Rejestracja', () => {
    test.beforeEach(async ({ page }) => {
      await mockUnauthenticated(page);
    });

    test('formularz rejestracji jest widoczny', async ({ page }) => {
      await page.goto('/register');
      await expect(page.getByText('Utworz konto')).toBeVisible();
      await expect(page.getByPlaceholder('Twoj nick')).toBeVisible();
      await expect(page.getByPlaceholder('twoj@email.com')).toBeVisible();
      await expect(page.getByPlaceholder('Haslo')).toBeVisible();
      await expect(page.getByPlaceholder('Powtorz haslo')).toBeVisible();
    });

    test('użytkownik może się zarejestrować i trafia na dashboard', async ({ page }) => {
      let meCallCount = 0;
      await page.route('**/api/auth/me/', async route => {
        meCallCount++;
        if (meCallCount === 1) {
          // Pierwsze wywołanie: użytkownik niezalogowany — strona rejestracji widoczna
          await route.fulfill({ status: 401, body: '{}' });
        } else {
          // Po rejestracji — użytkownik już zalogowany
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_USER),
          });
        }
      });

      await page.route('**/api/auth/register/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ display_name: MOCK_USER.display_name, email: MOCK_USER.email }),
        });
      });

      await page.goto('/register');
      await page.getByPlaceholder('Twoj nick').fill('TestUser');
      await page.getByPlaceholder('twoj@email.com').fill('test@example.com');
      await page.getByPlaceholder('Haslo').fill('password123');
      await page.getByPlaceholder('Powtorz haslo').fill('password123');
      await page.getByRole('button', { name: 'Zarejestruj sie' }).click();

      await expect(page).toHaveURL('/dashboard');
    });

    test('walidacja: hasła muszą być identyczne', async ({ page }) => {
      await page.goto('/register');
      await page.getByPlaceholder('Twoj nick').fill('TestUser');
      await page.getByPlaceholder('twoj@email.com').fill('test@example.com');
      await page.getByPlaceholder('Haslo').fill('password123');
      await page.getByPlaceholder('Powtorz haslo').fill('inna123');
      await page.getByRole('button', { name: 'Zarejestruj sie' }).click();

      await expect(page.getByText('Hasla nie sa identyczne')).toBeVisible();
    });

    test('błąd serwera wyświetla komunikat', async ({ page }) => {
      await page.route('**/api/auth/register/', async route => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Email already taken' }),
        });
      });

      await page.goto('/register');
      await page.getByPlaceholder('Twoj nick').fill('TestUser');
      await page.getByPlaceholder('twoj@email.com').fill('zajety@example.com');
      await page.getByPlaceholder('Haslo').fill('password123');
      await page.getByPlaceholder('Powtorz haslo').fill('password123');
      await page.getByRole('button', { name: 'Zarejestruj sie' }).click();

      await expect(page.getByText('Blad rejestracji — sprawdz dane')).toBeVisible();
    });
  });

  test.describe('Logowanie', () => {
    test('formularz logowania jest widoczny', async ({ page }) => {
      await mockUnauthenticated(page);
      await page.goto('/login');
      await expect(page.getByText('Logowanie')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Zaloguj sie' })).toBeVisible();
    });

    test('użytkownik może się zalogować i trafia na dashboard', async ({ page }) => {
      let meCallCount = 0;
      await page.route('**/api/auth/me/', async route => {
        meCallCount++;
        if (meCallCount === 1) {
          await route.fulfill({ status: 401, body: '{}' });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_USER),
          });
        }
      });

      await page.route('**/api/auth/login/', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ display_name: MOCK_USER.display_name, email: MOCK_USER.email }),
        });
      });

      await page.goto('/login');
      await page.locator('input[type="email"]').fill('test@example.com');
      await page.locator('input[type="password"]').fill('password123');
      await page.getByRole('button', { name: 'Zaloguj sie' }).click();

      await expect(page).toHaveURL('/dashboard');
    });

    test('błędne dane wyświetlają komunikat o błędzie', async ({ page }) => {
      await mockUnauthenticated(page);

      await page.route('**/api/auth/login/', async route => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid credentials' }),
        });
      });

      await page.goto('/login');
      await page.locator('input[type="email"]').fill('zly@example.com');
      await page.locator('input[type="password"]').fill('zlehaslo');
      await page.getByRole('button', { name: 'Zaloguj sie' }).click();

      await expect(page.getByText('Nieprawidlowy email lub haslo')).toBeVisible();
    });

    test('link do rejestracji jest widoczny', async ({ page }) => {
      await mockUnauthenticated(page);
      await page.goto('/login');
      const registerLink = page.getByRole('link', { name: 'Rejestracja' });
      await expect(registerLink).toBeVisible();
      await registerLink.click();
      await expect(page).toHaveURL('/register');
    });
  });
});
