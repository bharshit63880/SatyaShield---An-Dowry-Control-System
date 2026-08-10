import '../helpers/environment.js';

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyInitialIntegrityAssessment,
  createInitialIntegrityAssessment,
  createNarrativeFingerprint,
  normalizeNarrativeForIntegrity
} from '../../src/services/case-integrity.service.js';
import {
  CASE_INTEGRITY_ACTIONS,
  PROHIBITED_SOLE_ADVERSE_REASONS,
  canPerformCaseIntegrityAction
} from '../../src/policies/case-integrity.policy.js';

test('narrative normalization is deterministic without retaining raw punctuation', () => {
  assert.equal(
    normalizeNarrativeForIntegrity('  Repeated—TEXT!!  यहाँ  '),
    'repeated text यहाँ'
  );
  const options = { key: 'k'.repeat(32), version: 'test-v1' };
  assert.equal(
    createNarrativeFingerprint('A sufficiently long repeated narrative.', options),
    createNarrativeFingerprint(' a SUFFICIENTLY long, repeated narrative! ', options)
  );
  assert.equal(createNarrativeFingerprint('too short', options), null);
});

test('duplicate signals require review but never alter safety priority', async () => {
  const candidates = [{ assessmentId: 'integrity-existing', complaintId: 'anon-existing' }];
  let createdAssessment;
  let createdLinks;
  const assessmentModel = {
    find() {
      return {
        select() { return this; },
        sort() { return this; },
        limit() { return this; },
        async lean() { return candidates; }
      };
    },
    async create(value) {
      createdAssessment = { assessmentId: 'integrity-new', ...value };
      return createdAssessment;
    },
    async deleteMany() {}
  };
  const caseLinkModel = {
    async insertMany(values) { createdLinks = values; },
    async deleteMany() {}
  };
  const complaint = {
    anonymousId: 'anon-new',
    currentTriageSeverity: 'critical',
    retentionEligibleAt: new Date('2028-01-01T00:00:00.000Z'),
    async save() {}
  };

  const result = await createInitialIntegrityAssessment(
    complaint,
    'A sufficiently long exact duplicate narrative for a deterministic test.',
    {
      assessmentModel,
      caseLinkModel,
      now: new Date('2026-08-10T00:00:00.000Z')
    }
  );

  assert.equal(result.status, 'duplicate_review');
  assert.equal(result.reviewRequired, true);
  assert.deepEqual(result.signalCodes, ['exact_narrative_match']);
  assert.equal(complaint.currentTriageSeverity, 'critical');
  assert.equal(complaint.currentIntegrityStatus, 'duplicate_review');
  assert.equal(createdLinks.length, 1);
  assert.equal(createdLinks[0].candidateComplaintId, 'anon-existing');
  assert.equal(createdAssessment.signalSnapshot.exactNarrativeCandidateCount, 1);
});

test('integrity policy is default-deny and reserves adverse confirmation for superadmin', () => {
  assert.equal(
    canPerformCaseIntegrityAction(
      { role: 'admin' }, CASE_INTEGRITY_ACTIONS.REVIEW_DECIDE
    ),
    true
  );
  assert.equal(
    canPerformCaseIntegrityAction(
      { role: 'admin' }, CASE_INTEGRITY_ACTIONS.ADVERSE_CONFIRM
    ),
    false
  );
  assert.equal(
    canPerformCaseIntegrityAction(
      { role: 'superadmin' }, CASE_INTEGRITY_ACTIONS.ADVERSE_CONFIRM
    ),
    true
  );
  assert.equal(
    canPerformCaseIntegrityAction(
      { role: 'ngo' }, CASE_INTEGRITY_ACTIONS.ASSESSMENT_READ
    ),
    false
  );
  assert.deepEqual(PROHIBITED_SOLE_ADVERSE_REASONS, [
    'absence_of_evidence',
    'delayed_reporting',
    'inconsistent_trauma_recall',
    'anonymous_submission',
    'unknown_answer',
    'prefer_not_to_say'
  ]);
});

test('zero candidates remains normal and does not require review', () => {
  assert.deepEqual(classifyInitialIntegrityAssessment(0), {
    status: 'normal', riskBand: 'none', signalCodes: [], reviewRequired: false
  });
});
