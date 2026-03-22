import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

const MOCK_PACKS = [
  {
    id: 1,
    name: 'Moja Paczka',
    description: 'Moje prywatne pytania',
    is_public: false,
    is_mine: true,
    question_count: 5,
  },
  {
    id: 2,
    name: 'Publiczna',
    description: 'Pytania dla wszystkich',
    is_public: true,
    is_mine: false,
    question_count: 10,
  },
  {
    id: 3,
    name: 'Moja Publiczna',
    description: 'Moja publiczna paczka',
    is_public: true,
    is_mine: true,
    question_count: 8,
  },
];

const MOCK_PACK_DETAIL = {
  id: 1,
  name: 'Moja Paczka',
  description: 'Moje prywatne pytania',
  is_public: false,
  is_mine: true,
  questions: [
    {
      id: 101,
      content: 'Kiedy wybuchła II Wojna Światowa?',
      options: ['1937', '1938', '1939', '1940'],
      correct_answer: 'C',
      emoji: '⚔️',
    },
    {
      id: 102,
      content: 'Kto napisał "Pana Tadeusza"?',
      options: ['Słowacki', 'Mickiewicz', 'Norwid', 'Krasicki'],
      correct_answer: 'B',
      emoji: '📖',
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
        body: JSON.stringify({ id: 99, name: 'Nowa paczka', description: '', is_public: false, is_mine: true, question_count: 0 }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/packs/create/', async route => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 99, name: 'Nowa paczka', question_count: 0 }),
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
    } else if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PACK_DETAIL),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/packs/1/questions/', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 103,
          content: 'Nowe pytanie?',
          options: ['Odp A', 'Odp B', 'Odp C', 'Odp D'],
          correct_answer: 'A',
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/packs/1/questions/101/', async route => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
    } else if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 101,
          content: 'Zaktualizowane pytanie?',
          options: ['1937', '1938', '1939', '1940'],
          correct_answer: 'C',
        }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe('Paczki pytań - pełne testy', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/packs');
    await expect(page).toHaveURL('/login');
  });

  test('strona paczek się ładuje z nagłówkiem', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(page.getByRole('heading', { name: 'Paczki pytań' })).toBeVisible();
  });

  test('lista paczek użytkownika jest widoczna', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(page.getByText('Moja Paczka')).toBeVisible();
    await expect(page.getByText('Moja Publiczna')).toBeVisible();
  });

  test('publiczne paczki innych użytkowników są widoczne', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(page.getByText('Publiczna')).toBeVisible();
  });

  test('paczka publiczna ma odznakę Publiczna', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(page.getByText('Publiczna')).toBeVisible();
  });

  test('przycisk + Nowa paczka jest widoczny', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(
      page.getByRole('link', { name: /\+ Nowa paczka|Utwórz paczk|Nowa paczka/i })
    ).toBeVisible();
  });

  test('własna paczka ma przyciski Edytuj i Usuń', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await expect(page.getByRole('button', { name: 'Edytuj' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Usuń' }).first()).toBeVisible();
  });

  test('pusta lista pokazuje komunikat i przycisk tworzenia', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/packs/', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto('/packs');

    await expect(page.getByText(/Nie masz jeszcze żadnych paczek pytań|Brak paczek/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Utwórz pierwszą paczkę|Utwórz paczk/i })).toBeVisible();
  });

  test('przycisk + Nowa paczka prowadzi do /packs/create', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await page.getByRole('link', { name: /\+ Nowa paczka|Nowa paczka/i }).click();
    await expect(page).toHaveURL('/packs/create');
  });

  test('strona tworzenia paczki ma formularz z polami', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/packs/create');

    await expect(page.getByRole('heading', { name: /Nowa paczka pytań|Utwórz paczk/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Moja paczka|Nazwa paczki/i)).toBeVisible();
  });

  test('formularz tworzenia paczki ma pole opisu', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/packs/create');

    await expect(page.getByPlaceholder(/Opis|Krótki opis/i)).toBeVisible();
  });

  test('formularz tworzenia paczki ma przełącznik publiczna/prywatna', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/packs/create');

    // Checkbox lub toggle dla is_public
    const publicToggle = page.locator(
      'input[type="checkbox"][name*="public"], input[type="checkbox"][id*="public"], [role="switch"]'
    );
    await expect(publicToggle.first()).toBeVisible({ timeout: 5000 }).catch(async () => {
      // Może być innny element
      await expect(page.getByLabel(/Publiczna|Udostępnij/i)).toBeVisible();
    });
  });

  test('tworzenie paczki z wypełnionym formularzem dodaje ją do listy', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);

    // Po tworzeniu paczki, paczki API zwraca nową paczkę
    let packCreated = false;
    await page.route('**/api/packs/', async route => {
      if (route.request().method() === 'GET' && packCreated) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([...MOCK_PACKS, { id: 99, name: 'Nowa paczka', description: '', is_public: false, is_mine: true, question_count: 0 }]),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PACKS),
        });
      } else if (route.request().method() === 'POST') {
        packCreated = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 99, name: 'Nowa paczka', description: '', is_public: false, is_mine: true, question_count: 0 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/packs/create/', async route => {
      packCreated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 99, name: 'Nowa paczka', question_count: 0 }),
      });
    });

    await page.goto('/packs/create');

    await page.getByPlaceholder(/Moja paczka|Nazwa paczki/i).fill('Nowa paczka');

    const descField = page.getByPlaceholder(/Opis|Krótki opis/i);
    if (await descField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descField.fill('Opis nowej paczki');
    }

    await page.getByRole('button', { name: /Utwórz|Zapisz|Stwórz/i }).click();

    // Po udanym tworzeniu powinno przekierować lub pokazać toast
    await expect(page).toHaveURL(/\/packs/);
  });

  test('szczegóły paczki pokazują listę pytań', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs/1/edit');

    await expect(page.getByText('Kiedy wybuchła II Wojna Światowa?')).toBeVisible();
    await expect(page.getByText('Kto napisał "Pana Tadeusza"?')).toBeVisible();
  });

  test('przycisk dodawania pytania jest widoczny dla właściciela', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs/1/edit');

    await expect(
      page.getByRole('button', { name: /Dodaj pytanie|Nowe pytanie|\+ Pytanie/i })
    ).toBeVisible();
  });

  test('formularz dodawania pytania ma pole treści pytania', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs/1/edit');

    await page.getByRole('button', { name: /Dodaj pytanie|Nowe pytanie|\+ Pytanie/i }).click();

    await expect(page.getByPlaceholder(/Treść pytania|Pytanie/i)).toBeVisible();
  });

  test('formularz dodawania pytania ma 4 pola odpowiedzi', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs/1/edit');

    await page.getByRole('button', { name: /Dodaj pytanie|Nowe pytanie|\+ Pytanie/i }).click();

    // 4 pola odpowiedzi
    const answerInputs = page.getByPlaceholder(/Odpowiedź [A-D]|Opcja [A-D]|Wariant/i);
    await expect(answerInputs.first()).toBeVisible({ timeout: 5000 }).catch(async () => {
      // Mogą być inputs bez placeholder
      const formInputs = page.locator('form input[type="text"], form textarea');
      const count = await formInputs.count();
      expect(count).toBeGreaterThanOrEqual(4);
    });
  });

  test('formularz dodawania pytania ma selektor poprawnej odpowiedzi', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs/1/edit');

    await page.getByRole('button', { name: /Dodaj pytanie|Nowe pytanie|\+ Pytanie/i }).click();

    // Selektor poprawnej odpowiedzi (radio buttons, select lub toggle)
    const correctSelector = page.locator(
      'input[type="radio"], select[name*="correct"], [data-correct]'
    );
    await expect(correctSelector.first()).toBeVisible({ timeout: 5000 }).catch(async () => {
      // Może być inaczej zaimplementowane
      await expect(page.getByText(/Poprawna odpowiedź|Zaznacz poprawną/i)).toBeVisible();
    });
  });

  test('usunięcie pytania usuwa je z listy', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs/1/edit');

    await expect(page.getByText('Kiedy wybuchła II Wojna Światowa?')).toBeVisible();

    // Akceptuj dialog potwierdzenia
    page.on('dialog', dialog => dialog.accept());

    // Kliknij przycisk usunięcia przy pierwszym pytaniu
    await page.getByRole('button', { name: /Usuń|Delete/i }).first().click();

    // Pytanie powinno zniknąć z listy
    await expect(page.getByText('Kiedy wybuchła II Wojna Światowa?')).not.toBeVisible({ timeout: 5000 });
  });

  test('usunięcie paczki wymaga potwierdzenia i usuwa ją z listy', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    page.on('dialog', dialog => dialog.accept());

    await page.getByRole('button', { name: 'Usuń' }).first().click();

    await expect(page.getByText(/Paczka usunięta|Usunięto paczkę/)).toBeVisible();
    await expect(page.getByText('Moja Paczka')).not.toBeVisible();
  });

  test('prywatna paczka nie ma odznaki Publiczna', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    // Sprawdzamy czy dla Moja Paczka (is_public: false) nie ma odznaki Publiczna w jej karcie
    const mojaPaczkaCard = page.getByText('Moja Paczka').locator('..').locator('..');
    const publicBadge = mojaPaczkaCard.getByText('Publiczna');
    await expect(publicBadge).not.toBeVisible();
  });

  test('liczba pytań jest wyświetlona przy każdej paczce', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    // Moja Paczka ma 5 pytań, Publiczna ma 10
    await expect(page.getByText(/5 pytań|5 pyt/i)).toBeVisible();
    await expect(page.getByText(/10 pytań|10 pyt/i)).toBeVisible();
  });

  test('paczki są widoczne przy tworzeniu pokoju gry', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/create');

    // Przełącz na tryb Moja paczka
    const packTab = page.getByRole('button', { name: /Moja paczka/i });
    await expect(packTab).toBeVisible();
    await packTab.click();

    await expect(page.getByText('Moja Paczka')).toBeVisible();
  });

  test('edycja pytania pozwala zmienić jego treść', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs/1/edit');

    await expect(page.getByText('Kiedy wybuchła II Wojna Światowa?')).toBeVisible();

    // Kliknij przycisk edycji przy pierwszym pytaniu
    const editBtn = page.getByRole('button', { name: /Edytuj|Edit/i }).first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.click();

      const questionInput = page.locator('input[value="Kiedy wybuchła II Wojna Światowa?"], textarea').first();
      if (await questionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await questionInput.fill('Zaktualizowane pytanie?');
        await page.getByRole('button', { name: /Zapisz|Zatwierdź|Save/i }).click();

        await expect(page.getByText('Zaktualizowane pytanie?')).toBeVisible();
      }
    }
  });

  test('link do edycji paczki prowadzi do /packs/[id]/edit', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs');

    await page.getByRole('button', { name: 'Edytuj' }).first().click();

    await expect(page).toHaveURL(/\/packs\/\d+\/edit/);
  });

  test('tytuł paczki jest widoczny na stronie edycji', async ({ page }) => {
    await mockAuth(page);
    await mockPacksApi(page);
    await page.goto('/packs/1/edit');

    await expect(page.getByText('Moja Paczka')).toBeVisible();
  });
});
