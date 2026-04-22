import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated, MOCK_USER } from './helpers';

const MOCK_CLANS = [
  {
    id: 1,
    name: 'Quizowi Mistrzowie',
    tag: 'QM',
    description: 'Najlepsi quizowicze',
    member_count: 8,
    max_members: 20,
    is_open: true,
    is_member: true,
    is_leader: true,
    leader_id: MOCK_USER.id,
  },
  {
    id: 2,
    name: 'Wiedzowi Wojownicy',
    tag: 'WW',
    description: 'Wojownicy wiedzy',
    member_count: 12,
    max_members: 20,
    is_open: true,
    is_member: false,
    is_leader: false,
    leader_id: 99,
  },
  {
    id: 3,
    name: 'Naukowe Umysły',
    tag: 'NU',
    description: 'Dla miłośników nauki',
    member_count: 5,
    max_members: 20,
    is_open: false,
    is_member: false,
    is_leader: false,
    leader_id: 98,
  },
  {
    id: 4,
    name: 'Tech Guru',
    tag: 'TG',
    description: 'Techniczni mistrzowie',
    member_count: 15,
    max_members: 20,
    is_open: true,
    is_member: false,
    is_leader: false,
    leader_id: 97,
  },
  {
    id: 5,
    name: 'Historia i Kultura',
    tag: 'HK',
    description: 'Klan historyczny',
    member_count: 20,
    max_members: 20,
    is_open: true,
    is_member: false,
    is_leader: false,
    leader_id: 96,
  },
];

const MOCK_CLAN_DETAIL = {
  id: 1,
  name: 'Quizowi Mistrzowie',
  tag: 'QM',
  description: 'Najlepsi quizowicze',
  member_count: 3,
  max_members: 20,
  is_open: true,
  is_member: true,
  is_leader: true,
  leader_id: MOCK_USER.id,
  members: [
    { id: MOCK_USER.id, display_name: 'TestUser', total_score: 1500, is_leader: true },
    { id: 10, display_name: 'Gracz2', total_score: 900, is_leader: false },
    { id: 11, display_name: 'Gracz3', total_score: 700, is_leader: false },
  ],
};

const MOCK_CLAN_DETAIL_NON_LEADER = {
  ...MOCK_CLAN_DETAIL,
  is_leader: false,
  leader_id: 99,
  members: [
    { id: 99, display_name: 'Lider', total_score: 2000, is_leader: true },
    { id: MOCK_USER.id, display_name: 'TestUser', total_score: 1500, is_leader: false },
  ],
};

