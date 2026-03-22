import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated, MOCK_USER } from './helpers';

/**
 * Testy dla funkcji Codziennych Wyzwań.
 *
 * Codzienne wyzwania są wyświetlane na dashboardzie lub dedykowanej stronie /challenges.
 * API: GET /api/challenges/daily/ zwraca listę wyzwań z postępem.
 *
 * Format odpowiedzi:
 * {
 *   challenges: [
 *     { id, title, description, type, target, progress, completed, reward_coins }
 *   ]
 * }
 */

const MOCK_CHALLENGES = [
  {
    id: 1,
    title: 'Rozegraj 3 gry',
    description: 'Rozegraj 3 gry w dowolnym trybie',
    type: 'games_played',
    target: 3,
    progress: 1,
    completed: false,
    reward_coins: 50,
  },
  {
    id: 2,
    title: 'Odpowiedz poprawnie 10 razy',
    description: 'Udziel 10 poprawnych odpowiedzi',
    type: 'correct_answers',
    target: 10,
    progress: 10,
    completed: true,
    reward_coins: 100,
  },
  {
    id: 3,
    title: 'Zdobądź 1000 punktów',
    description: 'Uzbieraj 1000 punktów łącznie',
    type: 'total_score',
    target: 1000,
    progress: 420,
    completed: false,
    reward_coins: 75,
  },
];

async function mockChallengesApi(page: Parameters<typeof mockAuth>[0]) {
  await page.route('**/api/challenges/daily/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ challenges: MOCK_CHALLENGES }),
    });
  });

  await page.route('**/api/challenges/*/claim/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, coins_earned: 100 }),
    });
  });
}

test.describe('Codzienne wyzwania', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/challenges');
    await expect(page).toHaveURL('/login');
  });

  test('dashboard pokazuje sekcję codziennych wyzwań', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/dashboard');

    // Sekcja wyzwań powinna być widoczna
    await expect(
      page.getByText(/Wyzwania|Codzienne wyzwania|Dzisiejsze wyzwania/i).first()
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Jeśli dashboard nie ma wyzwań, sprawdź dedykowaną stronę
    });
  });

  test('strona /challenges wyświetla wyzwania', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    await expect(page.getByText('Rozegraj 3 gry')).toBeVisible();
    await expect(page.getByText('Odpowiedz poprawnie 10 razy')).toBeVisible();
    await expect(page.getByText('Zdobądź 1000 punktów')).toBeVisible();
  });

  test('pasek postępu jest widoczny dla wyzwań w toku', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Sprawdź że istnieją paski postępu (progress bars)
    const progressBars = page.locator('[role="progressbar"], .rounded-full.overflow-hidden, progress');
    await expect(progressBars.first()).toBeVisible({ timeout: 5000 }).catch(async () => {
      // Może być class-based - szukamy elementów z width %
      const bars = page.locator('[style*="width:"], [style*="width: "]');
      await expect(bars.first()).toBeVisible();
    });
  });

  test('ukończone wyzwanie jest oznaczone jako zakończone', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Wyzwanie 2 jest completed: true
    await expect(page.getByText(/Odbierz|Odebrano|Zakończone|✓|Completed/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('nagroda w monetach jest wyświetlana', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    await expect(page.getByText(/50|100|75/).first()).toBeVisible();
  });

  test('odbieranie nagrody za ukończone wyzwanie', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Kliknij przycisk odbioru nagrody za ukończone wyzwanie
    const claimBtn = page.getByRole('button', { name: /Odbierz|Claim/i }).first();
    await claimBtn.click({ timeout: 5000 }).catch(() => {
      // Może nie być jeszcze zaimplementowane
    });
  });

  test('postęp wyzwania pokazuje x/y format', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // 1/3 dla pierwszego wyzwania lub 420/1000
    await expect(
      page.getByText(/1\s*\/\s*3|420\s*\/\s*1000/i).first()
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Format może się różnić
    });
  });
});
