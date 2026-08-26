import { expect, test } from '@playwright/test';

async function missionSolutions(page, seed) {
  return page.evaluate(async (examSeed) => {
    const { generateMission } = await import('/src/exercises/generators.js');
    return [0, 1, 2].map((index) => generateMission({ seed: `${examSeed}:${index}`, difficulty: 3 }).solution);
  }, seed);
}

async function solveActiveMission(page, solution) {
  for (const [field, value] of Object.entries(solution)) {
    const deviceId = field.split('.')[0];
    await page.locator(`[data-device-id="${deviceId}"]`).click();
    await page.locator(`input[name="${field}"]`).fill(value);
  }
  await page.getByRole('button', { name: /submit mission|valider la mission/i }).click();
}

test('hides all help while timed and finalizes exactly three results on expiry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.clock.install();
  await page.goto('/#/exam?seed=e2e-expiry');

  await expect(page.getByRole('timer')).toContainText('15:00');
  await expect(page.getByRole('button', { name: /hint|indice|correction|solution/i })).toHaveCount(0);
  await page.clock.fastForward('15:00');
  const resultHeading = page.getByRole('heading', { name: /result|résultat/i });
  await expect(resultHeading).toBeVisible();
  await expect(resultHeading).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toContainText(/result|résultat|time|temps/i);
  await expect(page.locator('[data-mission-result]')).toHaveCount(3);
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('subnet-notes-progress'))?.exams?.length)).toBe(1);

  await page.reload();
  await page.clock.fastForward('15:00');
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('subnet-notes-progress'))?.exams?.length)).toBe(1);
});

test('completes all three missions early and stores a fully passed best time', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.clock.install();
  const seed = 'e2e-passed';
  await page.goto(`/#/exam?seed=${seed}`);
  const solutions = await missionSolutions(page, seed);

  for (const solution of solutions) {
    await page.clock.fastForward('00:10');
    await solveActiveMission(page, solution);
  }

  await expect(page.getByRole('heading', { name: /result|résultat/i })).toBeFocused();
  await expect(page.locator('[data-mission-result]')).toHaveCount(3);
  await expect(page.locator('[data-mission-result][data-passed="true"]')).toHaveCount(3);
  await expect.poll(async () => page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem('subnet-notes-progress'));
    return { exams: progress?.exams?.length, best: progress?.bestExamSeconds };
  })).toMatchObject({ exams: 1 });
  const storedBest = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('subnet-notes-progress'))?.bestExamSeconds);
  expect(storedBest).toBeGreaterThanOrEqual(30);
  expect(storedBest).toBeLessThan(60);
});

test('switching language preserves seed, mission, answer, result state, and elapsed time', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.clock.install();
  const seed = 'e2e-locale';
  await page.goto(`/#/exam?seed=${seed}`);
  const solutions = await missionSolutions(page, seed);
  await solveActiveMission(page, solutions[0]);
  await expect(page.getByRole('button', { name: /submit mission|valider la mission/i })).toBeFocused();
  await page.getByRole('button', { name: /alpha/i }).first().click();
  const input = page.locator('[data-device-config="alpha"] input').first();
  await input.fill('10.20.30.40');
  await input.focus();
  await input.evaluate((field) => field.setSelectionRange(3, 8));
  await page.clock.fastForward('02:05');
  const timerBefore = await page.locator('.exam-timer-value').textContent();
  expect(timerBefore).toMatch(/^12:/);
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('subnet-notes-progress'))?.exams?.length ?? 0)).toBe(0);

  await page.getByRole('button', { name: 'EN', exact: true }).evaluate((button) => button.click());

  await expect(page.locator('[data-exam-seed]')).toHaveAttribute('data-exam-seed', 'e2e-locale');
  await expect(page.getByRole('button', { name: /mission 2/i })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('button', { name: /mission 1/i })).toHaveAttribute('data-mission-status', 'passed');
  const translatedInput = page.locator('[data-device-config="alpha"] input').first();
  await expect(translatedInput).toHaveValue('10.20.30.40');
  await expect(translatedInput).toBeFocused();
  await expect.poll(async () => translatedInput.evaluate((field) => ({
    start: field.selectionStart,
    end: field.selectionEnd,
  }))).toEqual({ start: 3, end: 8 });
  const timerAfter = await page.locator('.exam-timer-value').textContent();
  const asSeconds = (value) => value.split(':').reduce((minutes, seconds) => Number(minutes) * 60 + Number(seconds));
  expect(asSeconds(timerBefore) - asSeconds(timerAfter)).toBeGreaterThanOrEqual(0);
  expect(asSeconds(timerBefore) - asSeconds(timerAfter)).toBeLessThanOrEqual(2);
  await expect(page.locator('[data-mission-result]')).toHaveCount(0);
});

test('keeps focus on mission, device, and submit controls across exam rerenders', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.clock.install();
  await page.goto('/#/exam?seed=e2e-focus');

  const missionTwo = page.getByRole('button', { name: /mission 2/i });
  await missionTwo.click();
  await expect(missionTwo).toBeFocused();

  const alpha = page.getByRole('button', { name: /alpha/i }).first();
  await alpha.click();
  await expect(alpha).toBeFocused();

  const submit = page.getByRole('button', { name: /submit mission|valider la mission/i });
  await submit.click();
  await expect(page.getByRole('button', { name: /submit mission|valider la mission/i })).toBeFocused();
});

test('starts an explicitly seeded exam from the visible final-stage action', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.clock.install();
  await page.goto('/');

  const examRow = page.locator('.ledger-row').last();
  await expect(examRow.getByRole('link', { name: /ouvrir l’étape|open stage/i })).toBeVisible();
  const start = examRow.getByRole('link', { name: /lancer l’évaluation|start mock exam/i });
  await expect(start).toBeVisible();
  const firstHref = await start.getAttribute('href');
  expect(firstHref).toMatch(/^#\/exam\?seed=mock-[a-z0-9-]+$/);
  expect(firstHref).not.toContain('undefined');

  await start.click();
  await expect(page).toHaveURL(/\/#\/exam\?seed=mock-[a-z0-9-]+$/);
  await expect(page.getByRole('timer')).toContainText('15:00');

  await page.goBack();
  const secondHref = await page.locator('.ledger-row').last()
    .getByRole('link', { name: /lancer l’évaluation|start mock exam/i }).getAttribute('href');
  expect(secondHref).not.toBe(firstHref);
});

test('stays inside the mobile viewport without exposing hints or correction', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.clock.install();
  await page.goto('/#/exam?seed=e2e-mobile');

  await expect(page.locator('[data-topology-mode="stacked"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('button', { name: /hint|indice|correction|solution/i })).toHaveCount(0);
});
