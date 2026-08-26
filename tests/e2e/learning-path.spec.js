import { expect, test } from '@playwright/test';

for (const locale of ['fr', 'en']) {
  test(`opens all nineteen curriculum workshops in ${locale}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: locale.toUpperCase(), exact: true }).click();

    const hrefs = await page.locator('[data-workshop-link]').evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')));
    const uniqueHrefs = [...new Set(hrefs)];
    expect(uniqueHrefs).toHaveLength(19);

    for (const href of uniqueHrefs) {
      await page.goto(href);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('[data-workshop]')).toBeVisible();
      await expect(page.locator('[data-micro-lesson]')).not.toBeEmpty();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });
}
