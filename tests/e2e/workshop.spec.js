import { expect, test } from '@playwright/test';

test('explains an error, reveals progressive hints, and generates another attempt', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-range');

  await page.getByLabel(/network address|adresse réseau/i).fill('192.168.12.77');
  await page.getByRole('button', { name: /check|tester le réseau|vérifier/i }).click();
  await expect(page.getByRole('button', { name: /check|tester le réseau|vérifier/i })).toBeFocused();
  await expect(page.getByRole('alert')).toContainText(/network|réseau/i);

  await page.getByRole('button', { name: /hint 1|indice 1/i }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('button', { name: /hint 2|indice 2/i })).toBeFocused();
  await page.getByRole('button', { name: /hint 2|indice 2/i }).click();
  await expect(page.getByRole('status')).toContainText(/mask|masque/i);

  await page.getByRole('button', { name: /correction/i }).click();
  const correction = page.getByRole('region', { name: /correction/i });
  await expect(correction).toContainText('10.189.37.0');
  await expect(correction).toContainText('10.189.37.63');

  const firstSeed = await page.locator('[data-exercise-seed]').getAttribute('data-exercise-seed');
  await page.getByRole('button', { name: /new variation|nouvelle variante/i }).click();
  await expect(page.locator('[data-exercise-seed]')).not.toHaveAttribute('data-exercise-seed', firstSeed);
});

test('keeps the active attempt intact while switching language', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-locale');
  const field = page.getByLabel(/adresse réseau/i);
  await field.fill('10.20.30.40');
  await page.getByRole('button', { name: /tester le réseau/i }).click();
  await page.getByRole('button', { name: /indice 1/i }).click();

  await field.focus();
  await field.evaluate((input) => input.setSelectionRange(3, 8));

  const seed = await page.locator('[data-exercise-seed]').getAttribute('data-exercise-seed');
  await page.getByRole('button', { name: 'EN' }).evaluate((button) => button.click());

  const translatedField = page.getByLabel(/network address/i);
  await expect(translatedField).toHaveValue('10.20.30.40');
  await expect(translatedField).toBeFocused();
  await expect.poll(async () => translatedField.evaluate((input) => ({
    start: input.selectionStart,
    end: input.selectionEnd,
  }))).toEqual({ start: 3, end: 8 });
  await expect(page.locator('[data-exercise-seed]')).toHaveAttribute('data-exercise-seed', seed);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('button', { name: /hint 2/i })).toBeVisible();
});

test('renders the workshop lesson module and translates it without losing focus', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=lesson-module');

  const lesson = page.locator('[data-workshop-lesson="subnet-range-1"]');
  await expect(lesson.getByRole('heading', { level: 1 })).toHaveText('Trouve les limites du réseau');
  await expect(lesson).toContainText('blocs de 32');
  await lesson.locator('summary').click();
  await expect(lesson.getByRole('listitem')).toHaveCount(3);
  await expect(lesson).toContainText('Prêt à borner un sous-réseau');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Calcule les adresses réseau et de diffusion du bloc.');

  const field = page.getByLabel(/adresse réseau/i);
  await field.fill('10.20.30.40');
  await field.focus();
  await field.evaluate((input) => input.setSelectionRange(3, 8));
  await page.getByRole('button', { name: 'EN' }).evaluate((button) => button.click());

  await expect(lesson.getByRole('heading', { level: 1 })).toHaveText('Find the subnet boundaries');
  await expect(lesson).toContainText('blocks of 32');
  await expect(lesson).toContainText('Ready to bound a subnet');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Calculate the network and broadcast addresses of the block.');
  await expect(page.getByLabel(/network address/i)).toHaveValue('10.20.30.40');
  await expect(page.getByLabel(/network address/i)).toBeFocused();
  await expect.poll(async () => page.getByLabel(/network address/i).evaluate((input) => ({
    start: input.selectionStart,
    end: input.selectionEnd,
  }))).toEqual({ start: 3, end: 8 });
});

test('recreates a workshop when only its route seed changes', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=route-seed-a');
  const field = page.getByLabel(/adresse réseau/i);
  await field.fill('keep-me-only-for-a');

  await page.evaluate(() => {
    location.hash = '#/workshops/subnet-range-1?seed=route-seed-b';
  });

  await expect(page.locator('[data-exercise-seed]')).toHaveAttribute('data-exercise-seed', 'route-seed-b');
  await expect(page.getByLabel(/adresse réseau/i)).toHaveValue('');
});

test('records a successful attempt and refreshes the shell progress', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('subnet-notes-progress', JSON.stringify({
      version: 1,
      locale: 'fr',
      completed: {
        'mask-conversion-1': { attempts: 1 },
        'usable-host-2': { attempts: 1 },
        'same-subnet-3': { attempts: 1 },
      },
      current: null,
      exams: [],
      bestExamSeconds: null,
    }));
  });
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-success');
  await expect(page.getByRole('banner').getByText('3 / 19')).toBeVisible();
  await page.getByLabel(/adresse réseau/i).fill('10.195.32.0');
  await page.getByLabel(/adresse de diffusion/i).fill('10.195.32.63');
  await page.getByRole('button', { name: /tester le réseau/i }).click();

  await expect(page.locator('[data-workshop-phase="correct"]')).toBeVisible();
  await expect(page.getByRole('banner').getByText('4 / 19')).toBeVisible();
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('subnet-notes-progress'))?.completed?.['subnet-range-1']?.attempts)).toBe(1);

  await expect(page.getByRole('button', { name: /nouvelle variante/i })).toBeVisible();
  const nextWorkshop = page.getByRole('button', { name: /atelier suivant/i });
  await expect(nextWorkshop).toBeVisible();
  await expect(page.getByRole('button', { name: /tester le réseau|indice/i })).toHaveCount(0);
  await expect(page.locator('.workshop-actions .button').first()).toHaveText(/nouvelle variante/i);
  await expect(page.locator('.workshop-actions .button').last()).toHaveText(/atelier suivant/i);
  await nextWorkshop.click();
  await expect(page.locator('[data-workshop="usable-host-2"]')).toBeVisible();
});

test('opens the timed exam from the final workshop success action', async ({ page }) => {
  const seed = 'e2e-final-workshop';
  await page.goto(`/#/workshops/mock-exam?seed=${seed}`);
  const solution = await page.evaluate(async (workshopSeed) => {
    const { getWorkshopGenerator } = await import('/src/exercises/generators.js');
    return getWorkshopGenerator('mock-exam')({ seed: workshopSeed }).solution;
  }, seed);

  for (const [field, value] of Object.entries(solution)) {
    const deviceId = field.split('.')[0];
    await page.locator(`[data-device-id="${deviceId}"]`).click();
    await page.locator(`input[name="${field}"]`).fill(value);
  }
  await page.getByRole('button', { name: /tester le réseau|test the network/i }).click();

  const startExam = page.getByRole('button', { name: /lancer l’évaluation|start mock exam/i });
  await expect(startExam).toBeVisible();
  await startExam.click();
  await expect(page).toHaveURL(/\/#\/exam\?seed=mock-/);
  await expect(page.getByRole('timer')).toBeVisible();
});

test('workshop stays within the mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-mobile');

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await expect(page.getByRole('button', { name: /tester le réseau/i })).toBeVisible();
});
