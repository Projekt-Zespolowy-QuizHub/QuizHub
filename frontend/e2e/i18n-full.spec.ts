import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

/**
 * Rozszerzone testy internacjonalizacji (i18n).
 *
 * Uzupełniają i18n.spec.ts o dodatkowe scenariusze:
 * 1. Weryfikacja polskiego jako języka domyślnego na kluczowych stronach
 * 2. Tłumaczenie etykiet nawigacji
 * 3. Tłumaczenie formularzy (logowanie, rejestracja)
 * 4. Tłumaczenie nagłówków rankingu
 * 5. Brak niezamienionych kluczy i18n ({t('key')} style strings)
 * 6. Tłumaczenie komunikatów błędów
 */

test.describe('i18n - przełącznik języka', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('locale'));
  });

  test('przełącznik języka PL/EN jest widoczny na stronie głównej', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const plButton = page.getByRole('button', { name: 'Polski' });
    const enButton = page.getByRole('button', { name: 'English' });
    await expect(plButton).toBeVisible();
    await expect(enButton).toBeVisible();
  });

  test('domyślny język to polski na stronie głównej', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // Polska treść powinna być domyślnie widoczna
    await expect(page.getByText('Quiz Multiplayer')).toBeVisible();
  });

  test('aktywny język ma wyróżniony styl (żółty kolor)', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const plButton = page.getByRole('button', { name: 'Polski' });
    const plClass = await plButton.getAttribute('class');
    // PL powinno być aktywne (żółty kolor)
    expect(plClass).toContain('yellow');
  });

  test('przełączenie na angielski zmienia teksty na stronie głównej', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'English' }).click();

    await expect(page.getByText('Play now')).toBeVisible();
    await expect(page.getByText('Zagraj teraz')).not.toBeVisible();
  });

  test('przełączenie z EN na PL przywraca polski', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('Play now')).toBeVisible();

    await page.getByRole('button', { name: 'Polski' }).click();
    await expect(page.getByText('Zagraj teraz')).toBeVisible();
  });

  test('preferencja języka EN zapisuje się w localStorage', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'English' }).click();

    const savedLocale = await page.evaluate(() => localStorage.getItem('locale'));
    expect(savedLocale).toBe('en');
  });

  test('preferencja języka utrzymuje się po przeładowaniu strony', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('Play now')).toBeVisible();

    await page.reload();
    await mockUnauthenticated(page);

    // Angielski powinien się utrzymać
    await expect(page.getByText('Play now')).toBeVisible();
  });

  test('preferencja języka EN działa po przejściu na inną stronę', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    // Ustaw EN przez localStorage
    await page.evaluate(() => localStorage.setItem('locale', 'en'));

    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });
});

test.describe('i18n - nawigacja', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('locale'));
  });

  test('nawigacja po polsku zawiera właściwe etykiety', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    // Polski tekst w nawigacji
    const rankingLink = page.getByRole('link', { name: 'Ranking' });
    const friendsLink = page.getByRole('link', { name: 'Znajomi' });

    // Przynajmniej jeden z tych linków powinien być widoczny
    const hasRanking = await rankingLink.isVisible();
    const hasFriends = await friendsLink.isVisible();
    expect(hasRanking || hasFriends).toBeTruthy();
  });

  test('przełączenie na EN zmienia nagłówek dashboardu', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'English' }).click();

    // Dashboard po angielsku
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('EN - aktywny przycisk języka ma wyróżniony styl', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'English' }).click();

    const enButton = page.getByRole('button', { name: 'English' });
    const enClass = await enButton.getAttribute('class');
    expect(enClass).toContain('yellow');
  });
});

test.describe('i18n - strona rankingu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('locale'));
  });

  test('nagłówki rankingu są po polsku domyślnie', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    // Zakładki powinny być po polsku
    await expect(page.getByRole('button', { name: 'Globalny' })).toBeVisible();
  });

  test('przełączenie na EN zmienia nagłówki rankingu', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    await page.getByRole('button', { name: 'English' }).click();

    await expect(page.getByRole('button', { name: 'Global' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weekly' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Friends' })).toBeVisible();
  });
});

