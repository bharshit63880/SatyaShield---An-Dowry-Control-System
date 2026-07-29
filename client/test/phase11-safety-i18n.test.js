import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { translations } from '../src/i18n/translations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('English and Hindi translation catalogs have identical stable keys', () => {
  assert.deepEqual(Object.keys(translations.hi).sort(), Object.keys(translations.en).sort());
  for (const language of ['en', 'hi']) {
    for (const [key, value] of Object.entries(translations[language])) {
      assert.equal(typeof value, 'string', `${language}:${key}`);
      assert.ok(value.trim().length > 0, `${language}:${key}`);
    }
  }
});

test('language persistence is isolated to a non-sensitive namespaced preference', () => {
  const source = read('src/context/LanguageContext.jsx');
  assert.match(source, /satyashield\.ui\.language/);
  assert.doesNotMatch(source, /accessSecret|reporterToken|caseId|sessionStorage/);
  assert.match(source, /document\.documentElement\.lang = language/);
});

test('Quick Exit clears active reporter state, replaces history, and has a keyboard shortcut', () => {
  const rootLayout = read('src/components/layout/RootLayout.jsx');
  const quickExit = read('src/services/quick-exit.js');
  const tracking = read('src/pages/CaseTrackingPage.jsx');
  assert.match(rootLayout, /aria-keyshortcuts="Alt\+Q"/);
  assert.match(quickExit, /window\.location\.replace/);
  assert.match(quickExit, /satyashield:quick-exit/);
  assert.match(tracking, /chatSocketRef\.current\?\.close/);
  assert.match(tracking, /setReporterToken\(null\)/);
  assert.match(tracking, /setCredentials\(initialCredentials\)/);
});

test('reporter inactivity lock is configurable, cross-tab, and leaves staff auth untouched', () => {
  const lock = read('src/hooks/useReporterInactivityLock.js');
  assert.match(lock, /VITE_REPORTER_INACTIVITY_SECONDS/);
  assert.match(lock, /BroadcastChannel/);
  assert.doesNotMatch(lock, /logoutRequest|setStaffAuthState|refreshSessionRequest/);
  assert.doesNotMatch(lock, /localStorage|sessionStorage/);
});

test('accessibility foundations include skip navigation, focus, reduced motion and a trapped dialog', () => {
  const layout = read('src/components/layout/RootLayout.jsx');
  const dialog = read('src/components/ui/AccessibleDialog.jsx');
  const styles = read('src/styles/index.css');
  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /id="main-content"/);
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key !== 'Tab'/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
