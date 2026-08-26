import { expect, test } from '@playwright/test';

const missionUrl = '/#/workshops/guided-mission-1?seed=responsive';

async function linkMetrics(page) {
  return page.locator('[data-topology]').evaluate((canvas) => {
    const nodes = new Map([...canvas.querySelectorAll('[data-device-id]')]
      .map((node) => [node.dataset.deviceId, node.getBoundingClientRect()]));
    return [...canvas.querySelectorAll('[data-link]')].map((path) => {
      const source = nodes.get(path.dataset.source);
      const target = nodes.get(path.dataset.target);
      const values = path.getAttribute('data-endpoints').split(',').map(Number);
      const matrix = path.getScreenCTM();
      const renderedStartPoint = path.getPointAtLength(0).matrixTransform(matrix);
      const renderedEndPoint = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix);
      const distance = (x, y, rect) => Math.hypot(
        Math.max(rect.left - x, 0, x - rect.right),
        Math.max(rect.top - y, 0, y - rect.bottom),
      );
      return {
        attributeStart: distance(values[0], values[1], source),
        attributeEnd: distance(values[2], values[3], target),
        renderedStart: distance(renderedStartPoint.x, renderedStartPoint.y, source),
        renderedEnd: distance(renderedEndPoint.x, renderedEndPoint.y, target),
      };
    });
  });
}

for (const project of ['ultrawide', 'desktop', 'portrait']) {
  test(`keeps every topology link attached in ${project}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== project);
    await page.goto(missionUrl);

    if (project === 'portrait') {
      await expect(page.locator('.curriculum-sidebar')).toBeHidden();
    }
    await expect.poll(() => linkMetrics(page)).toHaveLength(6);
    expect((await linkMetrics(page)).every((link) =>
      link.attributeStart <= 1
      && link.attributeEnd <= 1
      && link.renderedStart <= 1
      && link.renderedEnd <= 1)).toBe(true);
  });
}

test('recomputes attached endpoints after resizing the same page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto(missionUrl);
  await expect.poll(() => linkMetrics(page)).toHaveLength(6);

  await page.setViewportSize({ width: 1024, height: 1000 });
  await expect.poll(async () => (await linkMetrics(page)).every((link) =>
    link.renderedStart <= 1 && link.renderedEnd <= 1)).toBe(true);
  await page.setViewportSize({ width: 2200, height: 1000 });
  await expect.poll(async () => (await linkMetrics(page)).every((link) =>
    link.renderedStart <= 1 && link.renderedEnd <= 1)).toBe(true);
});

test('selects devices with the keyboard and edits only the selected configuration', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto(missionUrl);

  const alpha = page.getByRole('button', { name: /alpha/i }).first();
  await alpha.focus();
  await page.keyboard.press('Enter');
  await expect(alpha).toHaveAttribute('aria-pressed', 'true');

  const editor = page.locator('[data-device-config="alpha"]');
  const address = editor.getByLabel(/ip address|adresse ip/i);
  await address.fill('10.77.88.99');

  await page.getByRole('button', { name: /atlas/i }).first().click();
  await expect(page.locator('[data-device-config="alpha"]')).toHaveCount(0);
  await page.getByRole('button', { name: /alpha/i }).first().click();
  await expect(page.locator('[data-device-config="alpha"]').getByLabel(/ip address|adresse ip/i))
    .toHaveValue('10.77.88.99');

  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.locator('[data-device-config="alpha"]').getByLabel(/ip address/i))
    .toHaveValue('10.77.88.99');
});

test('shows switch connectivity without inventing IP controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.goto(missionUrl);

  await page.getByRole('button', { name: /orme/i }).click();
  const switchPanel = page.locator('[data-device-config="orme"]');
  await expect(switchPanel).toContainText(/segment|lan/i);
  await expect(switchPanel.locator('input')).toHaveCount(0);
});

test('does not enqueue link work after the topology is destroyed', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.addInitScript(() => {
    let resolveFonts;
    const ready = new Promise((resolve) => {
      resolveFonts = resolve;
    });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } });
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    let frameRequests = 0;
    window.requestAnimationFrame = (callback) => {
      frameRequests += 1;
      return nativeRequestAnimationFrame(callback);
    };
    window.__topologyLifecycle = {
      get frameRequests() { return frameRequests; },
      resolveFonts,
    };
  });
  await page.goto(missionUrl);
  await expect.poll(() => linkMetrics(page)).toHaveLength(6);

  await page.evaluate(() => {
    location.hash = '#/';
  });
  await expect(page.locator('[data-topology]')).toHaveCount(0);
  await page.waitForTimeout(50);
  const before = await page.evaluate(() => window.__topologyLifecycle.frameRequests);
  await page.evaluate(() => window.__topologyLifecycle.resolveFonts());
  await page.waitForTimeout(50);

  expect(await page.evaluate(() => window.__topologyLifecycle.frameRequests)).toBe(before);
});

test('uses a packet-ordered stacked list without horizontal overflow on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto(missionUrl);

  await expect(page.locator('[data-topology-mode="stacked"]')).toBeVisible();
  await expect(page.locator('[data-topology] svg')).toBeHidden();
  const deviceOrder = await page.locator('[data-device-id]').evaluateAll((nodes) =>
    nodes.map((node) => node.dataset.deviceId));
  expect(deviceOrder).toEqual(['internet', 'atlas', 'orme', 'alpha', 'gamma', 'boreal', 'beta']);
  await page.getByRole('button', { name: /alpha/i }).first().click();
  const controlMetrics = await page.locator('[data-device-config="alpha"] input').first().evaluate((input) => {
    const style = getComputedStyle(input);
    return { fontSize: Number.parseFloat(style.fontSize), height: input.getBoundingClientRect().height };
  });
  expect(controlMetrics.fontSize).toBeGreaterThanOrEqual(16);
  expect(controlMetrics.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
