import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tracking = fs.readFileSync(path.join(root, 'src/pages/CaseTrackingPage.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/services/api.js'), 'utf8');

test('Phase 10 SOS UI requires confirmation, supports cancellation, and defaults location off', () => {
  assert.match(tracking, /I understand this is an internal safety request/);
  assert.match(tracking, /disabled=\{!sosNoticeAccepted\}/);
  assert.match(tracking, /Cancellation countdown/);
  assert.match(tracking, /Cancel request/);
  assert.match(tracking, /useState\(false\).*shareOneTimeLocation/s);
  assert.match(tracking, /This is off by default/);
  assert.match(tracking, /created without location because location permission was unavailable/);
});

test('Phase 10 UI and APIs make no dispatch claim and expose deliberate verified contacts only', () => {
  assert.match(tracking, /may not contact police, ambulance services, emergency responders/i);
  assert.match(tracking, /does not mean received, and acknowledgment does not guarantee action/i);
  assert.doesNotMatch(tracking, /help is coming|police notified|ambulance notified|rescue dispatched/i);
  assert.match(tracking, /Contact deliberately/);
  assert.match(tracking, /will not invent or display an expired number/);
  assert.match(api, /acknowledgedNonDispatch: true/);
  assert.match(api, /\/platform\/helplines/);
});
