import { expect, test } from '@playwright/test';

test('shows the learning path and switches language without reload', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toContainText('Subnet Notes');
  const navigation = page.locator('nav.curriculum-nav');
  await expect(navigation).toHaveAttribute('aria-label', 'Parcours');
  if (testInfo.project.name !== 'mobile') await expect(navigation).toBeVisible();

  await page.getByRole('banner').evaluate((banner) => {
    banner.dataset.beforeLanguageSwitch = 'same-shell';
  });
  await page.getByRole('button', { name: 'EN' }).click();

  await expect(navigation).toHaveAttribute('aria-label', 'Learning path');
  if (testInfo.project.name !== 'mobile') await expect(navigation).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('banner')).toHaveAttribute('data-before-language-switch', 'same-shell');
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('subnet-notes-progress'))?.locale)).toBe('en');
});

test('restores saved progress in the shell', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('subnet-notes-progress', JSON.stringify({
      version: 1,
      locale: 'en',
      completed: {
        'ipv4-validity-1': { attempts: 1 },
        'subnet-range-1': { attempts: 2 },
      },
      current: null,
      exams: [],
      bestExamSeconds: null,
    }));
  });

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('banner').getByText('2 / 6')).toBeVisible();
});

test('keeps the home page usable without horizontal overflow on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/');

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

  const primaryAction = page.getByRole('link', { name: /commencer le premier atelier/i });
  await expect(primaryAction).toBeVisible();
  const box = await primaryAction.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
});
