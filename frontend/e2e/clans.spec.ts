import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated, MOCK_USER } from './helpers';

test.describe('Klany', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/clans');
    await expect(page).toHaveURL('/login');
  });

  test('strona klanów się ładuje', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    await expect(page.getByRole('heading', { name: 'Klany' })).toBeVisible();
  });

  test('lista wszystkich klanów jest widoczna', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    await expect(page.getByText('Wiedzowi Wojownicy')).toBeVisible();
    await expect(page.getByText('Naukowe Umysły')).toBeVisible();
    await expect(page.getByText('Tech Guru')).toBeVisible();
  });

  test('"Twój klan" wyświetla się na górze', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    // Quizowi Mistrzowie - isMember: true - pojawia się w sekcji "Twój klan"
    await expect(page.getByText('Twój klan')).toBeVisible();
    await expect(page.getByText('Quizowi Mistrzowie')).toBeVisible();
  });

  test('wyszukiwanie filtruje klany po nazwie', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    const searchInput = page.getByPlaceholder(/Szukaj klanu/);
    await searchInput.fill('Tech');

    await expect(page.getByText('Tech Guru')).toBeVisible();
    await expect(page.getByText('Wiedzowi Wojownicy')).not.toBeVisible();
  });

  test('wyszukiwanie filtruje klany po tagu', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    const searchInput = page.getByPlaceholder(/Szukaj klanu/);
    await searchInput.fill('WW');

    await expect(page.getByText('Wiedzowi Wojownicy')).toBeVisible();
    await expect(page.getByText('Tech Guru')).not.toBeVisible();
  });

  test('puste wyniki wyszukiwania pokazują komunikat', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    const searchInput = page.getByPlaceholder(/Szukaj klanu/);
    await searchInput.fill('nieistniejący klan xyz123');

    await expect(page.getByText(/Nie znaleziono klanów/)).toBeVisible();
  });

  test('przycisk "Dołącz" jest widoczny dla otwartych klanów', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    // Wiedzowi Wojownicy - isOpen: true, isMember: false
    const ww = page.getByText('Wiedzowi Wojownicy').locator('..');
    await expect(page.getByRole('button', { name: 'Dołącz' }).first()).toBeVisible();
  });

  test('kliknięcie "Dołącz" dołącza do klanu i pokazuje toast', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    // Liga Sportowa - isOpen: true, nie pełna
    await page.getByRole('button', { name: 'Dołącz' }).first().click();

    // Toast powinien pojawić się z komunikatem o dołączeniu
    await expect(page.getByText(/Dołączyłeś do klanu/)).toBeVisible();
  });

  test('pełny klan pokazuje status "Pełny"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    // Historia i Kultura - members: 20, maxMembers: 20
    await expect(page.getByText('Pełny')).toBeVisible();
  });

  test('zamknięty klan pokazuje status "Zamknięty"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    // Naukowe Umysły - isOpen: false
    await expect(page.getByText('Zamknięty')).toBeVisible();
  });

  test('klany wyświetlają tag w nawiasach kwadratowych', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    await expect(page.getByText('[WW]')).toBeVisible();
    await expect(page.getByText('[TG]')).toBeVisible();
  });

  test('link do szczegółów klanu prowadzi do /clans/[id]', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    // Kliknij link do Wiedzowych Wojowników (id: 2)
    await page.getByRole('link', { name: 'Wiedzowi Wojownicy' }).click();
    await expect(page).toHaveURL('/clans/2');
  });

  test('nie ma przycisku "Utwórz klan" gdy użytkownik jest w klanie', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/clans');

    // Użytkownik jest w Quizowi Mistrzowie - nie powinno być "Utwórz klan" guzika
    await expect(page.getByRole('link', { name: /Utwórz klan/ })).not.toBeVisible();
  });
});
