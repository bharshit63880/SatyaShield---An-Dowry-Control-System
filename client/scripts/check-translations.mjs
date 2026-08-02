import fs from 'node:fs';
import path from 'node:path';

import { translations } from '../src/i18n/translations.js';

const root = path.resolve('src');
const inventoryPath = path.join(root, 'i18n/visible-string-inventory.json');
const allowedEqual = new Set([
  'language.english',
  'language.hindi',
  'visible.4a11e501ccb9',
  'visible.8adec9eab3df',
  'visible.91b4d142823f',
  'visible.cff71654db99'
]);

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(absolute);
    return /\.(?:js|jsx)$/.test(entry.name) ? [absolute] : [];
  });
}

const enKeys = Object.keys(translations.en).sort();
const hiKeys = Object.keys(translations.hi).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(hiKeys)) {
  throw new Error('English/Hindi translation-key parity failed.');
}

const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
  .map((match) => match[1]).sort();
for (const key of enKeys) {
  const english = translations.en[key];
  const hindi = translations.hi[key];
  if (!english?.trim() || !hindi?.trim()) throw new Error(`Empty translation: ${key}`);
  if (JSON.stringify(placeholders(english)) !== JSON.stringify(placeholders(hindi))) {
    throw new Error(`Placeholder mismatch: ${key}`);
  }
  if (english === hindi && !allowedEqual.has(key)) {
    throw new Error(`Unreviewed identical Hindi value: ${key}`);
  }
}

const usedLiteralKeys = new Set(filesUnder(root).flatMap((filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  return [...source.matchAll(/\bt\(["']([^"']+)["']/g)].map((match) => match[1]);
}));
for (const key of usedLiteralKeys) {
  if (!(key in translations.en)) throw new Error(`Missing translation key used by source: ${key}`);
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const unexplained = inventory.filter((item) =>
  !item.finalClassification || item.finalClassification === 'user_visible_requires_translation');
if (unexplained.length) {
  throw new Error(`Visible-string inventory has ${unexplained.length} unresolved candidates.`);
}

console.log(`Translation parity passed (${enKeys.length} keys).`);
console.log(`Visible-string inventory passed (${inventory.length} classified exceptions, 0 unresolved).`);