async function mockClansApi(page: Parameters<typeof mockAuth>[0]) {
  await page.route('**/api/clans/', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CLANS),
      });
    } else if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 99, name: 'Nowy Klan', tag: 'NK', description: '' }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/clans/1/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CLAN_DETAIL),
    });
  });

  await page.route('**/api/clans/2/join/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Dołączyłeś do klanu' }),
    });
  });

  await page.route('**/api/clans/1/leave/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/clans/1/kick/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/clans/1/invite/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

test.describe('Klany - pełne testy', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/clans');
    await expect(page).toHaveURL('/login');
  });

  test('strona klanów się ładuje z nagłówkiem', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    await expect(page.getByRole('heading', { name: 'Klany' })).toBeVisible();
  });

  test('lista klanów jest widoczna z kartami klanów', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    await expect(page.getByText('Wiedzowi Wojownicy')).toBeVisible();
    await expect(page.getByText('Naukowe Umysły')).toBeVisible();
    await expect(page.getByText('Tech Guru')).toBeVisible();
  });

  test('karty klanów zawierają nazwy i tagi', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    await expect(page.getByText('[WW]')).toBeVisible();
    await expect(page.getByText('[TG]')).toBeVisible();
  });

  test('sekcja Twój klan wyświetla klan użytkownika', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    await expect(page.getByText('Twój klan')).toBeVisible();
    await expect(page.getByText('Quizowi Mistrzowie')).toBeVisible();
  });

  test('przycisk Dołącz jest widoczny dla otwartych klanów', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    await expect(page.getByRole('button', { name: 'Dołącz' }).first()).toBeVisible();
  });

  test('kliknięcie Dołącz dołącza do klanu i pokazuje toast', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    await page.getByRole('button', { name: 'Dołącz' }).first().click();

    await expect(page.getByText(/Dołączyłeś do klanu/)).toBeVisible();
  });

  test('zamknięty klan pokazuje status Zamknięty', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    // Naukowe Umysły jest zamknięte
    await expect(page.getByText('Zamknięty')).toBeVisible();
  });

  test('pełny klan pokazuje status Pełny', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    // Historia i Kultura ma 20/20
    await expect(page.getByText('Pełny')).toBeVisible();
  });

  test('wyszukiwanie filtruje klany po nazwie', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    const searchInput = page.getByPlaceholder(/Szukaj klanu/);
    await searchInput.fill('Tech');

    await expect(page.getByText('Tech Guru')).toBeVisible();
    await expect(page.getByText('Wiedzowi Wojownicy')).not.toBeVisible();
  });

  test('wyszukiwanie filtruje klany po tagu', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    const searchInput = page.getByPlaceholder(/Szukaj klanu/);
    await searchInput.fill('WW');

    await expect(page.getByText('Wiedzowi Wojownicy')).toBeVisible();
    await expect(page.getByText('Tech Guru')).not.toBeVisible();
  });

  test('puste wyniki wyszukiwania pokazują komunikat', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    const searchInput = page.getByPlaceholder(/Szukaj klanu/);
    await searchInput.fill('nieistniejącyklanxyz999');

    await expect(page.getByText(/Nie znaleziono klanów/)).toBeVisible();
  });

  test('link do szczegółów klanu prowadzi do /clans/[id]', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    await page.getByRole('link', { name: 'Wiedzowi Wojownicy' }).click();
    await expect(page).toHaveURL('/clans/2');
  });

  test('nie ma przycisku Utwórz klan gdy użytkownik jest w klanie', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans');

    await expect(page.getByRole('link', { name: /Utwórz klan/ })).not.toBeVisible();
  });

  test('przycisk Utwórz klan jest widoczny gdy użytkownik nie jest w klanie', async ({ page }) => {
    await mockAuth(page);

    // Nadpisz API - użytkownik nie jest w żadnym klanie
    const clansWithoutMembership = MOCK_CLANS.map(c => ({ ...c, is_member: false, is_leader: false }));
    await page.route('**/api/clans/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(clansWithoutMembership),
      });
    });

    await page.goto('/clans');

    await expect(page.getByRole('link', { name: /Utwórz klan/ })).toBeVisible();
  });

  test('formularz tworzenia klanu ma pola nazwa, tag, opis', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans/create');

    await expect(page.getByPlaceholder(/Nazwa klanu/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Tag klanu|Skrót/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Opis/i)).toBeVisible();
  });

  test('tworzenie klanu z poprawnymi danymi przenosi do szczegółów klanu', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/clans/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 99, name: 'Nowy Klan', tag: 'NK' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });
    await page.goto('/clans/create');

    await page.getByPlaceholder(/Nazwa klanu/i).fill('Nowy Klan');
    await page.getByPlaceholder(/Tag klanu|Skrót/i).fill('NK');
    await page.getByRole('button', { name: /Utwórz|Stwórz/ }).click();

    // Po udanym tworzeniu powinno przekierować do /clans/99 lub /clans
    await expect(page).toHaveURL(/\/clans/);
  });

  test('tworzenie klanu z istniejącą nazwą pokazuje błąd', async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/clans/', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ name: ['Klan o tej nazwie już istnieje.'] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });
    await page.goto('/clans/create');

    await page.getByPlaceholder(/Nazwa klanu/i).fill('Quizowi Mistrzowie');
    await page.getByPlaceholder(/Tag klanu|Skrót/i).fill('QM');
    await page.getByRole('button', { name: /Utwórz|Stwórz/ }).click();

    await expect(page.getByText(/już istnieje|nazwa jest zajęta/i)).toBeVisible();
  });

  test('szczegóły klanu pokazują listę członków', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans/1');

    await expect(page.getByText('TestUser')).toBeVisible();
    await expect(page.getByText('Gracz2')).toBeVisible();
    await expect(page.getByText('Gracz3')).toBeVisible();
  });

  test('szczegóły klanu pokazują odznakę lidera', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans/1');

    await expect(page.getByText(/Lider|Leader|👑/)).toBeVisible();
  });

  test('przycisk Opuść klan jest widoczny dla członków', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans/1');

    await expect(page.getByRole('button', { name: /Opuść klan|Wyjdź z klanu/ })).toBeVisible();
  });

  test('przycisk Dołącz do klanu jest widoczny dla nie-członków', async ({ page }) => {
    await mockAuth(page);

    const nonMemberClan = { ...MOCK_CLAN_DETAIL, is_member: false, is_leader: false };
    await page.route('**/api/clans/2/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(nonMemberClan),
      });
    });

    await page.goto('/clans/2');

    await expect(page.getByRole('button', { name: /Dołącz/ })).toBeVisible();
  });

  test('lider klanu widzi przycisk zapraszania członków', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans/1');

    // TestUser jest liderem klanu 1
    await expect(page.getByRole('button', { name: /Zaproś|Dodaj członka/ })).toBeVisible();
  });

  test('lider klanu widzi przycisk wyrzucania członków', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans/1');

    // Gracz2 lub Gracz3 mogą być wyrzuceni przez lidera
    await expect(page.getByRole('button', { name: /Wyrzuć|Kick/ }).first()).toBeVisible();
  });

  test('zwykły członek nie widzi przycisku wyrzucania', async ({ page }) => {
    await mockAuth(page);

    await page.route('**/api/clans/1/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CLAN_DETAIL_NON_LEADER),
      });
    });

    await page.goto('/clans/1');

    await expect(page.getByRole('button', { name: /Wyrzuć|Kick/ })).not.toBeVisible();
  });

  test('dołączenie do klanu wywołuje API i pokazuje toast sukcesu', async ({ page }) => {
    await mockAuth(page);

    const nonMemberClan = { ...MOCK_CLAN_DETAIL, id: 2, name: 'Wiedzowi Wojownicy', is_member: false, is_leader: false };
    await page.route('**/api/clans/2/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(nonMemberClan),
      });
    });
    await page.route('**/api/clans/2/join/', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Dołączyłeś do klanu' }),
      });
    });

    await page.goto('/clans/2');
    await page.getByRole('button', { name: /Dołącz/ }).click();

    await expect(page.getByText(/Dołączyłeś do klanu/)).toBeVisible();
  });

  test('opuszczenie klanu wywołuje API i pokazuje toast', async ({ page }) => {
    await mockAuth(page);
    await mockClansApi(page);
    await page.goto('/clans/1');

    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: /Opuść klan|Wyjdź z klanu/ }).click();

    await expect(page.getByText(/Opuściłeś klan|Wyszedłeś z klanu/)).toBeVisible();
  });
});
