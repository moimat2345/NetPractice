import { expect, test } from '@playwright/test';

function rgbChannels(value) {
  const color = value.trim();
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  }
  return color.match(/[\d.]+/g).slice(0, 3).map(Number);
}

function relativeLuminance(color) {
  const channels = rgbChannels(color).map((channel) => channel / 255).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

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
        'removed-workshop': { attempts: 3 },
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

test('skip navigation focuses main content without changing the application route', async ({ page }) => {
  await page.goto('/#/workshops/ipv4-validity-1');
  const initialHash = await page.evaluate(() => location.hash);
  const skipLink = page.getByRole('link', { name: /contenu principal|main content/i });

  await skipLink.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('#main-content')).toBeFocused();
  await expect.poll(async () => page.evaluate(() => location.hash)).toBe(initialHash);
});

test('same-route navigation keeps focus on the activated link', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile');
  await page.goto('/#/workshops/ipv4-validity-1');
  const link = page.getByRole('navigation').getByRole('link', { name: /adresses ipv4/i });

  await link.focus();
  await link.click();

  await expect(link).toBeFocused();
  await expect.poll(async () => page.evaluate(() => location.hash)).toBe('#/workshops/ipv4-validity-1');
});

test('safe DOM helpers ignore string event-handler attributes', async ({ page }) => {
  await page.goto('/');

  const attributes = await page.evaluate(async () => {
    const { element } = await import('/src/ui/dom.js');
    const button = element('button', { onClick: 'globalThis.compromised = true' });
    return button.getAttributeNames();
  });

  expect(attributes.map((name) => name.toLowerCase())).not.toContain('onclick');
});

test('normal text and the primary action meet WCAG AA contrast', async ({ page }) => {
  await page.goto('/');

  const colors = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const action = getComputedStyle(document.querySelector('.button-primary'));
    return {
      muted: root.getPropertyValue('--muted-ink'),
      paper: root.getPropertyValue('--paper'),
      actionText: action.color,
      actionBackground: action.backgroundColor,
    };
  });

  expect(contrastRatio(colors.muted, colors.paper)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(colors.actionText, colors.actionBackground)).toBeGreaterThanOrEqual(4.5);
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
