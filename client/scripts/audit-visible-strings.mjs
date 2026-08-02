import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default;
const root = path.resolve(process.cwd(), 'src');
const attributeNames = new Set([
  'alt', 'aria-description', 'aria-label', 'aria-placeholder', 'placeholder', 'title'
]);
const userFacingPropertyNames = new Set([
  'desc', 'description', 'empty', 'error', 'hint', 'label', 'message', 'name',
  'subtitle', 'text', 'title'
]);
const ignoredExact = new Set(['-', '—', '×', '☰']);
const technicalExact = new Set([
  '404', 'KB', 'MB — Click to change', 'PNG, JPG, WEBP — max 30MB',
  '000000', '6-digit code', 'anon-', 'anon-...', '+91-XXXXXXXXXX'
]);
const intentionalBrands = new Set([
  'Jagori Helpline', 'Mahila Shakti Foundation', 'Nari Suraksha Samiti',
  'Saheli Support Center', 'SatyaShield'
]);

function classify(item) {
  if (item.file === 'src/services/api.js') return {
    category: 'api_server_controlled',
    justification: 'Transport fallback is mapped to controlled localized UI states by consumers.'
  };
  if (intentionalBrands.has(item.text)) return {
    category: 'intentional_brand_name',
    justification: 'Proper organization or product name is intentionally preserved.'
  };
  if (item.text === 'access') return {
    category: 'false_positive',
    justification: 'Decorative fragment in a stylized heading; surrounding accessible copy is localized.'
  };
  if (technicalExact.has(item.text) ||
      (item.text.length <= 32 &&
        /^(?:TOTP|OTP|AES-256|HttpOnly|Socket\.IO|GPS|CSV|IP \/ Browser UA)$/i.test(item.text))) {
    return {
      category: 'technical_identifier',
      justification: 'Opaque identifier, unit, code, or technical token must remain unchanged.'
    };
  }
  if (/^(?:\/|https?:)/.test(item.text)) return {
    category: 'route_or_path',
    justification: 'Route or URL is not natural-language interface copy.'
  };
  return {
    category: 'user_visible_requires_translation',
    justification: 'Static interface copy requires an English/Hindi translation key.'
  };
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function keyFor(value) {
  return `visible.${crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
}

function isVisibleCandidate(value) {
  const normalized = normalize(value);
  return normalized.length > 1 &&
    /[\p{L}\p{N}]/u.test(normalized) &&
    !ignoredExact.has(normalized) &&
    !/^(?:https?:|\/|#[a-z]|[a-z]+[_-][a-z0-9_-]+$)/i.test(normalized);
}

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory()
      ? filesUnder(absolute)
      : /\.(?:jsx|js)$/.test(entry.name) ? [absolute] : [];
  });
}

const findings = [];
for (const filename of filesUnder(root)) {
  const source = fs.readFileSync(filename, 'utf8');
  const relative = path.relative(process.cwd(), filename).replaceAll('\\', '/');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const add = (value, node, kind) => {
    const text = normalize(value);
    if (isVisibleCandidate(text)) {
      findings.push({ file: relative, line: node.loc?.start.line ?? 0, kind, text });
    }
  };
  traverse(ast, {
    JSXText(pathRef) {
      add(pathRef.node.value, pathRef.node, 'jsx-text');
    },
    JSXAttribute(pathRef) {
      const name = pathRef.node.name?.name;
      if (attributeNames.has(name) && pathRef.node.value?.type === 'StringLiteral') {
        add(pathRef.node.value.value, pathRef.node.value, `attribute:${name}`);
      }
    },
    ObjectProperty(pathRef) {
      const key = pathRef.node.key;
      const name = key?.type === 'Identifier' ? key.name : key?.value;
      if (userFacingPropertyNames.has(name) && pathRef.node.value?.type === 'StringLiteral') {
        add(pathRef.node.value.value, pathRef.node.value, `property:${name}`);
      }
    }
  });
}

const unique = [...new Map(findings.map((item) => [item.text, item])).values()]
  .map((item) => {
    const classification = classify(item);
    return {
      file: item.file,
      sourceLocation: `${item.file}:${item.line}`,
      line: item.line,
      kind: item.kind,
      originalValue: item.text,
      finalClassification: classification.category,
      translationKey: classification.category === 'user_visible_requires_translation'
        ? keyFor(item.text)
        : null,
      justification: classification.justification
    };
  })
  .sort((left, right) => left.originalValue.localeCompare(right.originalValue));

if (process.argv.includes('--write')) {
  const output = path.resolve(process.cwd(), 'src/i18n/visible-string-inventory.json');
  fs.writeFileSync(output, `${JSON.stringify(unique, null, 2)}\n`);
  process.stdout.write(`Wrote ${unique.length} classified candidates to ${output}\n`);
} else {
  process.stdout.write(`${JSON.stringify(unique, null, 2)}\n`);
}
