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

const workshopIds = [
  'ipv4-validity-1', 'ipv4-octets-2',
  'mask-conversion-1', 'subnet-range-1', 'usable-host-2', 'same-subnet-3',
  'neighbors-1', 'switch-segment-2',
  'router-interface-1', 'valid-gateway-2', 'direct-network-3',
  'route-parts-1', 'default-route-2', 'packet-path-3', 'return-path-4', 'routing-mission-5',
  'guided-mission-1', 'guided-mission-2', 'mock-exam',
];

function storedProgress(locale, completedIds) {
  return {
    version: 1,
    locale,
    completed: Object.fromEntries(completedIds.map((id) => [id, { attempts: 1 }])),
    current: null,
    exams: [],
    bestExamSeconds: null,
  };
}

test('shows the learning path and switches language without reload', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Subnet Notes — Apprendre IPv4 et le routage en pratiquant');
  await expect(page.getByRole('banner')).toContainText('Subnet Notes');
  const navigation = page.locator('nav.curriculum-nav');
  await expect(navigation).toHaveAttribute('aria-label', 'Parcours');
  if (testInfo.project.name !== 'mobile') await expect(navigation).toBeVisible();

  await page.getByRole('banner').evaluate((banner) => {
    banner.dataset.beforeLanguageSwitch = 'same-shell';
  });
  await page.getByRole('button', { name: 'EN' }).click();

  await expect(navigation).toHaveAttribute('aria-label', 'Learning path');
  await expect(page).toHaveTitle('Subnet Notes — Learn IPv4 and routing by doing');
  if (testInfo.project.name !== 'mobile') await expect(navigation).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('banner')).toHaveAttribute('data-before-language-switch', 'same-shell');
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('subnet-notes-progress'))?.locale)).toBe('en');
});

test('renders with in-memory progress when browser storage access is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage access denied', 'SecurityError');
      },
    });
  });

  await page.goto('/');

  await expect(page.getByRole('banner')).toContainText('Subnet Notes');
  await expect(page.getByRole('main')).toContainText('Construis ton raisonnement');
});

test('restores saved progress in the shell', async ({ page }) => {
  const saved = storedProgress('en', [
    'ipv4-validity-1', 'ipv4-octets-2',
    'mask-conversion-1', 'subnet-range-1', 'usable-host-2', 'same-subnet-3',
    'removed-workshop',
  ]);
  await page.addInitScript((value) => {
    localStorage.setItem('subnet-notes-progress', JSON.stringify(value));
  }, saved);

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('banner').getByText('2 / 6')).toBeVisible();
});

test('keeps a partial stage in progress and resumes its first unfinished workshop', async ({ page }) => {
  const saved = storedProgress('en', [
    'ipv4-validity-1',
    'ipv4-octets-2',
    'subnet-range-1',
  ]);
  await page.addInitScript((value) => {
    localStorage.setItem('subnet-notes-progress', JSON.stringify(value));
  }, saved);

  await page.goto('/');

  await expect(page.getByRole('banner').getByText('1 / 6')).toBeVisible();
  const subnetStage = page.locator('.ledger-row').filter({ hasText: 'Masks and networks' });
  await expect(subnetStage).not.toHaveClass(/is-complete/);
  await expect(subnetStage).toContainText('In progress');
  await expect(page.locator('.button-primary')).toHaveAttribute('href', '#/workshops/mask-conversion-1');
  await expect(page.locator('[data-workshop-link]')).toHaveCount(19);
  await expect(page.locator('[data-workshop-link="mock-exam"]')).toBeVisible();
  await expect(page.locator('.ledger-row').last().locator('.ledger-exam-link')).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.button-primary')).toHaveAttribute('href', '#/workshops/mask-conversion-1');
});

test('offers the mock exam after all nineteen workshops are complete', async ({ page }) => {
  const saved = storedProgress('en', workshopIds);
  await page.addInitScript((value) => {
    localStorage.setItem('subnet-notes-progress', JSON.stringify(value));
  }, saved);

  await page.goto('/');

  await expect(page.getByRole('banner').getByText('6 / 6')).toBeVisible();
  await expect(page.locator('.button-primary')).toHaveText('Start mock exam');
  await expect(page.locator('.button-primary')).toHaveAttribute('href', /^#\/exam\?seed=/);
  await expect(page.locator('[data-workshop-link]')).toHaveCount(19);
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
  test.skip(['mobile', 'portrait'].includes(testInfo.project.name));
  await page.goto('/#/workshops/ipv4-validity-1');
  const link = page.getByRole('navigation').getByRole('link', { name: /adresses ipv4/i });

  await link.focus();
  await link.click();

  await expect(link).toBeFocused();
  await expect.poll(async () => page.evaluate(() => location.hash)).toBe('#/workshops/ipv4-validity-1');
});

test('marks the stage of the workshop being viewed instead of the first unfinished stage', async ({ page }, testInfo) => {
  test.skip(['mobile', 'portrait'].includes(testInfo.project.name));
  await page.goto('/#/workshops/valid-gateway-2');

  const gateways = page.locator('[data-stage-id="gateways"]');
  await expect(gateways).toHaveClass(/is-current/);
  await expect(gateways).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.curriculum-link.is-current')).toHaveCount(1);
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
