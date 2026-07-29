const REPORTER_TIMELINE_ACTIONS = new Set([
  'complaint_created',
  'status_update',
  'ngo_assigned',
  'investigator_assigned',
  'evidence_upload',
  'escalation_resolved'
]);

function reporterTimelineDescription(item) {
  switch (item.action) {
    case 'complaint_created':
      return 'Your report was received.';
    case 'status_update':
      return `Case status changed${item.newStatus ? ` to ${item.newStatus}` : ''}.`;
    case 'ngo_assigned':
      return 'A support organization was assigned to the case.';
    case 'investigator_assigned':
      return 'An authorized investigator was assigned to the case.';
    case 'evidence_upload':
      return 'New evidence was received.';
    case 'escalation_resolved':
      return 'An internal review item was resolved.';
    default:
      return 'Case activity was recorded.';
  }
}

export function serializeTimelineForReporter(history = []) {
  return history
    .filter((item) => REPORTER_TIMELINE_ACTIONS.has(item.action))
    .map((item) => ({
      action: item.action,
      description: reporterTimelineDescription(item),
      status: item.newStatus ?? null,
      createdAt: item.createdAt
    }));
}

export function serializeEvidenceForReporter(evidence) {
  return {
    evidenceId: evidence.evidenceId,
    category: evidence.category,
    originalName: evidence.originalName,
    detectedMimeType: evidence.detectedMimeType ?? evidence.mimeType,
    detectedExtension: evidence.detectedExtension,
    fileSize: evidence.fileSize,
    uploadedBy: evidence.uploadedBy,
    scanStatus: evidence.scanStatus ?? 'pending',
    lifecycleStatus: evidence.evidenceId
      ? evidence.lifecycleStatus
      : 'legacy_unmigrated',
    downloadPath:
      evidence.evidenceId && evidence.lifecycleStatus === 'available' && evidence.reporterVisible !== false
        ? `/complaints/lookup/${evidence.complaintId}/evidence/${evidence.evidenceId}/download`
        : null,
    createdAt: evidence.createdAt
  };
}

export function serializeChatMessageForReporter(message, decryptedText) {
  const actor = message.senderActorCategory ||
    (message.senderRole === 'victim' ? 'reporter' : message.senderRole);
  return {
    messageId: message.messageId,
    sequence: message.sequence,
    senderRole: actor,
    senderLabel: actor === 'reporter' ? 'Reporter' : 'Support team',
    text: decryptedText,
    attachments: (message.attachments ?? []).map(({ evidenceId }) => ({ evidenceId })),
    deliveryState: message.deliveryState || 'persisted',
    createdAt: message.createdAt
  };
}

export function serializeTimelineForStaff(history = [], role) {
  const visibleHistory = role === 'ngo'
    ? history.filter((item) => item.action !== 'investigation_note')
    : history;

  return visibleHistory.map((item) => ({
    action: item.action,
    description:
      role === 'ngo' && item.action === 'investigator_assigned'
        ? 'An investigator was assigned to the case.'
        : item.description,
    previousStatus: item.previousStatus ?? null,
    newStatus: item.newStatus ?? null,
    actorRole: item.userRole ?? 'system',
    actorName: ['admin', 'superadmin'].includes(role) ? item.userName ?? 'System' : undefined,
    createdAt: item.createdAt
  }));
}

export function serializeEvidenceForStaff(evidence) {
  return {
    evidenceId: evidence.evidenceId,
    category: evidence.category,
    originalName: evidence.originalName,
    detectedMimeType: evidence.detectedMimeType ?? evidence.mimeType,
    detectedExtension: evidence.detectedExtension,
    fileSize: evidence.fileSize,
    uploadedBy: evidence.uploadedBy,
    scanStatus: evidence.scanStatus ?? 'pending',
    lifecycleStatus: evidence.evidenceId
      ? evidence.lifecycleStatus
      : 'legacy_unmigrated',
    availableAt: evidence.availableAt ?? null,
    downloadPath:
      evidence.evidenceId && evidence.lifecycleStatus === 'available'
        ? `/complaints/lookup/${evidence.complaintId}/evidence/${evidence.evidenceId}/download`
        : null,
    createdAt: evidence.createdAt
  };
}

export function serializeChatMessageForStaff(message, decryptedText, viewerRole) {
  const actor = message.senderActorCategory ||
    (message.senderRole === 'victim' ? 'reporter' : message.senderRole);
  return {
    messageId: message.messageId,
    complaintId: message.complaintId,
    sequence: message.sequence,
    senderRole: actor,
    senderName: actor === 'reporter' ? 'Reporter' : 'Authorized case participant',
    text: decryptedText,
    attachments: (message.attachments ?? []).map((attachment) => ({
      evidenceId: attachment.evidenceId
    })),
    deliveryState: message.deliveryState || 'persisted',
    createdAt: message.createdAt
  };
}
