import { test, expect } from '@playwright/test';
import { mockAuth, mockUnauthenticated } from './helpers';

const MOCK_SHOP_ITEMS = [
  {
    id: 1,
    name: 'Lis',
    description: 'Rudy lisek',
    item_type: 'avatar',
    price: 0,
    emoji_icon: '🦊',
    is_active: true,
  },
  {
    id: 2,
    name: 'Robot',
    description: 'Metalowy robot',
    item_type: 'avatar',
    price: 100,
    emoji_icon: '🤖',
    is_active: false,
  },
  {
    id: 3,
    name: 'Smok',
    description: 'Ognisty smok',
    item_type: 'avatar',
    price: 200,
    emoji_icon: '🐉',
    is_active: false,
  },
  {
    id: 4,
    name: 'Ninja',
    description: 'Tajemniczy ninja',
    item_type: 'avatar',
    price: 500,
    emoji_icon: '🥷',
    is_active: false,
  },
  {
    id: 5,
    name: 'Kosmita',
    description: 'Zielony kosmita',
    item_type: 'avatar',
    price: 999,
    emoji_icon: '👽',
    is_active: false,
  },
  {
    id: 6,
    name: '50/50',
    description: 'Usuwa dwie złe odpowiedzi',
    item_type: 'power_up',
    price: 50,
    emoji_icon: '✂️',
    is_active: false,
  },
  {
    id: 7,
    name: '+15 sekund',
    description: 'Dodaje 15 sekund',
    item_type: 'power_up',
    price: 75,
    emoji_icon: '⏱️',
    is_active: false,
  },
  {
    id: 8,
    name: 'x2 Punkty',
    description: 'Podwaja punkty za rundę',
    item_type: 'power_up',
    price: 100,
    emoji_icon: '✨',
    is_active: false,
  },
  {
    id: 9,
    name: 'Ciemny (domyślny)',
    description: 'Ciemny motyw interfejsu',
    item_type: 'theme',
    price: 0,
    emoji_icon: '🌑',
    is_active: true,
  },
  {
    id: 10,
    name: 'Galaktyczny',
    description: 'Motyw kosmiczny',
    item_type: 'theme',
    price: 150,
    emoji_icon: '🌌',
    is_active: false,
  },
  {
    id: 11,
    name: 'Oceaniczny',
    description: 'Motyw podmorski',
    item_type: 'theme',
    price: 150,
    emoji_icon: '🌊',
    is_active: false,
  },
  {
    id: 12,
    name: 'Leśny',
    description: 'Zielony motyw leśny',
    item_type: 'theme',
    price: 200,
    emoji_icon: '🌿',
    is_active: false,
  },
];

const MOCK_INVENTORY = [
  { item_id: 1, item_type: 'avatar', quantity: 1, is_active: true },
  { item_id: 2, item_type: 'avatar', quantity: 1, is_active: false },
  { item_id: 6, item_type: 'power_up', quantity: 3, is_active: false },
  { item_id: 9, item_type: 'theme', quantity: 1, is_active: true },
];

