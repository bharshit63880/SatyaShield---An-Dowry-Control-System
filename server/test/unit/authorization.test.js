import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  COMPLAINT_ACTIONS,
  assertAdministrativeWorkflow,
  canAccessComplaint
} = await import('../../src/services/authorization.service.js');
const { requireExactRoles } = await import('../../src/middlewares/authorization.middleware.js');

const complaint = {
  anonymousId: 'case-a',
  assignedNgo: { ngoId: 'ngo-a' },
  assignedInvestigator: { investigatorId: 'investigator-a' }
};

test('authorization policy is default-deny and enforces exact assignments', () => {
  const ngoA = { role: 'ngo', ngoId: 'ngo-a' };
  const ngoB = { role: 'ngo', ngoId: 'ngo-b' };
  const investigatorA = { role: 'investigator', investigatorId: 'investigator-a' };
  const investigatorB = { role: 'investigator', investigatorId: 'investigator-b' };

  assert.equal(canAccessComplaint({
    actor: ngoA,
    complaint,
    assignment: { complaintId: 'case-a', ngoPublicId: 'ngo-a', state: 'acknowledged', isCurrent: true },
    action: COMPLAINT_ACTIONS.READ
  }), true);
  assert.equal(canAccessComplaint({
    actor: ngoB,
    complaint,
    assignment: { complaintId: 'case-a', ngoPublicId: 'ngo-a', state: 'acknowledged', isCurrent: true },
    action: COMPLAINT_ACTIONS.READ
  }), false);
  assert.equal(canAccessComplaint({
    actor: investigatorA,
    complaint,
    action: COMPLAINT_ACTIONS.INVESTIGATION_NOTE_ADD
  }), true);
  assert.equal(canAccessComplaint({
    actor: investigatorB,
    complaint,
    action: COMPLAINT_ACTIONS.READ
  }), false);
  assert.equal(canAccessComplaint({
    actor: ngoA,
    complaint,
    assignment: { complaintId: 'case-a', ngoPublicId: 'ngo-a', state: 'acknowledged', isCurrent: true },
    action: COMPLAINT_ACTIONS.STATUS_UPDATE
  }), false);
  assert.equal(canAccessComplaint({
    actor: investigatorA,
    complaint,
    action: 'unregistered:action'
  }), false);
});

test('administrative workflow guard denies NGO and investigator roles', () => {
  assert.doesNotThrow(() => assertAdministrativeWorkflow({ role: 'admin' }));
  assert.doesNotThrow(() => assertAdministrativeWorkflow({ role: 'superadmin' }));
  for (const role of ['ngo', 'investigator', 'user']) {
    assert.throws(
      () => assertAdministrativeWorkflow({ role }),
      (error) => error.statusCode === 403 && error.code === 'RESOURCE_ACCESS_DENIED'
    );
  }
});

test('an admin cannot pass a superadmin-only role boundary', () => {
  let receivedError;
  requireExactRoles(['superadmin'])(
    { user: { id: 'admin-user', role: 'admin' } },
    {},
    (error) => {
      receivedError = error;
    }
  );
  assert.equal(receivedError.statusCode, 403);
  assert.equal(receivedError.code, 'RESOURCE_ACCESS_DENIED');
});
