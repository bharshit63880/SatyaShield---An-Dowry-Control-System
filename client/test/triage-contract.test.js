import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { translations } from '../src/i18n/translations.js';

const intake = fs.readFileSync(new URL('../src/pages/ComplaintPage.jsx', import.meta.url), 'utf8');
const tracking = fs.readFileSync(new URL('../src/pages/CaseTrackingPage.jsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
const englishCopy = Object.values(translations.en).join('\n');

test('structured safety questions support unknown and prefer-not-to-say without client severity', () => {
  assert.match(intake, /dangerHappeningNow/);
  assert.match(intake, /prefer_not_to_say/);
  assert.match(englishCopy, /Evidence is not required/);
  assert.doesNotMatch(intake, /payload\.append\(['"]severity/);
});

test('Critical reporter guidance is accurate and makes no dispatch claim', () => {
  assert.match(englishCopy, /does not automatically contact (?:police|emergency responders)/);
  assert.match(englishCopy, /not an emergency or dispatch service/);
  assert.doesNotMatch(tracking, /help is on the way|police (?:were|have been) notified/i);
});

test('triage API uses bearer memory path without persistent browser storage', () => {
  assert.match(api, /getComplaintTriageRequest/);
  assert.doesNotMatch(api, /localStorage|sessionStorage/);
});
