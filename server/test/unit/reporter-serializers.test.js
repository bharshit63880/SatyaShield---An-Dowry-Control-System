import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const { serializeComplaintForReporter } = await import('../../src/services/complaint.service.js');
const {
  serializeEvidenceForReporter,
  serializeTimelineForReporter
} = await import('../../src/services/reporter-serializer.service.js');

test('reporter complaint serializer excludes staff-only and database fields', () => {
  const result = serializeComplaintForReporter({
    _id: 'database-id',
    anonymousId: 'anon-11111111-1111-4111-8111-111111111111',
    description: 'Reporter-visible description',
    status: 'submitted',
    riskLevel: 'high',
    riskScore: 99,
    detectedKeywords: ['internal'],
    escalationRecommendation: 'staff-only reasoning',
    threatSummary: 'staff-only summary',
    assignedNgo: {
      name: 'Support NGO',
      coverageLabel: 'District coverage',
      contactEmail: 'private@example.invalid',
      contactPhone: 'private',
      assignmentSource: 'internal',
      matchedOn: 'district'
    },
    assignedInvestigator: {
      investigatorId: 'private-id',
      name: 'Private investigator',
      badgeNumber: 'private-badge'
    },
    timestamp: new Date('2026-07-28T00:00:00.000Z')
  });

  assert.equal(result.caseId.startsWith('anon-'), true);
  assert.equal(result.assignedNgo.name, 'Support NGO');
  assert.equal(result.assignedNgo.contactEmail, undefined);
  for (const forbidden of [
    '_id',
    'riskScore',
    'detectedKeywords',
    'escalationRecommendation',
    'threatSummary',
    'assignedInvestigator',
    'reporterAccessSecretHash'
  ]) {
    assert.equal(result[forbidden], undefined);
  }
});

test('reporter timeline omits notes, identities, and escalation reasons', () => {
  const result = serializeTimelineForReporter([
    {
      _id: 'one',
      action: 'status_update',
      description: 'Internal description',
      userName: 'Staff identity',
      userRole: 'admin',
      newStatus: 'under-review',
      createdAt: new Date()
    },
    {
      _id: 'two',
      action: 'investigation_note',
      description: 'Confidential note',
      userName: 'Investigator identity',
      createdAt: new Date()
    },
    {
      _id: 'three',
      action: 'escalated',
      description: 'Confidential escalation reason',
      createdAt: new Date()
    }
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].description, 'Case status changed to under-review.');
  assert.equal(result[0]._id, undefined);
  assert.equal(result[0].userName, undefined);
});

test('reporter evidence serializer returns metadata without storage or database fields', () => {
  const result = serializeEvidenceForReporter({
    _id: 'database-id',
    category: 'image',
    originalName: 'photo.jpg',
    mimeType: 'image/jpeg',
    fileSize: 123,
    fileUrl: 'https://storage.invalid/private-path',
    uploaderId: 'database-user-id',
    metadata: { private: true },
    uploadedBy: 'victim',
    createdAt: new Date()
  });

  assert.equal(result.originalName, 'photo.jpg');
  assert.equal(result._id, undefined);
  assert.equal(result.fileUrl, undefined);
  assert.equal(result.uploaderId, undefined);
  assert.equal(result.metadata, undefined);
});
