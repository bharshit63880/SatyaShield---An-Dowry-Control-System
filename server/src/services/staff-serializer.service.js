export function serializeNgoDirectoryEntry(ngo) {
  return {
    ngoId: ngo.publicId,
    name: ngo.name,
    email: ngo.email,
    city: ngo.city,
    district: ngo.district,
    supportedCategories: ngo.supportedCategories ?? [],
    supportedLanguages: ngo.supportedLanguages ?? [],
    coverage: ngo.coverage ?? [],
    status: ngo.verificationStatus,
    profileVersion: ngo.profileVersion,
    operationalStatus: ngo.operationalStatus,
    description: ngo.description ?? null,
    metrics: ngo.metrics ?? {},
    createdAt: ngo.createdAt
  };
}

export function serializeInvestigatorDirectoryEntry(investigator) {
  return {
    investigatorId: String(investigator.userId),
    name: investigator.name,
    badgeNumber: investigator.badgeNumber,
    agency: investigator.agency,
    phone: investigator.phone,
    isActive: investigator.isActive,
    isEligible: investigator.isEligible,
    assignedDistricts: investigator.assignedDistricts ?? [],
    assignedCities: investigator.assignedCities ?? [],
    activeCasesCount: investigator.activeCasesCount ?? 0,
    totalCasesAssigned: investigator.totalCasesAssigned ?? 0,
    createdAt: investigator.createdAt
  };
}

export function serializeEscalationForAdmin(escalation) {
  return {
    escalationId: escalation.escalationId,
    complaintId: escalation.complaintId,
    level: escalation.level,
    triggerCategory: escalation.triggerCategory,
    reasonCodes: escalation.reasonCodes ?? [],
    assignedRoleCategory: escalation.assignedRoleCategory,
    status: escalation.status,
    version: escalation.version,
    policyVersion: escalation.policyVersion,
    acknowledgedAt: escalation.acknowledgedAt ?? null,
    resolutionCategory: escalation.resolutionCategory ?? null,
    resolvedAt: escalation.resolvedAt ?? null,
    createdAt: escalation.createdAt
  };
}

export function serializeAuditLogForAdmin(log) {
  return {
    actorCategory: log.actorCategory,
    action: log.action,
    resourceType: log.resourceType,
    resourceRef: log.resourceRef,
    outcome: log.outcome,
    errorCode: log.errorCode ?? null,
    metadata: log.metadata ?? {},
    requestId: log.requestId ?? null,
    createdAt: log.createdAt
  };
}

export function serializeNotificationForAdmin(notification) {
  return {
    type: notification.type,
    title: notification.title,
    eventClass: notification.eventClass,
    severity: notification.severity,
    resourceRef: notification.resourceRef,
    deliveryState: notification.deliveryState,
    isRead: notification.isRead,
    createdAt: notification.createdAt
  };
}
