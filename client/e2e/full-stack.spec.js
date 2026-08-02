import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe.configure({ mode: 'serial' });

async function loginWithoutMfa(page, email) {
  await page.goto('/login');
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill('Browser Test Passphrase 2026!');
  await page.getByRole('button', { name: 'Enter dashboard' }).click();
}

test('anonymous submission, one-time credentials, unlock, evidence, chat, SOS and locking', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto('/report');
  const description = 'Deterministic browser test complaint for guarded end-to-end verification.';
  const descriptionField = page.locator('textarea[name="description"]');
  await descriptionField.fill(description);

  await page.getByLabel('Language', { exact: true }).selectOption('hi');
  await expect(descriptionField).toHaveValue(description);
  await page.getByLabel('भाषा', { exact: true }).selectOption('en');
  await expect(descriptionField).toHaveValue(description);

  await page.getByRole('button', { name: 'Next: Evidence →' }).click();
  await page.getByRole('button', { name: 'Next: Review →' }).click();
  await page.locator('[name="privacyAcknowledged"]').check();
  await page.getByRole('button', { name: 'Submit anonymously' }).click();
  await expect(page.getByRole('heading', { name: 'Report Submitted Successfully' })).toBeVisible();

  const caseLabel = page.getByText('🔑 Anonymous Case ID', { exact: true });
  const caseId = (await caseLabel.locator('xpath=following-sibling::p[1]').textContent()).trim();
  const secretLabel = page.getByText('Reporter Access Secret', { exact: true });
  const accessSecret = (await secretLabel.locator('xpath=following-sibling::p[1]').textContent()).trim();
  expect(caseId).toMatch(/^anon-/);
  expect(accessSecret.length).toBeGreaterThan(24);

  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(JSON.stringify(storage)).not.toContain(caseId);
  expect(JSON.stringify(storage)).not.toContain(accessSecret);

  await page.goto('/track');
  await page.getByLabel('Case ID').fill(caseId);
  await page.getByLabel('Reporter access secret').fill(accessSecret);
  await page.getByRole('button', { name: 'Unlock case' }).click();
  await expect(page.getByText(description)).toBeVisible();

  const evidenceSection = page.getByRole('heading', { name: 'Evidence received' }).locator('..');
  await evidenceSection.locator('input[type="file"]').setInputFiles('public/satyashield-logo.png');
  await evidenceSection.getByRole('button', { name: 'Upload evidence' }).click();
  await expect(page.getByText(/Evidence was received by the private vault/)).toBeVisible();
  await expect(evidenceSection.getByRole('button', { name: 'Authorized download' })).toBeVisible();

  const chat = page.getByRole('heading', { name: 'Case chat' }).locator('..');
  await chat.locator('input').fill('Guarded reporter browser message');
  await chat.getByRole('button', { name: 'Send' }).click();
  await expect(chat.getByText('Guarded reporter browser message')).toBeVisible();

  await page.getByRole('button', { name: 'Start SOS safety request' }).click();
  await page.getByText(/I understand this is an internal safety request/)
    .locator('..').locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Begin cancel countdown' }).click();
  await expect(page.getByText(/Cancellation countdown:/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel request' }).click();

  const secondPage = await context.newPage();
  await secondPage.goto('/track');
  await secondPage.getByLabel('Case ID').fill(caseId);
  await secondPage.getByLabel('Reporter access secret').fill(accessSecret);
  await secondPage.getByRole('button', { name: 'Unlock case' }).click();
  await expect(secondPage.getByText(description)).toBeVisible();
  await page.getByRole('button', { name: 'Lock case' }).click();
  await expect(secondPage.getByRole('button', { name: 'Unlock case' })).toBeVisible();
  await secondPage.close();
});

test('NGO sees a minimized offer and can acknowledge it', async ({ page }) => {
  await loginWithoutMfa(page, 'browser-ngo@example.invalid');
  await expect(page).toHaveURL(/\/dashboard\/ngo/);
  await page.getByRole('button', { name: /offered/i }).click();
  await expect(page.getByText(/Approximate area shared:/)).toBeVisible();
  await page.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByText('Assignment updated safely.')).toBeVisible();
});

test('investigator reaches only the investigator workspace and it passes axe', async ({ page }) => {
  await loginWithoutMfa(page, 'browser-investigator@example.invalid');
  await expect(page).toHaveURL(/\/dashboard\/investigator/);
  await expect(page.getByText(/Browser Investigator|Investigator/i).first()).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('staff login requires MFA recovery code and authenticated admin page passes axe', async ({ page }) => {
  await page.goto('/login');
  await page.locator('[name="email"]').fill('browser-admin@example.invalid');
  await page.locator('[name="password"]').fill('Browser Test Passphrase 2026!');
  await page.getByRole('button', { name: 'Enter dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Enter MFA Code' })).toBeVisible();
  await page.locator('[name="recoveryCode"]').fill('BROWSER-RECOVERY-2026');
  await page.getByRole('button', { name: 'Confirm sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const persisted = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(JSON.stringify(persisted)).not.toMatch(/eyJ|accessToken|refreshToken|csrf/i);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);
});

test('reduced motion and responsive Hindi reflow remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto('/report');
  await page.getByLabel('Language', { exact: true }).selectOption('hi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
