import '../helpers/environment.js';
import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

const {
  generateReporterAccessSecret,
  hashReporterAccessSecret,
  signReporterCaseToken
} = await import('../../src/utils/reporter-access.js');
const {
  requireReporterCaseAccess,
  requireReporterOrStaff
} = await import('../../src/middlewares/reporter-access.middleware.js');
const { authenticate } = await import('../../src/middlewares/auth.middleware.js');
const { User } = await import('../../src/models/user.model.js');
const { signAccessToken } = await import('../../src/utils/jwt.js');
const {
  exchangeReporterAccessCredentials
} = await import('../../src/services/complaint.service.js');
const { createRateLimiter } = await import('../../src/config/rate-limit.js');
const { errorHandler } = await import('../../src/middlewares/error.middleware.js');
const { env } = await import('../../src/config/env.js');

function fakeComplaintModel(complaint) {
  return {
    findOne() {
      return {
        select() {
          return {
            lean: async () => complaint
          };
        }
      };
    }
  };
}

async function startTestServer(middleware) {
  const app = express();
  app.use(express.json());
  app.get('/case/:caseId', middleware, (req, res) => {
    res.json({
      caseId: req.reporterCaseAccess?.caseId ?? req.params.caseId,
      accessMode: req.reporterCaseAccess ? 'reporter' : 'staff'
    });
  });
  app.get('/dashboard', authenticate, (_req, res) => {
    res.json({ unexpected: true });
  });
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test('correct credentials exchange for a token without storing raw secret', async () => {
  const caseId = 'anon-11111111-1111-4111-8111-111111111111';
  const accessSecret = generateReporterAccessSecret();
  const record = {
    anonymousId: caseId,
    reporterAccessSecretHash: hashReporterAccessSecret(accessSecret),
    reporterAccessEnabled: true,
    reporterAccessVersion: 1
  };

  assert.equal(JSON.stringify(record).includes(accessSecret), false);
  const result = await exchangeReporterAccessCredentials(
    { caseId, accessSecret },
    fakeComplaintModel(record)
  );
  assert.ok(result.accessToken);
  assert.equal(result.accessSecret, undefined);
});

test('wrong secret, unknown case, and legacy case return the same generic error', async () => {
  const caseId = 'anon-11111111-1111-4111-8111-111111111111';
  const attempts = [
    fakeComplaintModel({
      anonymousId: caseId,
      reporterAccessSecretHash: hashReporterAccessSecret('correct-secret-value-with-more-than-32-chars'),
      reporterAccessEnabled: true,
      reporterAccessVersion: 1
    }),
    fakeComplaintModel(null),
    fakeComplaintModel({
      anonymousId: caseId,
      reporterAccessEnabled: false,
      reporterAccessVersion: 0
    })
  ];

  for (const model of attempts) {
    await assert.rejects(
      exchangeReporterAccessCredentials(
        { caseId, accessSecret: 'wrong-secret-value-with-more-than-32-characters' },
        model
      ),
      (error) =>
        error.statusCode === 401 &&
        error.code === 'REPORTER_ACCESS_INVALID' &&
        error.message === 'Case access credentials are invalid.'
    );
  }
});

test('case token is required and isolated to its exact case', async () => {
  const caseA = 'anon-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const caseB = 'anon-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const server = await startTestServer(requireReporterCaseAccess);
  try {
    const token = signReporterCaseToken(caseA);
    const allowed = await fetch(`${server.baseUrl}/case/${caseA}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(allowed.status, 200);

    const denied = await fetch(`${server.baseUrl}/case/${caseB}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(denied.status, 403);

    const missing = await fetch(`${server.baseUrl}/case/${caseA}`);
    assert.equal(missing.status, 401);

    const dashboard = await fetch(`${server.baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(dashboard.status, 401);
  } finally {
    await server.close();
  }
});

test('expired reporter token is rejected explicitly', async () => {
  const caseId = 'anon-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const token = jwt.sign(
    { tokenType: 'reporter_case_access', caseId },
    env.reporterTokenSecret,
    {
      audience: env.reporterTokenAudience,
      issuer: env.jwtIssuer,
      subject: `case:${caseId}`,
      expiresIn: -1
    }
  );
  const server = await startTestServer(requireReporterCaseAccess);
  try {
    const response = await fetch(`${server.baseUrl}/case/${caseId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.code, 'REPORTER_ACCESS_EXPIRED');
  } finally {
    await server.close();
  }
});

test('authorized staff tokens continue through the shared case-access boundary', async () => {
  const originalFindById = User.findById;
  User.findById = () => ({
    select: async () => ({
      id: '507f1f77bcf86cd799439011',
      email: 'staff@example.invalid',
      role: 'admin',
      accountLocked: false,
      accountState: 'active',
      isVerified: true,
      authVersion: 1
    })
  });
  const server = await startTestServer(requireReporterOrStaff);
  try {
    const token = signAccessToken({
      subject: '507f1f77bcf86cd799439011',
      role: 'admin'
    });
    const response = await fetch(
      `${server.baseUrl}/case/anon-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.accessMode, 'staff');
  } finally {
    User.findById = originalFindById;
    await server.close();
  }
});

test('verification limiter rejects repeated attempts', async () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    limit: 2,
    code: 'REPORTER_ACCESS_RATE_LIMITED',
    message: 'Too many attempts.'
  });
  const app = express();
  app.get('/verify', limiter, (_req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/verify`;
  try {
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 200);
    const blocked = await fetch(url);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).code, 'REPORTER_ACCESS_RATE_LIMITED');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
