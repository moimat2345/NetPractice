import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.clock.install();
});

async function expectCountdown(page, expectedSeconds) {
  const timer = page.locator('.exam-timer-value');
  await expect(timer).toBeVisible();
  const seconds = (await timer.textContent()).split(':').reduce((minutes, part) => Number(minutes) * 60 + Number(part));
  expect(seconds).toBeLessThanOrEqual(expectedSeconds);
  expect(seconds).toBeGreaterThanOrEqual(expectedSeconds - 5);
}

test('reload and navigation resume the original deadline, mission, device, answer and check', async ({ page }) => {
  const examUrl = '/#/exam?seed=e2e-resume';
  await page.goto(examUrl);
  await page.getByRole('button', { name: /mission 2/i }).click();
  await page.locator('[data-device-id="alpha"]').click();
  const input = page.locator('[data-device-config="alpha"] input').first();
  const field = await input.getAttribute('name');
  await input.fill('10.20.30.40');
  await page.getByRole('button', { name: /submit mission|valider la mission/i }).click();
  await expect(page.locator('.exam-live-diagnostics')).toBeVisible();
  await page.clock.fastForward('02:05');
  await page.reload();

  await expectCountdown(page, 775);
  await expect(page.getByRole('button', { name: /mission 2/i })).toHaveAttribute('aria-current', 'step');
  await expect(page.locator(`input[name="${field}"]`)).toHaveValue('10.20.30.40');
  await expect(page.locator('.exam-live-diagnostics')).toBeVisible();
  await page.goto('/#/');
  await page.clock.fastForward('00:30');
  await page.goto(examUrl);
  await expectCountdown(page, 745);
  await expect(page.locator(`input[name="${field}"]`)).toHaveValue('10.20.30.40');
});

test('returning after expiry keeps the result and restarts only under a fresh exam URL', async ({ page }) => {
  await page.goto('/#/exam?seed=e2e-resume-expired');
  await page.goto('/#/');
  await page.clock.fastForward('15:30');
  await page.goto('/#/exam?seed=e2e-resume-expired');
  await expect(page.locator('[data-exam-status]')).toHaveAttribute('data-exam-status', 'expired');
  await expect(page.locator('[data-mission-result]')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('[data-exam-status]')).toHaveAttribute('data-exam-status', 'expired');
  const restart = page.getByRole('link', { name: /nouvelle évaluation|new mock exam/i });
  const href = await restart.getAttribute('href');
  expect(href).toMatch(/^#\/exam\?seed=mock-/);
  expect(href).not.toContain('e2e-resume-expired');
  await restart.click();
  await expect(page.locator('.exam-timer-value')).toHaveText('15:00');
  const results = await page.evaluate(() => JSON.parse(localStorage.getItem('subnet-notes-progress')).exams);
  expect(results).toHaveLength(1);
  expect(results[0].seed).toBe('e2e-resume-expired');
});

test('completed missions remain passed after reload and persisted sessions contain no generated solutions', async ({ page }) => {
  const seed = 'e2e-resume-passed';
  await page.goto(`/#/exam?seed=${seed}`);
  const solution = await page.evaluate(async (examSeed) => {
    const { generateMission } = await import('/src/exercises/generators.js');
    return generateMission({ seed: `${examSeed}:0`, difficulty: 3 }).solution;
  }, seed);
  for (const [field, value] of Object.entries(solution)) {
    await page.locator(`[data-device-id="${field.split('.')[0]}"]`).click();
    await page.locator(`input[name="${field}"]`).fill(value);
  }
  await page.getByRole('button', { name: /submit mission|valider la mission/i }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /mission 1/i })).toHaveAttribute('data-mission-status', 'passed');
  await expect(page.getByRole('button', { name: /mission 2/i })).toHaveAttribute('aria-current', 'step');
  const saved = await page.evaluate(() => localStorage.getItem('subnet-notes-attempts'));
  expect(saved).not.toMatch(/"solution"|"devices"|"params"|"correction"/);
});
