import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

const MOCK_PACKS = [
  {
    id: 1,
    name: 'Moja paczka historyczna',
    description: 'Pytania z historii',
    question_count: 5,
    is_public: false,
    is_mine: true,
  },
  {
    id: 2,
    name: 'Paczka naukowa',
    description: 'Pytania z nauki',
    question_count: 10,
    is_public: true,
    is_mine: true,
  },
];

const MOCK_PACK_DETAIL = {
  id: 1,
  name: 'Moja paczka historyczna',
  description: 'Pytania z historii',
  is_public: false,
  questions: [
    {
      id: 101,
      content: 'Kiedy wybuchła II Wojna Światowa?',
      options: ['1937', '1938', '1939', '1940'],
      correct: 'C',
      emoji: '⚔️',
    },
  ],
};

async function mockPacksApi(page: Parameters<typeof mockAuth>[0]) {
  await page.route('**/api/packs/', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PACKS),
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 3, name: 'Nowa paczka', question_count: 0, is_public: false, is_mine: true }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/packs/create/', async route => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 3, name: 'Nowa paczka', question_count: 0 }),
    });
  });

  await page.route('**/api/packs/1/', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PACK_DETAIL),
      });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/packs/1/questions/', async route => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 102, content: 'Nowe pytanie?', options: ['A', 'B', 'C', 'D'], correct: 'A' }),
    });
  });

  await page.route('**/api/packs/1/questions/101/', async route => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
    } else {
      await route.continue();
    }
  });
}

test.describe('Paczki pytań (custom packs)', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/packs');
    await expect(page).toHaveURL('/login');
  });

  test('lista paczek się ładuje', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(page.getByRole('heading', { name: 'Paczki pytań' })).toBeVisible();
    await expect(page.getByText('Moja paczka historyczna')).toBeVisible();
    await expect(page.getByText('Paczka naukowa')).toBeVisible();
  });

  test('pusta lista pokazuje komunikat i przycisk tworzenia', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/packs/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/packs');

    await expect(page.getByText('Nie masz jeszcze żadnych paczek pytań')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Utwórz pierwszą paczkę' })).toBeVisible();
  });

  test('przycisk "+ Nowa paczka" prowadzi do /packs/create', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await page.getByRole('link', { name: '+ Nowa paczka' }).click();
    await expect(page).toHaveURL('/packs/create');
  });

  test('paczka publiczna ma odznakę "Publiczna"', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(page.getByText('Publiczna')).toBeVisible();
  });

  test('własna paczka ma przyciski Edytuj i Usuń', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(page.getByRole('button', { name: 'Edytuj' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Usuń' }).first()).toBeVisible();
  });

  test('strona tworzenia paczki ma formularz', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/packs/create');

    await expect(page.getByRole('heading', { name: 'Nowa paczka pytań' })).toBeVisible();
    await expect(page.getByPlaceholder('Moja paczka')).toBeVisible();
  });

  test('tworzenie paczki z wypełnionym formularzem', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/packs/create/', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 99, name: 'Test Pack' }),
      });
    });
    await page.goto('/packs/create');

    await page.getByPlaceholder('Moja paczka').fill('Test Pack');
  });

  test('strona edycji paczki wyświetla pytania', async ({ page }) => {
    await mockAuth(page);

    await page.route('**/api/packs/1/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PACK_DETAIL),
      });
    });

    await page.goto('/packs/1/edit');

    await expect(page.getByText('Kiedy wybuchła II Wojna Światowa?')).toBeVisible();
  });

  test('usunięcie paczki wymaga potwierdzenia i pokazuje toast', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    // Mockuj confirm dialog - akceptuj
    page.on('dialog', dialog => dialog.accept());

    await page.getByRole('button', { name: 'Usuń' }).first().click();

    await expect(page.getByText('Paczka usunięta')).toBeVisible();
    await expect(page.getByText('Moja paczka historyczna')).not.toBeVisible();
  });

  test('paczki widać przy tworzeniu pokoju', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/packs/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PACKS),
      });
    });
    await page.goto('/create');

    // Przełącz na tryb "Moja paczka"
    const packTab = page.getByRole('button', { name: /Moja paczka/i });
    await expect(packTab).toBeVisible();
    await packTab.click();

    await expect(page.getByText('Moja paczka historyczna')).toBeVisible();
  });
});
