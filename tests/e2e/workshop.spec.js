import { expect, test } from '@playwright/test';

test('explains an error, reveals progressive hints, and generates another attempt', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-range');

  await page.getByLabel(/network address|adresse réseau/i).fill('192.168.12.77');
  await page.getByRole('button', { name: /check|tester le réseau|vérifier/i }).click();
  await expect(page.getByRole('alert')).toContainText(/network|réseau/i);

  await page.getByRole('button', { name: /hint 1|indice 1/i }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.getByRole('button', { name: /hint 2|indice 2/i }).click();
  await expect(page.getByRole('status')).toContainText(/mask|masque/i);

  await page.getByRole('button', { name: /correction/i }).click();
  const correction = page.getByRole('region', { name: /correction/i });
  await expect(correction).toContainText('10.189.37.0');
  await expect(correction).toContainText('10.189.37.63');

  const firstSeed = await page.locator('[data-exercise-seed]').getAttribute('data-exercise-seed');
  await page.getByRole('button', { name: /new exercise|nouvel exercice/i }).click();
  await expect(page.locator('[data-exercise-seed]')).not.toHaveAttribute('data-exercise-seed', firstSeed);
});

test('keeps the active attempt intact while switching language', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-locale');
  const field = page.getByLabel(/adresse réseau/i);
  await field.fill('10.20.30.40');
  await page.getByRole('button', { name: /tester le réseau/i }).click();
  await page.getByRole('button', { name: /indice 1/i }).click();

  const seed = await page.locator('[data-exercise-seed]').getAttribute('data-exercise-seed');
  await page.getByRole('button', { name: 'EN' }).click();

  await expect(page.getByLabel(/network address/i)).toHaveValue('10.20.30.40');
  await expect(page.locator('[data-exercise-seed]')).toHaveAttribute('data-exercise-seed', seed);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('button', { name: /hint 2/i })).toBeVisible();
});

test('records a successful attempt and refreshes the shell progress', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-success');
  await page.getByLabel(/adresse réseau/i).fill('10.195.32.0');
  await page.getByRole('button', { name: /tester le réseau/i }).click();

  await expect(page.locator('[data-workshop-phase="correct"]')).toBeVisible();
  await expect(page.getByRole('banner').getByText('1 / 6')).toBeVisible();
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('subnet-notes-progress'))?.completed?.['subnet-range-1']?.attempts)).toBe(1);
});

test('workshop stays within the mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/#/workshops/subnet-range-1?seed=e2e-mobile');

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await expect(page.getByRole('button', { name: /tester le réseau/i })).toBeVisible();
});
