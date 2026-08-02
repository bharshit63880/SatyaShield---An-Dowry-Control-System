import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { translations } from '../src/i18n/translations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dashboard = fs.readFileSync(path.join(root, 'src/pages/DashboardPage.jsx'), 'utf8');
const tracking = fs.readFileSync(path.join(root, 'src/pages/CaseTrackingPage.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/services/api.js'), 'utf8');
const englishCopy = Object.values(translations.en).join('\n');

test('Phase 8 UI uses structured workflow reasons and honest non-dispatch wording', () => {
  assert.match(dashboard, /administrative_review/);
  assert.match(englishCopy, /does not contact emergency services or guarantee a response time/i);
  assert.doesNotMatch(dashboard, /help is coming|police notified|rescue dispatched/i);
  assert.match(tracking, /workflowStatus/);
  assert.match(englishCopy, /not an emergency or dispatch service/i);
});

test('Phase 8 mutations use versions and idempotency keys', () => {
  assert.match(api, /idempotencyKey/);
  assert.match(api, /version, action: 'resolve'/);
  assert.match(api, /workflow\/escalations/);
});
