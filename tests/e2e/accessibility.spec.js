import { expect, test } from '@playwright/test';

test('supports keyboard device selection with persistent visible focus', async ({ page }) => {
  await page.goto('/#/workshops/guided-mission-1?seed=keyboard');

  const atlas = page.getByRole('button', { name: /atlas/i }).first();
  await atlas.focus();
  await expect(atlas).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(atlas).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-device-config="atlas"]')).toBeVisible();
  const focus = await atlas.evaluate((node) => {
    const style = getComputedStyle(node);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });
  expect(focus.style).not.toBe('none');
  expect(focus.width).toBeGreaterThanOrEqual(2);
});

test('keeps workshop progress and language after reload', async ({ page }) => {
  await page.goto('/#/workshops/ipv4-validity-1?seed=release-progress');

  await page.getByLabel(/ip address|adresse ip/i).fill('10.42.0.7');
  await page.getByRole('button', { name: /check|tester le réseau|vérifier/i }).click();
  await expect(page.locator('[data-workshop-phase="correct"]')).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('banner').getByText('0 / 6')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('subnet-notes-progress'));
    return {
      locale: saved?.locale,
      completed: Boolean(saved?.completed?.['ipv4-validity-1']),
    };
  })).toEqual({ locale: 'en', completed: true });
});

test('exposes meaningful names for the page landmarks and controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page.getByRole('navigation', { name: /parcours|learning path/i }).first()).toBeVisible();
  await expect(page.getByRole('group', { name: /langue|language/i })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /étapes|stages/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /accueil|home/i }).first()).toBeVisible();

  const visibleNavigationNames = await page.locator('nav').evaluateAll((landmarks) => landmarks
    .filter((landmark) => landmark.getClientRects().length > 0)
    .map((landmark) => landmark.getAttribute('aria-label')));
  expect(visibleNavigationNames.length).toBeGreaterThanOrEqual(1);
  expect(new Set(visibleNavigationNames).size).toBe(visibleNavigationNames.length);
});

test('avoids horizontal page overflow on the complete mobile path', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  for (const route of [
    '/',
    '/#/workshops/guided-mission-1?seed=release-mobile',
    '/#/exam?seed=release-mobile',
  ]) {
    await page.goto(route);
    expect(await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))).toEqual({ clientWidth: 360, scrollWidth: 360 });
  }
});

test('starts a newly selected application route at the top', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.locator('[data-workshop-link="mock-exam"]').click();

  await expect(page.locator('[data-workshop="mock-exam"]')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
