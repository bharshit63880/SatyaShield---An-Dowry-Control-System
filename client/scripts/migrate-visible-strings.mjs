import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as types from '@babel/types';

const traverse = traverseModule.default;
const generate = generateModule.default;
const root = path.resolve(process.cwd(), 'src');
const attributes = new Set([
  'alt', 'aria-description', 'aria-label', 'aria-placeholder', 'placeholder', 'title'
]);
const ignored = new Set(['404', '-', '—', '×', '☰', 'KB', 'anon-', 'access']);
const catalog = {};

const normalize = (value) => value.replace(/\s+/g, ' ').trim();
const candidate = (value) => {
  const normalized = normalize(value);
  return normalized.length > 1 && /[\p{L}\p{N}]/u.test(normalized) &&
    !ignored.has(normalized) && !/^(?:https?:|\/|#[a-z])/i.test(normalized);
};
const keyFor = (value) =>
  `visible.${crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && !absolute.includes(`${path.sep}i18n`)) return filesUnder(absolute);
    return entry.isFile() && /\.jsx$/.test(entry.name) ? [absolute] : [];
  });
}
function componentFunction(pathRef) {
  let current = pathRef;
  while (current) {
    if (current.isFunctionDeclaration() && /^[A-Z]/.test(current.node.id?.name || '')) return current;
    if ((current.isArrowFunctionExpression() || current.isFunctionExpression()) &&
        current.parentPath?.isVariableDeclarator() &&
        /^[A-Z]/.test(current.parentPath.node.id?.name || '')) return current;
    current = current.parentPath;
  }
  return null;
}
function ensureHook(functionPath) {
  const body = functionPath?.get('body');
  if (!body?.isBlockStatement()) return;
  const exists = body.node.body.some((statement) =>
    types.isVariableDeclaration(statement) &&
    statement.declarations.some((declaration) =>
      types.isObjectPattern(declaration.id) &&
      declaration.id.properties.some((property) => property.key?.name === 't') &&
      types.isCallExpression(declaration.init) &&
      declaration.init.callee?.name === 'useLanguage'));
  if (!exists) {
    body.unshiftContainer('body', types.variableDeclaration('const', [
      types.variableDeclarator(
        types.objectPattern([types.objectProperty(
          types.identifier('t'), types.identifier('t'), false, true
        )]),
        types.callExpression(types.identifier('useLanguage'), [])
      )
    ]));
  }
}

for (const filename of filesUnder(root)) {
  const source = fs.readFileSync(filename, 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let changed = false;
  const touchedFunctions = new Set();
  const register = (value) => {
    const text = normalize(value);
    const key = keyFor(text);
    catalog[key] = text;
    return key;
  };
  traverse(ast, {
    JSXText(pathRef) {
      if (!candidate(pathRef.node.value)) return;
      const functionPath = componentFunction(pathRef);
      if (!functionPath) return;
      touchedFunctions.add(functionPath);
      pathRef.replaceWith(types.jsxExpressionContainer(
        types.callExpression(types.identifier('t'), [types.stringLiteral(register(pathRef.node.value))])
      ));
      changed = true;
    },
    JSXAttribute(pathRef) {
      const name = pathRef.node.name?.name;
      if (!attributes.has(name) || !types.isStringLiteral(pathRef.node.value) ||
          !candidate(pathRef.node.value.value)) return;
      const functionPath = componentFunction(pathRef);
      if (!functionPath) return;
      touchedFunctions.add(functionPath);
      pathRef.node.value = types.jsxExpressionContainer(
        types.callExpression(types.identifier('t'), [types.stringLiteral(register(pathRef.node.value.value))])
      );
      changed = true;
    }
  });
  if (!changed) continue;
  for (const functionPath of touchedFunctions) ensureHook(functionPath);
  const hasImport = ast.program.body.some((node) =>
    types.isImportDeclaration(node) &&
    node.specifiers.some((specifier) => specifier.imported?.name === 'useLanguage'));
  if (!hasImport) {
    const relative = path.relative(path.dirname(filename), path.join(root, 'context/LanguageContext'))
      .replaceAll('\\', '/');
    ast.program.body.unshift(types.importDeclaration(
      [types.importSpecifier(types.identifier('useLanguage'), types.identifier('useLanguage'))],
      types.stringLiteral(relative.startsWith('.') ? relative : `./${relative}`)
    ));
  }
  fs.writeFileSync(filename, `${generate(ast, {}, source).code}\n`);
}

const usedKeys = new Set(filesUnder(root).flatMap((filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  return [...source.matchAll(/t\(["'](visible\.[a-f0-9]{12})["']/g)].map((match) => match[1]);
}));
const lines = Object.entries(catalog)
  .filter(([key]) => usedKeys.has(key))
  .sort(([left], [right]) => left.localeCompare(right));
const render = (entries) => entries.map(([key, value]) =>
  `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n');
fs.writeFileSync(path.join(root, 'i18n/generated-visible-translations.js'),
  `// Static developer-authored UI catalog. Hindi values require internal review.\n` +
  `export const generatedVisibleEn = {\n${render(lines)}\n};\n\n` +
  `export const generatedVisibleHi = {\n${render(lines)}\n};\n`);
process.stdout.write(`Migrated ${lines.length} distinct visible strings.\n`);
