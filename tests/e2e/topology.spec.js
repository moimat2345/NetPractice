import { expect, test } from '@playwright/test';

const missionUrl = '/#/workshops/guided-mission-1?seed=responsive';
const branchMissionUrl = '/#/workshops/guided-mission-2?seed=responsive';

async function layoutProblems(page) {
  return page.locator('[data-topology]').evaluate((canvas) => {
    const bounds = canvas.getBoundingClientRect();
    const nodes = [...canvas.querySelectorAll('[data-device-id]')]
      .map((node) => ({ id: node.dataset.deviceId, rect: node.getBoundingClientRect() }));
    const problems = [];
    nodes.forEach(({ id, rect }, index) => {
      if (rect.left < bounds.left || rect.right > bounds.right
        || rect.top < bounds.top || rect.bottom > bounds.bottom) problems.push(`clipped:${id}`);
      nodes.slice(index + 1).forEach(({ id: otherId, rect: other }) => {
        if (Math.min(rect.right, other.right) > Math.max(rect.left, other.left)
          && Math.min(rect.bottom, other.bottom) > Math.max(rect.top, other.top)) {
          problems.push(`overlap:${id}:${otherId}`);
        }
      });
    });
    return problems;
  });
}

test('keeps every branch device separate and inside a resized container', async ({ page }, testInfo) => {
  test.skip(!['desktop', 'portrait'].includes(testInfo.project.name));
  await page.goto(branchMissionUrl);
  await expect(page.locator('[data-device-id]')).toHaveCount(8);
  await expect.poll(() => layoutProblems(page)).toEqual([]);
  // A workspace can shrink without a viewport resize (e.g. alongside another panel).
  await page.locator('[data-topology]').evaluate((canvas) => { canvas.style.width = '560px'; });
  await expect.poll(() => layoutProblems(page)).toEqual([]);
  await expect.poll(async () => (await linkMetrics(page)).every((link) =>
    link.renderedStart <= 1 && link.renderedEnd <= 1)).toBe(true);
  await page.locator('[data-topology]').evaluate((canvas) => { canvas.style.width = '320px'; });
  await expect(page.locator('[data-topology-mode="stacked"]')).toBeVisible();
  await expect(page.locator('[data-device-id="grove"] [data-neighbor-id="delta"]')).toBeVisible();
  await expect.poll(() => layoutProblems(page)).toEqual([]);
  await page.locator('[data-topology]').evaluate((canvas) => { canvas.style.width = '560px'; });
  await expect(page.locator('[data-topology-mode="diagram"]')).toBeVisible();
  await expect.poll(() => layoutProblems(page)).toEqual([]);
  await expect.poll(async () => (await linkMetrics(page)).every((link) =>
    link.renderedStart <= 1 && link.renderedEnd <= 1)).toBe(true);
});

test('fits the desktop branch diagram in 500 pixels without shrinking device labels', async ({ page }, testInfo) => {
  test.skip(!['desktop', 'portrait'].includes(testInfo.project.name));
  await page.goto(branchMissionUrl);
  const canvas = page.locator('[data-topology]');
  for (const width of [500, 560, 650]) {
    await canvas.evaluate((element, nextWidth) => { element.style.width = `${nextWidth}px`; }, width);
    await expect(canvas).toHaveAttribute('data-topology-mode', 'diagram');
    await expect.poll(async () => (await canvas.boundingBox()).height).toBeLessThanOrEqual(500);
    await expect.poll(() => layoutProblems(page)).toEqual([]);
    const fontSizes = await canvas.locator('[data-device-id] strong').evaluateAll((labels) =>
      labels.map((label) => Number.parseFloat(getComputedStyle(label).fontSize)));
    expect(fontSizes.every((size) => size >= 12)).toBe(true);
    await expect.poll(async () => (await linkMetrics(page)).every((link) =>
      link.renderedStart <= 1 && link.renderedEnd <= 1)).toBe(true);
  }
});

test('shows the actual branch neighbors on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto(branchMissionUrl);
  const grove = page.locator('[data-device-id="grove"]');
  await expect(grove.locator('[data-neighbor-id]')).toHaveCount(3);
  expect(await grove.locator('[data-neighbor-id]').evaluateAll((neighbors) =>
    neighbors.map((neighbor) => neighbor.dataset.neighborId).sort())).toEqual(['delta', 'echo', 'relay']);
  await expect(grove).toContainText(/relié à|connected to/i);
  for (const neighbor of await grove.locator('[data-neighbor-id]').all()) await expect(neighbor).toBeVisible();
  await expect(page.locator('[data-device-id="delta"] [data-neighbor-id="grove"]')).toBeVisible();
  await page.locator('[data-device-id="delta"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-device-config="delta"]')).toBeVisible();
  await expect(page.locator('[data-device-id="delta"]')).toBeFocused();
});

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

test('uses packet-ordered neighbor cards without horizontal overflow on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto(missionUrl);

  await expect(page.locator('[data-topology-mode="stacked"]')).toBeVisible();
  await expect(page.locator('[data-topology] svg')).toBeHidden();
  const deviceOrder = await page.locator('[data-device-id]').evaluateAll((nodes) =>
    nodes.map((node) => node.dataset.deviceId));
  expect(deviceOrder).toEqual(['internet', 'atlas', 'orme', 'alpha', 'gamma', 'boreal', 'beta']);
  await expect(page.locator('[data-device-id="alpha"] [data-neighbor-id="orme"]')).toBeVisible();
  await page.getByRole('button', { name: /alpha/i }).first().click();
  const controlMetrics = await page.locator('[data-device-config="alpha"] input').first().evaluate((input) => {
    const style = getComputedStyle(input);
    return { fontSize: Number.parseFloat(style.fontSize), height: input.getBoundingClientRect().height };
  });
  expect(controlMetrics.fontSize).toBeGreaterThanOrEqual(16);
  expect(controlMetrics.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
