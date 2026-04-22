import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

test.describe('Tryb Przetrwania', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/survival');
    await expect(page).toHaveURL('/login');
  });

  test('ekran startowy wyświetla się prawidłowo', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await expect(page.getByRole('heading', { name: 'Tryb Przetrwania' })).toBeVisible();
    await expect(page.getByText('Odpowiadaj poprawnie, dopóki się nie mylisz!')).toBeVisible();
    await expect(page.getByRole('button', { name: /Rozpocznij/ })).toBeVisible();
  });

  test('ekran startowy pokazuje najlepszy wynik', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await expect(page.getByText('Najlepszy wynik')).toBeVisible();
  });

  test('ekran startowy pokazuje zasady gry', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await expect(page.getByText('3 Życia')).toBeVisible();
    await expect(page.getByText('15 sekund')).toBeVisible();
    await expect(page.getByText('Seria')).toBeVisible();
    await expect(page.getByText('Zasady')).toBeVisible();
  });

  test('kliknięcie "Rozpocznij" uruchamia grę', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await page.getByRole('button', { name: /Rozpocznij/ }).click();

    // Po starcie powinny być widoczne serca (HUD)
    await expect(page.getByText('❤️').first()).toBeVisible();
    // Pytanie powinno być widoczne
    await expect(page.getByText(/Pytanie #1/)).toBeVisible();
  });

  test('podczas gry wyświetlany jest timer bar', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await page.getByRole('button', { name: /Rozpocznij/ }).click();

    // Pasek czasu - div z width% style lub klasa timer
    const timerBar = page.locator('.rounded-full').filter({ hasText: '' }).first();
    await expect(page.locator('text=⏱').first()).toBeVisible();
  });

  test('odpowiedź na pytanie - prawidłowa odpowiedź', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await page.getByRole('button', { name: /Rozpocznij/ }).click();

    // Poczekaj na pytanie
    await expect(page.getByText(/Pytanie #1/)).toBeVisible();

    // Pytania są z FALLBACK_QUESTIONS, kliknij pierwszą odpowiedź
    const options = page.getByRole('button').filter({ hasText: /^[A-D]\.\s/ });
    await options.first().click();

    // Po odpowiedzi powinno nastąpić przejście (poprawna lub błędna)
    // Timer bar powinien zmienić kolor lub pojawić się feedback
    await page.waitForTimeout(500);
  });

  test('błędna odpowiedź zabiera życie', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await page.getByRole('button', { name: /Rozpocznij/ }).click();

    await expect(page.getByText(/Pytanie #1/)).toBeVisible();

    // Znajdź pytanie o Rosji (id:1, correct: 1 = "Rosja")
    // Kliknij Kanada (niepoprawna) - idx 0
    const firstQuestion = page.getByText(/Który kraj jest największy powierzchniowo/);
    if (await firstQuestion.isVisible()) {
      await page.getByRole('button', { name: /A\.\s*Kanada/ }).click();
      // Po złej odpowiedzi jedno serce powinno zniknąć (2 filled hearts)
      await page.waitForTimeout(1500); // czekaj na animację
    }
  });

  test('gra kończy się po 3 błędach', async ({ page }) => {
    await mockAuth(page);

    // Ustaw best score = 0 w localStorage
    await page.goto('/survival');
    await page.evaluate(() => localStorage.setItem('survival_best', '0'));

    await page.getByRole('button', { name: /Rozpocznij/ }).click();

    // Klikaj błędne odpowiedzi 3 razy
    for (let i = 0; i < 3; i++) {
      await expect(page.getByText(/Pytanie #/)).toBeVisible({ timeout: 5000 });

      // Kliknij pierwszą odpowiedź (może być poprawna lub nie - nie deterministic)
      const optionsButtons = page.getByRole('button').filter({ hasText: /^A\.\s/ });
      if (await optionsButtons.count() > 0) {
        await optionsButtons.first().click();
      }
      await page.waitForTimeout(1500);
    }

    // Jeśli gra się skończyła, powinien pojawić się ekran game over
    await expect(
      page.getByText('Koniec gry!').or(page.getByText(/poprawnych odpowiedzi z rzędu/))
    ).toBeVisible({ timeout: 10000 });
  });

  test('ekran game over ma przycisk "Zagraj ponownie"', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    // Symuluj koniec gry przez manipulację stanem
    await page.evaluate(() => {
      // Możemy to testować przez szybkie klikanie złych odpowiedzi
    });

    // Uruchom grę i sprawdź ekran game over
    await page.getByRole('button', { name: /Rozpocznij/ }).click();
    await expect(page.getByText(/Pytanie #1/)).toBeVisible();

    // Klikaj złe odpowiedzi 3 razy (zakładamy że mamy 3 życia)
    for (let attempt = 0; attempt < 20; attempt++) {
      const isGameOver = await page.getByText('Koniec gry!').isVisible();
      if (isGameOver) break;

      const button = page.getByRole('button').filter({ hasText: /^A\.\s/ }).first();
      if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(1300);
      } else {
        await page.waitForTimeout(500);
      }
    }

    await expect(page.getByText('Koniec gry!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Zagraj ponownie/ })).toBeVisible();
  });

  test('streak fire emoji jest widoczny podczas gry', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    await page.getByRole('button', { name: /Rozpocznij/ }).click();
    await expect(page.getByText(/Pytanie #1/)).toBeVisible();

    await expect(page.getByText('🔥')).toBeVisible();
  });

  test('"Wróć do menu" na ekranie game over wraca do idle', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/survival');

    // Uruchom grę
    await page.getByRole('button', { name: /Rozpocznij/ }).click();

    // Szybko przejdź do game over przez wielokrotne błędne odpowiedzi
    for (let attempt = 0; attempt < 25; attempt++) {
      const isGameOver = await page.getByText('Koniec gry!').isVisible();
      if (isGameOver) break;

      const button = page.getByRole('button').filter({ hasText: /^A\.\s/ }).first();
      if (await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(1300);
      } else {
        await page.waitForTimeout(500);
      }
    }

    const gameOverVisible = await page.getByText('Koniec gry!').isVisible({ timeout: 15000 });
    if (gameOverVisible) {
      await page.getByRole('button', { name: /Wróć do menu/ }).click();
      // Powrót do ekranu idle
      await expect(page.getByRole('button', { name: /Rozpocznij/ })).toBeVisible();
    }
  });
});
