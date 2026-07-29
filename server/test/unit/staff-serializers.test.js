import '../helpers/environment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  serializeComplaintForNGO,
  serializeComplaintForInvestigator
} = await import('../../src/services/complaint.service.js');
const {
  serializeChatMessageForStaff,
  serializeEvidenceForStaff,
  serializeTimelineForStaff
} = await import('../../src/services/reporter-serializer.service.js');

const complaint = {
  _id: 'database-id',
  anonymousId: 'anon-case',
  description: 'Visible case description',
  status: 'under-review',
  riskScore: 88,
  riskLevel: 'high',
  currentTriageSeverity: 'high',
  currentTriageReviewState: 'confirmed',
  detectedKeywords: ['private'],
  indicators: { dowryHarassment: true },
  escalationRecommendation: 'internal reasoning',
  threatSummary: 'internal summary',
  assignedNgo: {
    ngoId: 'private-ngo-id',
    name: 'NGO A',
    coverageLabel: 'District',
    contactEmail: 'private@example.invalid',
    assignmentSource: 'internal',
    matchedOn: 'district'
  },
  assignedInvestigator: {
    investigatorId: 'private-user-id',
    name: 'Investigator A',
    badgeNumber: 'BADGE-A'
  },
  timestamp: new Date()
};

test('NGO complaint serializer excludes investigator and internal risk data', () => {
  const result = serializeComplaintForNGO(complaint);
  for (const forbidden of [
    '_id',
    'riskScore',
    'detectedKeywords',
    'indicators',
    'escalationRecommendation',
    'threatSummary',
    'assignedInvestigator'
  ]) {
    assert.equal(result[forbidden], undefined);
  }
  assert.equal(result.assignedNgo.ngoId, undefined);
  assert.equal(result.assignedNgo.contactEmail, undefined);
});

test('investigator serializer exposes investigation data without database IDs or admin reasoning', () => {
  const result = serializeComplaintForInvestigator(complaint);
  assert.equal(result.triage.severity, 'high');
  assert.equal(result.triage.reviewState, 'confirmed');
  assert.equal(result.riskScore, undefined);
  assert.equal(result.indicators, undefined);
  assert.equal(result._id, undefined);
  assert.equal(result.detectedKeywords, undefined);
  assert.equal(result.escalationRecommendation, undefined);
  assert.equal(result.threatSummary, undefined);
  assert.equal(result.assignedNgo.ngoId, undefined);
  assert.equal(result.assignedInvestigator.investigatorId, undefined);
});

test('staff activity serializers omit mongoose IDs, audit identities, and read receipts', () => {
  const timeline = serializeTimelineForStaff([{
    _id: 'history-id',
    action: 'status_update',
    description: 'Status changed',
    userId: 'private-user-id',
    userName: 'Private Staff Name',
    userRole: 'admin',
    createdAt: new Date()
  }], 'ngo')[0];
  assert.equal(timeline._id, undefined);
  assert.equal(timeline.userId, undefined);
  assert.equal(timeline.actorName, undefined);

  const evidence = serializeEvidenceForStaff({
    _id: 'evidence-id',
    category: 'document',
    originalName: 'proof.pdf',
    metadata: { storagePath: '/private/path' },
    uploaderId: 'private-user-id'
  });
  assert.equal(evidence._id, undefined);
  assert.equal(evidence.metadata, undefined);
  assert.equal(evidence.uploaderId, undefined);

  const chat = serializeChatMessageForStaff({
    _id: 'message-id',
    complaintId: 'anon-case',
    senderRole: 'investigator',
    senderName: 'Private Staff Name',
    senderId: 'private-user-id',
    readBy: [{ userId: 'private-reader-id' }],
    attachments: []
  }, 'hello', 'ngo');
  assert.equal(chat._id, undefined);
  assert.equal(chat.senderId, undefined);
  assert.equal(chat.readBy, undefined);
  assert.equal(chat.senderName, 'Authorized case participant');
});
