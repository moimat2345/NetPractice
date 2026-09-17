import { expect, test } from '@playwright/test';

test('editing a validated answer clears success and permits a new check', async ({ page }) => {
  await page.goto('/#/workshops/ipv4-validity-1?seed=stale-success');
  const input = page.locator('.workshop-form input').first();
  await input.fill('192.168.1.1');
  await page.locator('.workshop-actions button[type="submit"]').click();
  await expect(page.locator('[data-workshop-phase="correct"]')).toBeVisible();
  await input.fill('999.999.999.999');
  await expect(page.locator('[data-workshop-phase="ready"]')).toBeVisible();
  await expect(page.locator('.workshop-feedback .feedback-success')).toHaveCount(0);
  await page.locator('.workshop-actions button[type="submit"]').click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('reload preserves workshop draft, hints and selected device', async ({ page }) => {
  await page.goto('/#/workshops/valid-gateway-2?seed=resume-workshop');
  const field = page.locator('.workshop-form input').first();
  const name = await field.getAttribute('name');
  await field.fill('10.2.3.4');
  await page.getByRole('button', { name: /indice 1/i }).click();
  const device = page.locator('[data-device-id]').last();
  const deviceId = await device.getAttribute('data-device-id');
  await device.click();
  await page.reload();
  await expect(page.locator('[data-device-config]')).toHaveAttribute('data-device-config', deviceId);
  await expect(page.getByRole('button', { name: /indice 2/i })).toBeVisible();
  await page.locator('[data-device-id]').first().click();
  await expect(page.locator(`input[name="${name}"]`)).toHaveValue('10.2.3.4');
});

test('a new variant updates the URL and survives reload', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=variant-original');
  await page.locator('.workshop-actions button[type="submit"]').click();
  await page.getByRole('button', { name: /nouvelle variante/i }).click();
  await expect(page).not.toHaveURL(/seed=variant-original$/);
  await expect(page.locator('[data-exercise-seed]')).not.toHaveAttribute('data-exercise-seed', 'variant-original');
  const seed = await page.locator('[data-exercise-seed]').getAttribute('data-exercise-seed');
  await page.reload();
  await expect(page.locator('[data-exercise-seed]')).toHaveAttribute('data-exercise-seed', seed);
});

test('mobile has an accessible workshop menu and a nearby first input', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/#/workshops/ipv4-validity-1?seed=mobile-workspace');
  expect((await page.locator('.workshop-form input').first().boundingBox()).y).toBeLessThan(700);
  await page.locator('.mobile-curriculum summary').click();
  await expect(page.locator('.mobile-curriculum [data-curriculum-workshop]')).toHaveCount(19);
  await page.locator('.mobile-curriculum [data-curriculum-workshop="return-path-4"]').click();
  await expect(page.locator('[data-workshop="return-path-4"]')).toBeVisible();
  await expect(page.locator('[data-exercise-goals]')).toBeVisible();
});

test('an empty answer identifies its field and the edit action focuses it', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=empty-answer');
  await page.locator('.workshop-actions button[type="submit"]').click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Renseigne le champ');
  await expect(alert).toContainText('Adresse réseau');
  await alert.getByRole('button', { name: /Modifier/i }).click();
  await expect(page.getByLabel('Adresse réseau', { exact: true })).toBeFocused();
});

test('device picker selects a configuration without scrolling through the map', async ({ page }, testInfo) => {
  test.skip(['desktop', 'ultrawide'].includes(testInfo.project.name), 'Wide screens use the adjacent diagram.');
  await page.goto('/#/workshops/guided-mission-2?seed=device-picker');
  const picker = page.getByLabel('Appareil à configurer');
  await picker.focus();
  await picker.selectOption('grove');
  await expect(page.locator('[data-device-config="grove"]')).toBeVisible();
  await expect(page.locator('[data-device-id="grove"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(picker).toBeFocused();
  await page.reload();
  await expect(picker).toHaveValue('grove');
});

test('the exam timer stays in view while configuring a device', async ({ page }) => {
  await page.goto('/#/exam?seed=sticky-timer');
  await page.locator('.exam-form .workshop-actions').scrollIntoViewIfNeeded();
  const box = await page.getByRole('timer').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize().height);
});

test('returning through workshop navigation resumes the chosen variant', async ({ page }) => {
  await page.goto('/#/workshops/subnet-range-1?seed=my-selected-variant');
  await page.getByLabel('Adresse réseau', { exact: true }).fill('10.20.30.0');
  await page.locator('.workshop-pager').getByRole('link', { name: /suivant/i }).click();
  await expect(page.locator('[data-workshop="usable-host-2"]')).toBeVisible();
  await page.locator('.workshop-pager').getByRole('link', { name: /précédent/i }).click();
  await expect(page.locator('[data-exercise-seed]')).toHaveAttribute('data-exercise-seed', 'my-selected-variant');
  await expect(page.getByLabel('Adresse réseau', { exact: true })).toHaveValue('10.20.30.0');
});

test('laptop view shows the complete network, first editable field and controls together', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/#/workshops/guided-mission-2?seed=laptop-workspace');
  await expect(page.locator('[data-topology-mode="diagram"]')).toBeVisible();
  const field = await page.locator('.workshop-form input').first().boundingBox();
  const controls = await page.locator('.workshop-actions').boundingBox();
  const graph = await page.locator('[data-topology]').boundingBox();
  expect(field.y + field.height).toBeLessThanOrEqual(controls.y);
  expect(graph.y + graph.height).toBeLessThanOrEqual(768);
  expect(controls.y + controls.height).toBeLessThanOrEqual(768);
});
