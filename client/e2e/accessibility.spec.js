import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('language switching persists only the non-sensitive UI preference', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Language', { exact: true }).selectOption('hi');
  await expect(page.getByRole('link', { name: 'सत्यशील्ड' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })))
    .toEqual({ local: { 'satyashield.ui.language': 'hi' }, session: {} });
});

test('keyboard skip navigation and global Quick Exit are operable', async ({ page }) => {
  await page.goto('/report');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('button', { name: 'Leave now' }).click();
  await expect(page).toHaveURL(/^https:\/\/www\.google\.com\/?/);
});

for (const route of ['/', '/report', '/track', '/login', '/privacy']) {
  test(`no serious or critical axe violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.filter(({ impact }) =>
      impact === 'serious' || impact === 'critical')).toEqual([]);
  });
}

test('mobile and 200% equivalent layouts have no page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto('/report');
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 2);
});
