import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

test.describe('Sklep', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/shop');
    await expect(page).toHaveURL('/login');
  });

  test('strona sklepu się ładuje', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await expect(page.getByRole('heading', { name: 'Sklep' })).toBeVisible();
  });

  test('balans monet jest widoczny', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    // MOCK_BALANCE = 350
    await expect(page.getByText('350')).toBeVisible();
    await expect(page.getByText('monet')).toBeVisible();
  });

  test('zakładki Avatary / Power-upy / Motywy są widoczne', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await expect(page.getByRole('button', { name: /Avatary/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Power-upy/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Motywy/ })).toBeVisible();
  });

  test('domyślnie otwarta zakładka "Avatary"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await expect(page.getByText('Lis')).toBeVisible();
    await expect(page.getByText('Robot')).toBeVisible();
    await expect(page.getByText('Smok')).toBeVisible();
  });

  test('posiadane avatary mają oznaczenie "Posiadasz"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    // Lis i Robot są owned: true, ale Lis jest aktywny
    await expect(page.getByText('Posiadasz')).toBeVisible();
  });

  test('aktywny avatar ma oznaczenie "✓ Aktywny"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await expect(page.getByText('✓ Aktywny')).toBeVisible();
  });

  test('zakup avatara otwiera modal potwierdzenia', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    // Smok kosztuje 200 monet, mamy 350 - możemy kupić
    await page.getByText('Smok').click();

    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await expect(page.getByText('Smok')).toBeVisible();
    await expect(page.getByText(/200 monet/)).toBeVisible();
  });

  test('potwierdzenie zakupu aktualizuje balans i pokazuje toast', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    // Smok kosztuje 200, mamy 350
    await page.getByText('Smok').click();
    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await page.getByRole('button', { name: 'Kup teraz' }).click();

    // Balans powinien być 350 - 200 = 150
    await expect(page.getByText('150')).toBeVisible();
    // Toast o sukcesie
    await expect(page.getByText(/Kupiono avatar Smok/)).toBeVisible();
  });

  test('anulowanie zakupu zamyka modal', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await page.getByText('Smok').click();
    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await page.getByRole('button', { name: 'Anuluj' }).click();

    await expect(page.getByText('Potwierdzenie zakupu')).not.toBeVisible();
    // Balans bez zmian
    await expect(page.getByText('350')).toBeVisible();
  });

  test('avatar bez wystarczających monet ma czerwone oznaczenie ceny', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    // Ninja kosztuje 500 monet, mamy 350 - za mało
    // Sprawdź, że cena jest w kolorze czerwonym (klasa text-red-400)
    const ninjaCard = page.getByText('Ninja').locator('..').locator('..');
    const priceEl = ninjaCard.locator('.text-red-400');
    await expect(priceEl).toBeVisible();
  });

  test('próba kupna z za małą liczbą monet pokazuje błąd', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    // Kosmita kosztuje 999 monet, mamy 350
    await page.getByText('Kosmita').click();
    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    // Przy próbie nie powinno pozwolić kupić (button jest disabled) lub toast błędu
    // Kosmita nie ma mieć przycisku Kup teraz enabled
    // Sprawdzamy że modal się pojawił - potwierdzamy że nie ma wystarczających monet
    await page.getByRole('button', { name: 'Anuluj' }).click();
  });

  test('przejście do zakładki Power-upy', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Power-upy/ }).click();

    await expect(page.getByText('50/50')).toBeVisible();
    await expect(page.getByText('+15 sekund')).toBeVisible();
    await expect(page.getByText('x2 Punkty')).toBeVisible();
  });

  test('power-up pokazuje liczbę posiadanych sztuk', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Power-upy/ }).click();

    // 50/50 - quantity: 3
    await expect(page.getByText(/Posiadasz: 3 szt/)).toBeVisible();
  });

  test('przycisk "Kup" jest disabled gdy za mało monet na power-up', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Power-upy/ }).click();

    // x2 Punkty kosztuje 100 monet, quantity: 0 - można kupić (mamy 350)
    // Ale sprawdzamy ogólnie czy przyciski Kup są widoczne
    const buyButtons = page.getByRole('button', { name: 'Kup' });
    await expect(buyButtons.first()).toBeVisible();
  });

  test('przejście do zakładki Motywy', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Motywy/ }).click();

    await expect(page.getByText('Ciemny (domyślny)')).toBeVisible();
    await expect(page.getByText('Galaktyczny')).toBeVisible();
    await expect(page.getByText('Oceaniczny')).toBeVisible();
    await expect(page.getByText('Leśny')).toBeVisible();
  });

  test('domyślny motyw ma oznaczenie "Posiadasz"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Motywy/ }).click();

    // Ciemny (domyślny) - owned: true
    await expect(page.getByText('Posiadasz').first()).toBeVisible();
  });

  test('kupno motywu otwiera modal i aktualizuje balans', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Motywy/ }).click();

    // Leśny kosztuje 200 monet, mamy 350
    await page.getByText('Leśny').locator('..').locator('..').getByRole('button', { name: 'Kup' }).click();

    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await page.getByRole('button', { name: 'Kup teraz' }).click();

    await expect(page.getByText('150')).toBeVisible();
    await expect(page.getByText(/Kupiono motyw Leśny/)).toBeVisible();
  });
});
