import { test, expect } from '@playwright/test';
import { mockAuth, MOCK_USER, MOCK_ROOM_CODE } from './helpers';

/** Uruchamia grę z aktywnym pytaniem przez WebSocket */
async function setupGameWithQuestion(page: Parameters<typeof mockAuth>[0]) {
  await mockAuth(page);

  await page.goto('/');
  await page.evaluate(
    ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
    [MOCK_ROOM_CODE, MOCK_USER.display_name],
  );

  await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
    ws.onMessage(data => {
      const msg = JSON.parse(data as string);

      if (msg.type === 'join') {
        ws.send(JSON.stringify({
          type: 'question',
          round_number: 1,
          total_rounds: 5,
          question: 'Kto napisał "Pan Tadeusz"?',
          options: ['Adam Mickiewicz', 'Juliusz Słowacki', 'Zygmunt Krasiński', 'Cyprian Kamil Norwid'],
        }));
      }

      if (msg.type === 'use_powerup') {
        if (msg.powerup === 'fifty_fifty') {
          ws.send(JSON.stringify({
            type: 'powerup_result',
            powerup: 'fifty_fifty',
            removed_options: ['B', 'C'],
          }));
        }
        if (msg.powerup === 'extra_time') {
          ws.send(JSON.stringify({
            type: 'powerup_result',
            powerup: 'extra_time',
            extra_seconds: 15,
          }));
        }
        if (msg.powerup === 'double_points') {
          ws.send(JSON.stringify({
            type: 'powerup_result',
            powerup: 'double_points',
          }));
        }
      }
    });
  });

  await page.goto(`/room/${MOCK_ROOM_CODE}/game`);
  await expect(page.getByText('Kto napisał "Pan Tadeusz"?')).toBeVisible();
}

test.describe('Power-upy w grze', () => {
  test('przyciski power-upów są widoczne podczas pytania', async ({ page }) => {
    await setupGameWithQuestion(page);

    await expect(page.getByTitle('50/50')).toBeVisible();
    await expect(page.getByTitle('+15s')).toBeVisible();
    await expect(page.getByTitle('×2 pkt')).toBeVisible();
  });

  test('przycisk 50/50 ma etykietę ½', async ({ page }) => {
    await setupGameWithQuestion(page);

    await expect(page.getByText('½')).toBeVisible();
  });

  test('przycisk +15s ma etykietę ⏱', async ({ page }) => {
    await setupGameWithQuestion(page);

    await expect(page.getByText('⏱')).toBeVisible();
  });

  test('przycisk ×2 ma etykietę ×2', async ({ page }) => {
    await setupGameWithQuestion(page);

    await expect(page.getByText('×2')).toBeVisible();
  });

  test('kliknięcie 50/50 eliminuje 2 opcje', async ({ page }) => {
    await setupGameWithQuestion(page);

    await page.getByTitle('50/50').click();

    // B i C powinny stać się niewidoczne (opacity-0)
    await page.waitForTimeout(300);

    // Po 50/50 opcje B i C znikają - sprawdź czy ich tekst jest ukryty
    const optionB = page.getByRole('button', { name: /B\./ });
    const optionC = page.getByRole('button', { name: /C\./ });

    // Elementy mogą mieć klasy opacity-0 lub pointer-events-none
    const bClass = await optionB.getAttribute('class');
    const cClass = await optionC.getAttribute('class');

    expect(bClass + cClass).toMatch(/opacity-0|pointer-events-none/);
  });

  test('po użyciu 50/50 przycisk jest wyłączony', async ({ page }) => {
    await setupGameWithQuestion(page);

    const fiftyBtn = page.getByTitle('50/50');
    await fiftyBtn.click();

    // Sprawdź że przycisk jest disabled lub ma klasę opacity-30
    await page.waitForTimeout(300);
    const isDisabled = await fiftyBtn.isDisabled();
    const btnClass = await fiftyBtn.getAttribute('class');

    expect(isDisabled || (btnClass ?? '').includes('opacity-30')).toBeTruthy();
  });

  test('po użyciu extra_time przycisk jest wyłączony', async ({ page }) => {
    await setupGameWithQuestion(page);

    const timeBtn = page.getByTitle('+15s');
    await timeBtn.click();

    await page.waitForTimeout(300);
    const isDisabled = await timeBtn.isDisabled();
    const btnClass = await timeBtn.getAttribute('class');

    expect(isDisabled || (btnClass ?? '').includes('opacity-30')).toBeTruthy();
  });

  test('double_points aktywuje żółty styl przycisku', async ({ page }) => {
    await setupGameWithQuestion(page);

    const doubleBtn = page.getByTitle('×2 pkt');
    await doubleBtn.click();

    await page.waitForTimeout(300);
    const btnClass = await doubleBtn.getAttribute('class');
    expect(btnClass).toContain('yellow');
  });

  test('power-upy są wyłączone po wysłaniu odpowiedzi', async ({ page }) => {
    await mockAuth(page);
    await page.goto('/');
    await page.evaluate(
      ([code, nick]) => sessionStorage.setItem(`nick_${code}`, nick),
      [MOCK_ROOM_CODE, MOCK_USER.display_name],
    );

    await page.routeWebSocket(`**/ws/room/${MOCK_ROOM_CODE}/`, ws => {
      ws.onMessage(data => {
        const msg = JSON.parse(data as string);
        if (msg.type === 'join') {
          ws.send(JSON.stringify({
            type: 'question',
            round_number: 1,
            total_rounds: 5,
            question: 'Kto napisał "Pan Tadeusz"?',
            options: ['Adam Mickiewicz', 'Juliusz Słowacki', 'Zygmunt Krasiński', 'Cyprian Kamil Norwid'],
          }));
        }
        if (msg.type === 'answer') {
          ws.send(JSON.stringify({
            type: 'answer_result',
            is_correct: true,
            correct_answer: 'A',
            explanation: 'Test',
            points_earned: 1000,
            total_score: 1000,
          }));
        }
      });
    });

    await page.goto(`/room/${MOCK_ROOM_CODE}/game`);
    await expect(page.getByText('Kto napisał "Pan Tadeusz"?')).toBeVisible();

    // Kliknij odpowiedź
    await page.getByText('Adam Mickiewicz').click();
    await page.waitForTimeout(300);

    // Po odpowiedzi power-upy powinny być disabled (phase != 'question')
    const fiftyBtn = page.getByTitle('50/50');
    const isDisabled = await fiftyBtn.isDisabled();
    const btnClass = await fiftyBtn.getAttribute('class');
    expect(isDisabled || (btnClass ?? '').includes('opacity-30')).toBeTruthy();
  });

  test('każdy power-up można użyć tylko raz na rundę', async ({ page }) => {
    await setupGameWithQuestion(page);

    const fiftyBtn = page.getByTitle('50/50');
    await fiftyBtn.click();
    await page.waitForTimeout(300);

    // Drugi klik nie powinien nic zrobić (przycisk jest disabled)
    const isDisabled = await fiftyBtn.isDisabled();
    const btnClass = await fiftyBtn.getAttribute('class');
    expect(isDisabled || (btnClass ?? '').includes('opacity')).toBeTruthy();
  });
});
