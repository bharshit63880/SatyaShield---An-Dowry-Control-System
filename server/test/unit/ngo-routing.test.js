import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const { hardEligibility, normalizeNgoProfileInput } =
  await import('../../src/services/ngo-router.service.js');

test('NGO profile normalization preserves allowlisted category identifiers', () => {
  const profile = normalizeNgoProfileInput({
    supportedCategories: ['DOWRY_HARASSMENT', 'unknown'],
    supportedLanguages: [' Hindi '],
    coverage: [{ country: 'IN', state: 'Delhi', district: 'Central' }],
    maximumActiveAssignments: 5
  });
  assert.deepEqual(profile.supportedCategories, ['dowry_harassment']);
  assert.deepEqual(profile.supportedLanguages, ['hindi']);
  assert.equal(profile.coverage[0].district, 'central');
});

test('hard NGO eligibility fails closed on stale approval, suspension and capacity', () => {
  const base = {
    verificationStatus: 'approved', profileVersion: 2, approvedProfileVersion: 2,
    operationalStatus: 'active', acceptsNewAssignments: true,
    currentActiveAssignments: 1, maximumActiveAssignments: 2
  };
  assert.equal(hardEligibility(base), true);
  assert.equal(hardEligibility({ ...base, approvedProfileVersion: 1 }), false);
  assert.equal(hardEligibility({ ...base, operationalStatus: 'suspended' }), false);
  assert.equal(hardEligibility({ ...base, currentActiveAssignments: 2 }), false);
});
