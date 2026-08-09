import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { translations } from '../src/i18n/translations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tracking = fs.readFileSync(path.join(root, 'src/pages/CaseTrackingPage.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/services/api.js'), 'utf8');
const englishCopy = Object.values(translations.en).join('\n');

test('Phase 10 SOS UI requires confirmation, supports cancellation, and defaults location off', () => {
  assert.match(englishCopy, /Request urgent internal support/);
  assert.match(englishCopy, /does not contact police, ambulance or emergency services/);
  assert.match(englishCopy, /I understand this is an internal safety request/);
  assert.match(tracking, /disabled=\{!sosNoticeAccepted\}/);
  assert.match(englishCopy, /Cancellation countdown/);
  assert.match(englishCopy, /Cancel request/);
  assert.match(tracking, /useState\(false\).*shareOneTimeLocation/s);
  assert.match(englishCopy, /This is off by default/);
  assert.match(englishCopy, /created without location because location permission was unavailable/);
  assert.match(tracking, /sosFeatures\.internalSupport/);
});

test('Phase 10 UI and APIs make no dispatch claim and expose deliberate verified contacts only', () => {
  assert.match(englishCopy, /may not contact police, ambulance services, emergency responders/i);
  assert.match(englishCopy, /does not mean received, and acknowledgment does not guarantee action/i);
  assert.doesNotMatch(tracking, /help is coming|police notified|ambulance notified|rescue dispatched/i);
  assert.match(englishCopy, /Contact deliberately/);
  assert.match(englishCopy, /will not invent or display an expired number/);
  assert.match(api, /acknowledgedNonDispatch: true/);
  assert.match(api, /\/platform\/helplines/);
});