test.describe('i18n - formularze', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('locale'));
  });

  test('formularz logowania ma polskie etykiety domyślnie', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    // Polski: "Email" lub "E-mail" i "Hasło"
    const emailLabel = page.getByText(/^E-?mail$/i);
    const passwordLabel = page.getByText(/^Hasło$/i);

    const hasEmail = await emailLabel.isVisible();
    const hasPassword = await passwordLabel.isVisible();
    // Przynajmniej etykieta hasła powinna być po polsku
    expect(hasEmail || hasPassword).toBeTruthy();
  });

  test('formularz logowania po przełączeniu na EN ma angielskie etykiety', async ({ page }) => {
    await mockUnauthenticated(page);

    // Ustaw EN przed przejściem na stronę logowania
    await page.goto('/');
    await page.getByRole('button', { name: 'English' }).click();
    await page.goto('/login');

    // Angielski: "Password" zamiast "Hasło"
    const passwordLabel = page.getByText(/^Password$/i);
    if (await passwordLabel.isVisible()) {
      await expect(passwordLabel).toBeVisible();
    } else {
      // Formularz może nie mieć widocznych etykiet - sprawdź placeholder
      const passwordInput = page.locator('input[type="password"]');
      const placeholder = await passwordInput.getAttribute('placeholder');
      expect(placeholder).toMatch(/password/i);
    }
  });

  test('formularz rejestracji ma polskie etykiety domyślnie', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/register');

    // Rejestracja po polsku powinna zawierać "Hasło" lub "Nazwa"
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasPolishText =
      pageText.includes('Hasło') ||
      pageText.includes('Nazwa') ||
      pageText.includes('Rejestracja') ||
      pageText.includes('Zarejestruj');
    expect(hasPolishText).toBeTruthy();
  });
});

test.describe('i18n - brak niezamienionych kluczy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('locale'));
  });

  test('strona główna nie zawiera niezamienionych kluczy i18n', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/');

    const pageText = await page.evaluate(() => document.body.innerText);

    // Niezamienione klucze wyglądają jak t('key') lub {key}
    expect(pageText).not.toMatch(/\bt\(['"]\w/);
    expect(pageText).not.toMatch(/\{\w+\.\w+\}/); // {namespace.key}
  });

  test('dashboard nie zawiera niezamienionych kluczy i18n', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    const pageText = await page.evaluate(() => document.body.innerText);

    expect(pageText).not.toMatch(/\bt\(['"]\w/);
    expect(pageText).not.toMatch(/missing translation/i);
  });

  test('strona rankingu nie zawiera niezamienionych kluczy i18n', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/rankings/**/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/ranking');

    const pageText = await page.evaluate(() => document.body.innerText);

    expect(pageText).not.toMatch(/\bt\(['"]\w/);
    expect(pageText).not.toMatch(/missing translation/i);
  });

  test('strona logowania nie zawiera niezamienionych kluczy i18n', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/login');

    const pageText = await page.evaluate(() => document.body.innerText);

    expect(pageText).not.toMatch(/\bt\(['"]\w/);
    expect(pageText).not.toMatch(/missing translation/i);
  });

  test('EN - dashboard nie zawiera niezamienionych kluczy i18n', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'English' }).click();

    const pageText = await page.evaluate(() => document.body.innerText);

    expect(pageText).not.toMatch(/\bt\(['"]\w/);
    expect(pageText).not.toMatch(/missing translation/i);
  });
});

test.describe('i18n - tryb survival i paczki pytań', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('locale'));
  });

  test('strona survival ma tytuł po polsku', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await expect(page.getByRole('heading', { name: 'Tryb Przetrwania' })).toBeVisible();
  });

  test('strona survival zmienia tytuł po przełączeniu na EN', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await page.getByRole('button', { name: 'English' }).click();

    await expect(page.getByRole('heading', { name: 'Survival Mode' })).toBeVisible();
  });

  test('strona paczek ma tytuł po polsku', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/packs/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/packs');

    // Polski tytuł
    const heading = page.getByRole('heading', { name: /paczki/i });
    await expect(heading).toBeVisible();
  });

  test('strona paczek zmienia tytuł po przełączeniu na EN', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/packs/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/packs');

    await page.getByRole('button', { name: 'English' }).click();

    await expect(page.getByRole('heading', { name: 'Question packs' })).toBeVisible();
  });
});

test.describe('i18n - przełącznik w mobile menu', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('mobile overlay zawiera przełącznik języka', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();

    // LanguageSwitcher powinien być w stopce mobile overlay
    await expect(page.getByRole('button', { name: 'Polski' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  });

  test('przełączenie języka przez mobile menu działa', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Otwórz menu' }).click();
    await page.getByRole('button', { name: 'English' }).click();

    // Zamknij menu
    const closeBtn = page.getByRole('button', { name: 'Zamknij menu' });
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // Dashboard powinien być po angielsku
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Sprawdź localStorage
    const savedLocale = await page.evaluate(() => localStorage.getItem('locale'));
    expect(savedLocale).toBe('en');
  });
});
