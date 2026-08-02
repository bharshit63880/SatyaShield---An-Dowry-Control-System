import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { translations } from '../src/i18n/translations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const realtime = fs.readFileSync(path.join(root, 'src/services/realtime-chat.js'), 'utf8');
const tracking = fs.readFileSync(path.join(root, 'src/pages/CaseTrackingPage.jsx'), 'utf8');
const englishCopy = Object.values(translations.en).join('\n');

test('Socket credentials use the auth payload and bounded reconnect, never URL storage', () => {
  assert.match(realtime, /auth: \{ credentialType, token \}/);
  assert.match(realtime, /reconnectionAttempts: 5/);
  assert.doesNotMatch(realtime, /query:\s*\{[^}]*token|localStorage|sessionStorage/);
});

test('Reporter real-time chat exposes honest connection and delivery language', () => {
  assert.match(englishCopy, /Real-time connection/);
  assert.match(englishCopy, /delivery is not guaranteed/i);
  assert.match(tracking, /clientMessageId/);
});
