import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('language switching persists only the non-sensitive UI preference', async ({ page }) => {
  await page.goto('/');
  const language = page.getByLabel('Language');
  await language.selectOption('hi');
  await expect(page.getByRole('link', { name: 'सत्यशील्ड' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  const storage = await page.evaluate(() => ({
    local: { ...localStorage }, session: { ...sessionStorage }
  }));
  expect(storage).toEqual({
    local: { 'satyashield.ui.language': 'hi' },
    session: {}
  });
});

test('keyboard skip navigation and sensitive-page Quick Exit work without leaking data', async ({ page }) => {
  await page.goto('/report');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.route('https://www.google.com/', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Neutral</title>' }));
  await page.getByRole('button', { name: 'Leave now' }).click();
  await expect(page).toHaveURL('https://www.google.com/');
});

for (const route of ['/', '/report', '/track', '/login', '/privacy']) {
  test(`no serious or critical automated accessibility violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const blocking = results.violations.filter(({ impact }) =>
      impact === 'serious' || impact === 'critical');
    expect(blocking).toEqual([]);
  });
}

test('mobile and 200% zoom layouts do not create page-level horizontal overflow', async ({ page }) => {
  // A 640 CSS-pixel viewport represents a 1280px-wide laptop at 200% zoom.
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto('/report');
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 2);
});
