import { test, expect } from '@playwright/test';
import { MOCK_USER, mockAuth, mockUnauthenticated } from './helpers';

test.describe('Autentykacja — pełny przepływ', () => {
  test.describe('Strona rejestracji', () => {
    test.beforeEach(async ({ page }) => {
      await mockUnauthenticated(page);
    });

    test('strona rejestracji ładuje się z polami formularza', async ({ page }) => {
      await page.goto('/register');

      await expect(page.getByText('Utworz konto')).toBeVisible();
      await expect(page.getByPlaceholder('Twoj nick')).toBeVisible();
      await expect(page.getByPlaceholder('twoj@email.com')).toBeVisible();
      await expect(page.getByPlaceholder('Haslo')).toBeVisible();
      await expect(page.getByPlaceholder('Powtorz haslo')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Zarejestruj sie' })).toBeVisible();
    });

    test('rejestracja z poprawnymi danymi przekierowuje na /dashboard', async ({ page }) => {
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

      await page.route('**/api/auth/register/', async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ display_name: 'NewUser', email: 'new@test.com' }),
        });
      });

      await page.goto('/register');
      await page.getByPlaceholder('Twoj nick').fill('NewUser');
      await page.getByPlaceholder('twoj@email.com').fill('new@test.com');
      await page.getByPlaceholder('Haslo').fill('password123');
      await page.getByPlaceholder('Powtorz haslo').fill('password123');
      await page.getByRole('button', { name: 'Zarejestruj sie' }).click();

      await expect(page).toHaveURL('/dashboard');
    });

    test('rejestracja pokazuje błąd walidacji dla zbyt krótkiego hasła', async ({ page }) => {
      await page.goto('/register');
      await page.getByPlaceholder('Twoj nick').fill('NewUser');
      await page.getByPlaceholder('twoj@email.com').fill('new@test.com');
      await page.getByPlaceholder('Haslo').fill('abc');
      await page.getByPlaceholder('Powtorz haslo').fill('abc');
      await page.getByRole('button', { name: 'Zarejestruj sie' }).click();

      // Hasło zbyt krótkie — walidacja client-side lub błąd serwera
      const errorVisible =
        (await page.getByText(/haslo.*kr/i).isVisible().catch(() => false)) ||
        (await page.getByText('Blad rejestracji — sprawdz dane').isVisible().catch(() => false));
      expect(errorVisible).toBe(true);
    });

    test('rejestracja pokazuje błąd gdy display_name jest zajęty (400 z backendu)', async ({ page }) => {
      await page.route('**/api/auth/register/', async route => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Display name already taken' }),
        });
      });

      await page.goto('/register');
      await page.getByPlaceholder('Twoj nick').fill('ZajetyNick');
      await page.getByPlaceholder('twoj@email.com').fill('new@test.com');
      await page.getByPlaceholder('Haslo').fill('password123');
      await page.getByPlaceholder('Powtorz haslo').fill('password123');
      await page.getByRole('button', { name: 'Zarejestruj sie' }).click();

      await expect(page.getByText('Blad rejestracji — sprawdz dane')).toBeVisible();
    });

    test('walidacja: hasła muszą być identyczne', async ({ page }) => {
      await page.goto('/register');
      await page.getByPlaceholder('Twoj nick').fill('NewUser');
      await page.getByPlaceholder('twoj@email.com').fill('new@test.com');
      await page.getByPlaceholder('Haslo').fill('password123');
      await page.getByPlaceholder('Powtorz haslo').fill('innehaslo99');
      await page.getByRole('button', { name: 'Zarejestruj sie' }).click();

      await expect(page.getByText('Hasla nie sa identyczne')).toBeVisible();
    });
  });

  test.describe('Strona logowania', () => {
    test('strona logowania ładuje się poprawnie', async ({ page }) => {
      await mockUnauthenticated(page);
      await page.goto('/login');

      await expect(page.getByText('Logowanie')).toBeVisible();
    });

    test('formularz logowania zawiera pola email i hasło', async ({ page }) => {
      await mockUnauthenticated(page);
      await page.goto('/login');

      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Zaloguj sie' })).toBeVisible();
    });

    test('logowanie z poprawnymi danymi przekierowuje na /dashboard', async ({ page }) => {
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

    test('logowanie z błędnym hasłem pokazuje komunikat błędu (mock 401)', async ({ page }) => {
      await mockUnauthenticated(page);

      await page.route('**/api/auth/login/', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid credentials' }),
        });
      });

      await page.goto('/login');
      await page.locator('input[type="email"]').fill('test@example.com');
      await page.locator('input[type="password"]').fill('zlehaslo');
      await page.getByRole('button', { name: 'Zaloguj sie' }).click();

      await expect(page.getByText('Nieprawidlowy email lub haslo')).toBeVisible();
    });
  });

  test.describe('Wylogowanie', () => {
    test('przycisk wylogowania wywołuje /api/auth/logout/ i przekierowuje na /login', async ({ page }) => {
      await mockAuth(page);

      let logoutCalled = false;
      await page.route('**/api/auth/logout/', async route => {
        logoutCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Logged out' }),
        });
      });

      await page.goto('/dashboard');

      // Kliknij przycisk wylogowania (może być w menu lub bezpośrednio na stronie)
      const logoutButton = page.getByRole('button', { name: /Wyloguj/i });
      await logoutButton.click();

      expect(logoutCalled).toBe(true);
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Ochrona tras', () => {
    test('niezalogowany użytkownik odwiedzający /dashboard trafia na /login', async ({ page }) => {
      await mockUnauthenticated(page);
      await page.goto('/dashboard');

      await expect(page).toHaveURL('/login');
    });

    test('zalogowany użytkownik odwiedzający /login trafia na /dashboard', async ({ page }) => {
      await mockAuth(page);
      await page.goto('/login');

      await expect(page).toHaveURL('/dashboard');
    });
  });
});
