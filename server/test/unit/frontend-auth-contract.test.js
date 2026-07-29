import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');

test('frontend keeps staff tokens in memory and deduplicates refresh', async () => {
  const [context, api] = await Promise.all([
    fs.readFile(path.join(root, 'client/src/context/AuthContext.jsx'), 'utf8'),
    fs.readFile(path.join(root, 'client/src/services/api.js'), 'utf8')
  ]);
  assert.equal(/localStorage|sessionStorage/.test(`${context}\n${api}`), false);
  assert.match(api, /credentials:\s*'include'/);
  assert.match(api, /refreshPromise/);
  assert.match(api, /_skipRefresh/);
  assert.match(api, /X-CSRF-Token/);
});

test('reset and verification pages remove one-time tokens from URL history', async () => {
  const [login, verify] = await Promise.all([
    fs.readFile(path.join(root, 'client/src/pages/LoginPage.jsx'), 'utf8'),
    fs.readFile(path.join(root, 'client/src/pages/VerifyEmailPage.jsx'), 'utf8')
  ]);
  assert.match(login, /history\.replaceState/);
  assert.match(verify, /history\.replaceState/);
  assert.equal(login.includes('console'), false);
});

test('server cookie and CORS source enforce credential-safe boundaries', async () => {
  const [csrf, app] = await Promise.all([
    fs.readFile(path.join(root, 'server/src/middlewares/csrf.middleware.js'), 'utf8'),
    fs.readFile(path.join(root, 'server/src/app.js'), 'utf8')
  ]);
  assert.match(csrf, /httpOnly/);
  assert.match(csrf, /secure:\s*isProduction/);
  assert.match(csrf, /sameSite:\s*'strict'/);
  assert.match(app, /env\.clientUrls\.includes\(origin\)/);
  assert.match(app, /credentials:\s*true/);
  assert.equal(app.includes("origin: '*'"), false);
});
