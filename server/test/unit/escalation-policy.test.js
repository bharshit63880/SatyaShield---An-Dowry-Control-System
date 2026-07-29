import assert from 'node:assert/strict';
import test from 'node:test';
import '../helpers/environment.js';

const { env } = await import('../../src/config/env.js');
const {
  deadlinePolicyFor, reporterWorkflowStatus
} = await import('../../src/services/escalation-workflow.service.js');

test('deadline policy uses injected UTC time and versioned configured targets', () => {
  const at = new Date('2026-01-15T12:00:00.000Z');
  const critical = deadlinePolicyFor({
    type: 'critical_human_review', triggeredAt: at, triggerRef: 'assessment-a'
  });
  const high = deadlinePolicyFor({
    type: 'triage_review', severity: 'high', triggeredAt: at, triggerRef: 'assessment-b'
  });
  assert.equal(critical.dueAt.toISOString(),
    new Date(at.getTime() + env.criticalReviewTargetMinutes * 60000).toISOString());
  assert.equal(high.dueAt.toISOString(),
    new Date(at.getTime() + env.highReviewTargetMinutes * 60000).toISOString());
  assert.equal(critical.priority, 'critical');
  assert.equal(critical.policyVersion, env.escalationPolicyVersion);
});

test('reporter workflow serialization is honest and contains no SLA promise', () => {
  const values = [
    reporterWorkflowStatus(null),
    reporterWorkflowStatus({
      level: 'critical_internal_attention', status: 'pending'
    }),
    reporterWorkflowStatus({
      level: 'assignment_attention', triggerCategory: 'assignment_response_overdue',
      status: 'pending'
    }),
    reporterWorkflowStatus({ level: 'review_due', status: 'resolved' })
  ];
  assert.deepEqual(values, [
    'Awaiting review', 'Priority review', 'Assignment response pending', 'Review completed'
  ]);
  assert.doesNotMatch(values.join(' '), /guarantee|dispatch|police|ambulance/i);
});
