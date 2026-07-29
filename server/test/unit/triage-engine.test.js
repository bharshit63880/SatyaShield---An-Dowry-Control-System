import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const { evaluateDeterministicTriage } =
  await import('../../src/services/complaint-risk.service.js');
const {
  buildMinimizedAdvisoryPayload, runLocalAdvisoryTestDouble, validateAdvisoryOutput
} = await import('../../src/services/triage-ai-boundary.service.js');

const base = {
  dangerHappeningNow: 'no', immediateThreatToLife: 'no', weaponInvolved: 'no',
  seriousInjuryPresent: 'no', currentlyConfined: 'no', threatEscalating: 'no',
  stalkingOrRepeatedContact: 'no', vulnerablePersonAtRisk: 'no',
  urgentMedicalHelpNeeded: 'no', canSafelyContinue: 'yes',
  reporterUrgency: 'routine', incidentRecency: 'historical'
};

test('deterministic triage returns identical versioned Low results', () => {
  const one = evaluateDeterministicTriage(base);
  const two = evaluateDeterministicTriage({ ...base });
  assert.deepEqual(one, two);
  assert.equal(one.severity, 'low');
  assert.match(one.triagePolicyVersion, /^triage-/);
});

test('every Critical override rule is explicit and review-required', () => {
  const scenarios = [
    { immediateThreatToLife: 'yes' },
    { dangerHappeningNow: 'yes', weaponInvolved: 'yes' },
    { seriousInjuryPresent: 'yes', urgentMedicalHelpNeeded: 'yes' },
    { currentlyConfined: 'yes', dangerHappeningNow: 'yes' }
  ];
  for (const values of scenarios) {
    const result = evaluateDeterministicTriage({ ...base, ...values });
    assert.equal(result.severity, 'critical');
    assert.equal(result.reviewState, 'review_required');
    assert.ok(result.indicatorCodes.includes('manual_review_required'));
  }
});

test('unknown and conflicting answers fail into human review, never false', () => {
  const unknown = evaluateDeterministicTriage(Object.fromEntries(
    Object.keys(base).map((key) => [key, ['reporterUrgency', 'incidentRecency'].includes(key) ? 'unknown' : 'unknown'])
  ));
  assert.equal(unknown.uncertaintyState, 'incomplete');
  const conflict = evaluateDeterministicTriage({
    ...base, dangerHappeningNow: 'no', immediateThreatToLife: 'yes'
  });
  assert.equal(conflict.uncertaintyState, 'conflicting');
  assert.equal(conflict.reviewState, 'review_required');
});

test('AI test boundary minimizes payload, rejects invalid output and cannot downgrade Critical', async () => {
  const assessment = evaluateDeterministicTriage({ ...base, immediateThreatToLife: 'yes' });
  const payload = buildMinimizedAdvisoryPayload(assessment);
  assert.deepEqual(Object.keys(payload).sort(),
    ['indicatorCodes', 'policyVersion', 'severity', 'uncertaintyState'].sort());
  assert.equal(validateAdvisoryOutput({
    suggestedSeverity: 'low', advisoryCodes: ['review']
  }, 'critical'), null);
  let received;
  const result = await runLocalAdvisoryTestDouble({
    assessment,
    consent: { explicit: true, disclosureVersion: 'test-only-disclosure' },
    adapter: async (value) => {
      received = value;
      return { suggestedSeverity: 'critical', advisoryCodes: ['human_review'] };
    }
  });
  assert.equal(result.used, true);
  assert.deepEqual(received, payload);
});
