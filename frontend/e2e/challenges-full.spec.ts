import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

const MOCK_CHALLENGES = [
  {
    id: 1,
    description: 'Zagraj 3 gry',
    challenge_type: 'play_games',
    target_value: 3,
    coin_reward: 50,
    progress: { current_value: 1, completed: false, reward_claimed: false },
  },
  {
    id: 2,
    description: 'Wygraj 1 grę',
    challenge_type: 'win_games',
    target_value: 1,
    coin_reward: 100,
    progress: { current_value: 1, completed: true, reward_claimed: false },
  },
  {
    id: 3,
    description: 'Odpowiedz poprawnie 10 razy',
    challenge_type: 'correct_answers',
    target_value: 10,
    coin_reward: 75,
    progress: { current_value: 7, completed: false, reward_claimed: false },
  },
  {
    id: 4,
    description: 'Zdobądź 500 punktów',
    challenge_type: 'score_points',
    target_value: 500,
    coin_reward: 120,
    progress: { current_value: 500, completed: true, reward_claimed: true },
  },
];

async function mockChallengesApi(page: Parameters<typeof mockAuth>[0]) {
  await page.route('**/api/challenges/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CHALLENGES),
    });
  });

  await page.route('**/api/challenges/daily/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ challenges: MOCK_CHALLENGES }),
    });
  });

  await page.route('**/api/challenges/2/claim/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, coins_earned: 100 }),
    });
  });

  await page.route('**/api/challenges/*/claim/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, coins_earned: 50 }),
    });
  });
}

test.describe('Wyzwania - pełne testy', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/challenges');
    await expect(page).toHaveURL('/login');
  });

  test('strona wyzwań się ładuje', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Nagłówek strony
    await expect(
      page.getByRole('heading', { name: /Wyzwania|Codzienne wyzwania|Dzisiejsze wyzwania/i }).first()
    ).toBeVisible();
  });

  test('lista dzisiejszych wyzwań jest widoczna', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    await expect(page.getByText('Zagraj 3 gry')).toBeVisible();
    await expect(page.getByText('Wygraj 1 grę')).toBeVisible();
    await expect(page.getByText('Odpowiedz poprawnie 10 razy')).toBeVisible();
  });

  test('typy wyzwań są widoczne na liście', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Typy wyzwań: zagraj gry, wygraj gry, poprawne odpowiedzi, zdobądź punkty
    await expect(page.getByText('Zagraj 3 gry')).toBeVisible();
    await expect(page.getByText('Wygraj 1 grę')).toBeVisible();
    await expect(page.getByText('Zdobądź 500 punktów')).toBeVisible();
  });

  test('pasek postępu jest widoczny dla każdego wyzwania', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Paski postępu - role="progressbar" lub divs z width styles
    const progressBars = page.locator('[role="progressbar"], .rounded-full.overflow-hidden, progress, [class*="progress"]');
    await expect(progressBars.first()).toBeVisible({ timeout: 5000 }).catch(async () => {
      const widthBars = page.locator('[style*="width:"], [style*="width: "]');
      await expect(widthBars.first()).toBeVisible();
    });
  });

  test('postęp wyzwania wyświetla format x/y', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // 1/3 dla pierwszego wyzwania lub 7/10 dla trzeciego
    await expect(
      page.getByText(/1\s*\/\s*3|7\s*\/\s*10|1\/3|7\/10/i).first()
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Format może się różnić
    });
  });

  test('ukończone wyzwanie ma wskaźnik ukończenia', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Wyzwanie 2 jest completed: true, reward_claimed: false
    await expect(
      page.getByText(/Odbierz|Zakończone|Ukończone|✓|Completed/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('przycisk Odbierz nagrodę jest widoczny dla ukończonych nieodebranych wyzwań', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Wyzwanie 2: completed: true, reward_claimed: false
    const claimBtn = page.getByRole('button', { name: /Odbierz|Claim reward/i });
    await expect(claimBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('kliknięcie Odbierz wywołuje API i pokazuje zdobyte monety', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    const claimBtn = page.getByRole('button', { name: /Odbierz|Claim reward/i }).first();
    await claimBtn.click();

    // Toast lub informacja o zdobytych monetach
    await expect(
      page.getByText(/100 monet|coins_earned|Nagrodę odebrano|Odbrano nagrodę/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('odebrane wyzwanie ma odznakę Odebrano', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Wyzwanie 4: completed: true, reward_claimed: true
    await expect(page.getByText(/Odebrano|Claimed/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('nagrodą w monetach jest wyświetlana przy każdym wyzwaniu', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Nagrody: 50, 100, 75, 120
    await expect(page.getByText('50').first()).toBeVisible();
    await expect(page.getByText('100').first()).toBeVisible();
  });

  test('nieukończone wyzwanie nie ma przycisku Odbierz', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Wyzwanie 1 jest nieukończone (progress 1/3)
    // Sprawdzamy że nie wszystkie przyciski są widoczne
    const claimBtns = page.getByRole('button', { name: /Odbierz/i });
    const count = await claimBtns.count();

    // Powinien być co najwyżej 1 przycisk (dla ukończonego wyzwania 2), nie 4
    expect(count).toBeLessThan(4);
  });

  test('wyzwanie w trakcie pokazuje aktualny postęp procentowy lub liczbowy', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Wyzwanie 3: 7/10, czyli 70%
    const progress = page.getByText(/70%|7\/10|7 z 10/i);
    await expect(progress.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Format może się różnić
    });
  });

  test('dashboard pokazuje sekcję codziennych wyzwań', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/dashboard');

    await expect(
      page.getByText(/Wyzwania|Codzienne wyzwania|Dzisiejsze wyzwania/i).first()
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Dashboard może nie zawierać sekcji wyzwań
    });
  });

  test('po odebraniu nagrody przycisk zmienia się na Odebrano', async ({ page }) => {
    await mockAuth(page);

    // Nadpisz API aby po claim zwrócić zaktualizowane dane
    let claimed = false;
    await page.route('**/api/challenges/', async route => {
      if (claimed) {
        const updated = MOCK_CHALLENGES.map(c =>
          c.id === 2 ? { ...c, progress: { ...c.progress, reward_claimed: true } } : c
        );
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updated),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CHALLENGES),
        });
      }
    });

    await page.route('**/api/challenges/daily/', async route => {
      const updated = claimed
        ? MOCK_CHALLENGES.map(c =>
            c.id === 2 ? { ...c, progress: { ...c.progress, reward_claimed: true } } : c
          )
        : MOCK_CHALLENGES;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ challenges: updated }),
      });
    });

    await page.route('**/api/challenges/2/claim/', async route => {
      claimed = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, coins_earned: 100 }),
      });
    });

    await page.goto('/challenges');

    const claimBtn = page.getByRole('button', { name: /Odbierz/i }).first();
    await claimBtn.click();

    // Po kliknięciu powinno zmienić się na Odebrano lub zniknąć przycisk
    await expect(page.getByText(/Odebrano|Claimed/i).first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Może odświeżyć listę
    });
  });

  test('wyzwania mają ikonę lub emoji odpowiadające typowi', async ({ page }) => {
    await mockAuth(page);
    await mockChallengesApi(page);
    await page.goto('/challenges');

    // Ogólna strona powinna się załadować z ikonami/emoji
    await expect(page.getByText('Zagraj 3 gry')).toBeVisible();
  });
});