async function mockShopApis(page: Parameters<typeof mockAuth>[0], coins = 350) {
  await page.route('**/api/shop/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SHOP_ITEMS),
    });
  });

  await page.route('**/api/shop/inventory/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_INVENTORY),
    });
  });

  await page.route('**/api/shop/coins/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ coins }),
    });
  });

  await page.route('**/api/shop/buy/', async route => {
    const body = route.request().postDataJSON();
    const item = MOCK_SHOP_ITEMS.find(i => i.id === body?.item_id);
    const newCoins = coins - (item?.price ?? 0);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, new_balance: newCoins }),
    });
  });

  await page.route('**/api/shop/equip/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

test.describe('Sklep - pełne testy', () => {
  test('niezalogowany użytkownik jest przekierowywany do /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/shop');
    await expect(page).toHaveURL('/login');
  });

  test('strona sklepu się ładuje z nagłówkiem', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await expect(page.getByRole('heading', { name: 'Sklep' })).toBeVisible();
  });

  test('balans monet jest wyświetlany na stronie', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    await expect(page.getByText('350')).toBeVisible();
  });

  test('trzy zakładki Avatary, Power-upy, Motywy są widoczne', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await expect(page.getByRole('button', { name: /Avatary/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Power-upy/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Motywy/ })).toBeVisible();
  });

  test('zakładka Avatary jest domyślnie otwarta i pokazuje itemy', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await expect(page.getByText('Lis')).toBeVisible();
    await expect(page.getByText('Robot')).toBeVisible();
    await expect(page.getByText('Smok')).toBeVisible();
  });

  test('avatary mają etykiety z ceną', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    // Smok kosztuje 200 monet
    await expect(page.getByText('200')).toBeVisible();
  });

  test('przycisk kupna avatara otwiera modal potwierdzenia', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    // Smok - item do kupienia
    await page.getByText('Smok').click();

    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await expect(page.getByText(/200 monet/)).toBeVisible();
  });

  test('potwierdzenie zakupu odejmuje monety i pokazuje toast', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    await page.getByText('Smok').click();
    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await page.getByRole('button', { name: 'Kup teraz' }).click();

    // Balans 350 - 200 = 150
    await expect(page.getByText('150')).toBeVisible();
    await expect(page.getByText(/Kupiono avatar Smok/)).toBeVisible();
  });

  test('anulowanie zakupu zamyka modal bez odejmowania monet', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    await page.getByText('Smok').click();
    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await page.getByRole('button', { name: 'Anuluj' }).click();

    await expect(page.getByText('Potwierdzenie zakupu')).not.toBeVisible();
    // Balans bez zmian
    await expect(page.getByText('350')).toBeVisible();
  });

  test('cena avatara za drogiego jest wyświetlana na czerwono', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    // Ninja kosztuje 500, mamy 350 - za mało
    const ninjaCard = page.getByText('Ninja').locator('..').locator('..');
    const priceEl = ninjaCard.locator('.text-red-400, .text-red-500, .text-red-600');
    await expect(priceEl).toBeVisible();
  });

  test('niewystarczające monety - modal informuje o braku środków', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    // Kosmita kosztuje 999, mamy 350
    await page.getByText('Kosmita').click();
    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();

    // Przycisk Kup teraz jest disabled lub niewidoczny
    const buyNow = page.getByRole('button', { name: 'Kup teraz' });
    const isDisabled = await buyNow.isDisabled().catch(() => true);
    expect(isDisabled).toBeTruthy();

    await page.getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.getByText('Potwierdzenie zakupu')).not.toBeVisible();
  });

  test('posiadany item ma odznakę Posiadasz', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    // Robot jest w inventory
    await expect(page.getByText('Posiadasz')).toBeVisible();
  });

  test('aktywny item ma oznaczenie aktywności', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    // Lis jest aktywnym avatarem
    await expect(page.getByText('✓ Aktywny')).toBeVisible();
  });

  test('posiadany nieaktywny item ma przycisk Aktywuj', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    // Robot jest w inventory, ale nie jest aktywny
    const robotCard = page.getByText('Robot').locator('..').locator('..');
    const equipBtn = robotCard.getByRole('button', { name: /Aktywuj|Ustaw aktywny/ });
    await expect(equipBtn).toBeVisible();
  });

  test('aktywowanie itemu wywołuje API equip i pokazuje toast', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    const robotCard = page.getByText('Robot').locator('..').locator('..');
    const equipBtn = robotCard.getByRole('button', { name: /Aktywuj|Ustaw aktywny/ });
    await equipBtn.click();

    await expect(page.getByText(/Aktywowano|Ustawiono aktywny/)).toBeVisible();
  });

  test('zakładka Power-upy pokazuje dostępne power-upy', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Power-upy/ }).click();

    await expect(page.getByText('50/50')).toBeVisible();
    await expect(page.getByText('+15 sekund')).toBeVisible();
    await expect(page.getByText('x2 Punkty')).toBeVisible();
  });

  test('power-up pokazuje liczbę posiadanych sztuk z inventory', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Power-upy/ }).click();

    // 50/50 ma quantity: 3 w inventory
    await expect(page.getByText(/Posiadasz: 3 szt/)).toBeVisible();
  });

  test('zakładka Power-upy pokazuje przyciski Kup', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Power-upy/ }).click();

    const buyButtons = page.getByRole('button', { name: 'Kup' });
    await expect(buyButtons.first()).toBeVisible();
  });

  test('zakup power-upa otwiera modal i aktualizuje balans', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Power-upy/ }).click();

    // x2 Punkty kosztuje 100 monet, mamy 350
    const x2Card = page.getByText('x2 Punkty').locator('..').locator('..');
    await x2Card.getByRole('button', { name: 'Kup' }).click();

    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await page.getByRole('button', { name: 'Kup teraz' }).click();

    // 350 - 100 = 250
    await expect(page.getByText('250')).toBeVisible();
  });

  test('zakładka Motywy pokazuje dostępne motywy', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Motywy/ }).click();

    await expect(page.getByText('Ciemny (domyślny)')).toBeVisible();
    await expect(page.getByText('Galaktyczny')).toBeVisible();
    await expect(page.getByText('Oceaniczny')).toBeVisible();
    await expect(page.getByText('Leśny')).toBeVisible();
  });

  test('domyślny motyw ma oznaczenie Posiadasz', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Motywy/ }).click();

    // Ciemny (domyślny) jest w inventory
    await expect(page.getByText('Posiadasz').first()).toBeVisible();
  });

  test('kupno motywu otwiera modal i po potwierdzeniu aktualizuje balans', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Motywy/ }).click();

    // Leśny kosztuje 200 monet, mamy 350
    await page.getByText('Leśny').locator('..').locator('..').getByRole('button', { name: 'Kup' }).click();

    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await page.getByRole('button', { name: 'Kup teraz' }).click();

    // 350 - 200 = 150
    await expect(page.getByText('150')).toBeVisible();
    await expect(page.getByText(/Kupiono motyw Leśny/)).toBeVisible();
  });

  test('motyw już posiadany nie ma przycisku Kup', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    await page.getByRole('button', { name: /Motywy/ }).click();

    // Ciemny jest w inventory - nie powinno być przycisku Kup dla niego
    const ciemnyCard = page.getByText('Ciemny (domyślny)').locator('..').locator('..');
    const buyBtn = ciemnyCard.getByRole('button', { name: 'Kup' });
    await expect(buyBtn).not.toBeVisible();
  });

  test('zmiana zakładki z Avatary na Power-upy i z powrotem', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page);
    await page.goto('/shop');

    // Przejdź do Power-upów
    await page.getByRole('button', { name: /Power-upy/ }).click();
    await expect(page.getByText('50/50')).toBeVisible();
    await expect(page.getByText('Lis')).not.toBeVisible();

    // Wróć do Avatarów
    await page.getByRole('button', { name: /Avatary/ }).click();
    await expect(page.getByText('Lis')).toBeVisible();
    await expect(page.getByText('50/50')).not.toBeVisible();
  });

  test('modal zakupu zawiera nazwę i cenę itemu', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    await page.getByText('Smok').click();

    await expect(page.getByText('Potwierdzenie zakupu')).toBeVisible();
    await expect(page.getByText('Smok')).toBeVisible();
    await expect(page.getByText(/200/)).toBeVisible();
  });

  test('balans wyświetla słowo monet obok liczby', async ({ page }) => {
    await mockAuth(page);
    await mockShopApis(page, 350);
    await page.goto('/shop');

    await expect(page.getByText('350')).toBeVisible();
    await expect(page.getByText(/monet/i)).toBeVisible();
  });
});
