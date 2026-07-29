import {
  createComplaint,
  exchangeReporterAccessCredentials,
  serializeComplaintForReporter,
  serializeComplaintForRole,
  serializeComplaintForAdmin,
  updateComplaintStatusByAnonymousId,
  assignInvestigatorToComplaint
} from '../services/complaint.service.js';
import { createNewComplaintNotification, sendStatusUpdateNotification } from '../services/notification.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Complaint } from '../models/complaint.model.js';
import { CaseHistory } from '../models/case-history.model.js';
import { Evidence } from '../models/evidence.model.js';
import { Escalation } from '../models/escalation.model.js';
import { NGO } from '../models/ngo.model.js';
import { Investigator } from '../models/investigator.model.js';
import { decryptSensitiveValue } from '../utils/crypto.js';
import { createAuditLog } from '../services/audit.service.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { buildPaginationMeta, parsePagination } from '../utils/query.js';
import {
  serializeEvidenceForReporter,
  serializeEvidenceForStaff,
  serializeTimelineForReporter,
  serializeTimelineForStaff
} from '../services/reporter-serializer.service.js';
import { assertAdministrativeWorkflow } from '../services/authorization.service.js';
import { serializeEscalationForAdmin } from '../services/staff-serializer.service.js';
import {
  createManualEscalation, transitionEscalation
} from '../services/escalation-workflow.service.js';
import { revokeRealtimeComplaintAccess } from '../services/realtime-revocation.service.js';
import {
  createVaultEvidence,
  openVaultEvidence,
  safeDownloadFilename
} from '../services/evidence-vault.service.js';
import { localPrivateStorageProvider } from '../services/storage/local-private-storage.provider.js';
import { TriageAssessment } from '../models/triage-assessment.model.js';

// 1. Submit Anonymous Complaint
export const submitComplaint = asyncHandler(async (req, res) => {
  const {
    description, locationConsent, approximateLocation, privacyAcknowledged,
    privacyNoticeVersion, consentVersion, aiConsent, aiDisclosureVersion,
    complaintCategory, preferredLanguage, triageInput
  } = req.validated.complaint;

  let createdComplaint;
  try {
    const { complaint, accessSecret } = await createComplaint({
      description,
      mediaUrl: null,
      mediaType: 'none',
      locationConsent,
      approximateLocation,
      privacyAcknowledged,
      privacyNoticeVersion,
      consentVersion,
      aiConsent,
      aiDisclosureVersion,
      complaintCategory,
      preferredLanguage,
      triageInput
    });
    createdComplaint = complaint;

    if (req.file) {
      const evidence = await createVaultEvidence({
        file: req.file,
        complaintId: complaint.anonymousId,
        req
      });
      complaint.mediaType = evidence.category === 'video' ? 'video' : 'image';
      await complaint.save();
    }
    await createNewComplaintNotification(complaint);
    const assessment = await TriageAssessment.findOne({
      complaintId: complaint.anonymousId, isCurrent: true
    }).lean();
    await createAuditLog({
      role: 'reporter', action: assessment?.severity === 'critical'
        ? 'triage_marked_critical'
        : assessment?.reviewState === 'review_required'
          ? 'triage_review_required' : 'triage_assessed',
      resourceType: 'complaint', resourceRef: complaint.anonymousId,
      details: {
        stateTo: assessment?.severity, policyVersion: assessment?.triagePolicyVersion,
        assessmentSource: 'deterministic'
      }, req
    });

    return sendCreated(res, {
      message: 'Complaint submitted successfully.',
      data: {
        caseId: complaint.anonymousId,
        accessSecret,
        createdAt: complaint.createdAt
      }
    });
  } catch (error) {
    if (req.file && createdComplaint) {
      const storedEvidence = await Evidence.findOne({ complaintId: createdComplaint.anonymousId })
        .select('+storageId');
      if (storedEvidence?.storageId) {
        await localPrivateStorageProvider.delete(storedEvidence.storageId).catch(() => {});
      }
      await Promise.all([
        Evidence.deleteMany({ complaintId: createdComplaint.anonymousId }),
        CaseHistory.deleteMany({ complaintId: createdComplaint.anonymousId }),
        TriageAssessment.deleteMany({ complaintId: createdComplaint.anonymousId }),
        Complaint.deleteOne({ _id: createdComplaint._id })
      ]);
    }
    throw error;
  }
});

export const exchangeReporterAccess = asyncHandler(async (req, res) => {
  const result = await exchangeReporterAccessCredentials(req.validated.reporterAccess);
  return sendSuccess(res, {
    message: 'Reporter case access granted.',
    data: result
  });
});

// 2. Public Lookup (Anonymous Case Status Details)
export const lookupComplaint = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const complaint = req.authorizedComplaint ?? await Complaint.findOne({ anonymousId })
    .select('+approximateLocationEncrypted +descriptionEncrypted').lean();

  if (!complaint) {
    throw new ApiError(404, 'No complaint found matching this tracking ID.');
  }

  return sendSuccess(res, {
    message: 'Complaint fetched successfully.',
    data: {
      complaint: req.reporterCaseAccess
        ? serializeComplaintForReporter(complaint)
        : serializeComplaintForRole(complaint, req.user.role)
    }
  });
});

// 3. Public Case Timeline History
export const getComplaintTimeline = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const { page, limit, skip } = parsePagination({ page: req.query.page, limit: req.query.limit ?? 50 });
  const [history, total] = await Promise.all([
    CaseHistory.find({ complaintId: anonymousId })
    .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
    .lean(),
    CaseHistory.countDocuments({ complaintId: anonymousId })
  ]);
  const pagination = buildPaginationMeta({ total, page, limit });

  const serializedHistory = req.reporterCaseAccess
    ? serializeTimelineForReporter(history)
    : serializeTimelineForStaff(history, req.user.role);

  return sendSuccess(res, {
    message: 'Complaint timeline fetched successfully.',
    data: { history: serializedHistory, pagination },
    meta: { pagination }
  });
});

// 4. Secure File Upload for Case Evidence
export const uploadComplaintEvidence = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  if (!req.file) {
    throw new ApiError(400, 'Please select a file to upload as evidence.');
  }

  const uploaderRole = req.user
    ? (['admin', 'superadmin'].includes(req.user.role) ? 'admin' : req.user.role)
    : 'victim';
  const evidence = await createVaultEvidence({
    file: req.file,
    complaintId: anonymousId,
    req,
    reporterVisible: Boolean(req.reporterCaseAccess)
  });

  await CaseHistory.create({
      complaintId: anonymousId,
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'Anonymous Reporter',
      userRole: uploaderRole,
      action: 'evidence_upload',
      description: 'New evidence uploaded to the private vault.'
    });

    await createAuditLog({
      userId: req.user ? req.user.id : null,
      userEmail: req.user ? req.user.email : 'anonymous',
      role: uploaderRole,
      action: 'evidence_upload',
      details: { anonymousId, evidenceId: evidence.evidenceId },
      req
    });

    return sendCreated(res, {
      message: 'Evidence uploaded securely.',
      data: {
        evidence: req.reporterCaseAccess
          ? serializeEvidenceForReporter(evidence)
          : serializeEvidenceForStaff(evidence)
      }
    });
});

// 5. Get evidence list
export const getEvidenceList = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const { page, limit, skip } = parsePagination({ page: req.query.page, limit: req.query.limit ?? 50 });
  const evidenceQuery = {
    complaintId: anonymousId,
    ...(req.reporterCaseAccess ? { reporterVisible: true } : {})
  };
  const [evidenceList, total] = await Promise.all([
    Evidence.find(evidenceQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Evidence.countDocuments(evidenceQuery)
  ]);
  const pagination = buildPaginationMeta({ total, page, limit });

  const serializedEvidence = req.reporterCaseAccess
    ? evidenceList.map(serializeEvidenceForReporter)
    : evidenceList.map(serializeEvidenceForStaff);

  return sendSuccess(res, {
    message: 'Evidence fetched successfully.',
    data: { evidenceList: serializedEvidence, pagination },
    meta: { pagination }
  });
});

export const downloadComplaintEvidence = asyncHandler(async (req, res) => {
  const { anonymousId, evidenceId } = req.params;
  const evidence = await Evidence.findOne({ evidenceId, complaintId: anonymousId })
    .select('+storageId +plaintextDigest')
    .lean();

  if (
    !evidence ||
    (req.reporterCaseAccess && evidence.reporterVisible !== true)
  ) {
    throw new ApiError(404, 'Evidence is unavailable.', { code: 'EVIDENCE_UNAVAILABLE' });
  }

  const plaintext = await openVaultEvidence({ evidence, req });
  const filename = safeDownloadFilename(evidence.originalName, evidence.detectedExtension);
  res.set({
    'Content-Type': evidence.detectedMimeType,
    'Content-Length': String(plaintext.length),
    'Content-Disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store, private, max-age=0',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Referrer-Policy': 'no-referrer',
    'Accept-Ranges': 'none'
  });
  return res.status(200).send(plaintext);
});

// 6. Raise Escalation
export const escalateComplaint = asyncHandler(async (req, res) => {
  assertAdministrativeWorkflow(req.user);
  const { anonymousId } = req.params;
  const reasonCategory = String(req.body.reasonCategory || 'administrative_review');
  const escalation = await createManualEscalation({
    complaintId: anonymousId, reasonCategory, actor: req.user,
    idempotencyKey: req.body.idempotencyKey
  });

  // Track timeline
  await CaseHistory.create({
    complaintId: anonymousId,
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'escalated',
    description: 'Case moved to additional internal review.'
  });

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'escalation_raised',
    details: {
      anonymousId, category: reasonCategory,
      policyVersion: escalation.policyVersion
    },
    req
  });

  return sendCreated(res, {
    message: 'Complaint escalated successfully.',
    data: { escalation: serializeEscalationForAdmin(escalation) }
  });
});

// 7. Resolve Escalation
export const resolveEscalation = asyncHandler(async (req, res) => {
  assertAdministrativeWorkflow(req.user);
  const { id } = req.params;
  const escalation = await transitionEscalation({
    escalationId: id,
    expectedVersion: req.body.version,
    action: 'resolve',
    reasonCategory: req.body.reasonCategory || 'workflow_completed',
    note: req.body.note,
    actor: req.user
  });

  // Track timeline
  await CaseHistory.create({
    complaintId: escalation.complaintId,
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'escalation_resolved',
    description: 'Internal review workflow completed.'
  });

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'escalation_resolved',
    details: {
      complaintId: escalation.complaintId,
      category: escalation.resolutionCategory,
      policyVersion: escalation.policyVersion
    },
    req
  });

  return sendSuccess(res, {
    message: 'Escalation resolved successfully.',
    data: { escalation: serializeEscalationForAdmin(escalation) }
  });
});

// 8. Assign NGO
export const assignNgo = asyncHandler(async (req, res) => {
  assertAdministrativeWorkflow(req.user);
  const { anonymousId } = req.params;
  const { ngoId } = req.body;

  const ngo = await NGO.findById(ngoId).lean();
  if (
    !ngo ||
    ngo.status !== 'approved' ||
    ngo.operationalStatus !== 'active' ||
    !ngo.userId
  ) {
    throw new ApiError(400, 'The selected NGO is not eligible for assignment.', {
      code: 'NGO_ASSIGNMENT_INELIGIBLE'
    });
  }

  const complaint = await Complaint.findOneAndUpdate(
    { anonymousId },
    {
      assignedNgo: {
        ngoId: ngo.id,
        name: ngo.name,
        city: ngo.city,
        district: ngo.district,
        coverageLabel: `${ngo.district} HQ`,
        contactPhone: ngo.phone,
        contactEmail: ngo.email,
        assignmentSource: 'admin-override',
        matchedOn: 'admin',
        assignedAt: new Date()
      }
    },
    { new: true }
  ).lean();

  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.');
  }

  await CaseHistory.create({
    complaintId: anonymousId,
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'ngo_assigned',
    description: `NGO Assigned: ${ngo.name}`
  });

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'assignment_change',
    details: { anonymousId, ngoName: ngo.name },
    req
  });

  return sendSuccess(res, {
    message: 'NGO assigned successfully.',
    data: { complaint: serializeComplaintForAdmin(complaint) }
  });
});

// 9. Assign Investigator
export const assignInvestigator = asyncHandler(async (req, res) => {
  assertAdministrativeWorkflow(req.user);
  const { anonymousId } = req.params;
  const { investigatorId } = req.body;

  const investigator = await Investigator.findOne({ userId: investigatorId }).lean();
  if (
    !investigator ||
    investigator.isActive !== true ||
    investigator.isEligible !== true
  ) {
    throw new ApiError(400, 'The selected investigator is not eligible for assignment.', {
      code: 'INVESTIGATOR_ASSIGNMENT_INELIGIBLE'
    });
  }

  const updated = await assignInvestigatorToComplaint(anonymousId, investigator, req.user);
  await revokeRealtimeComplaintAccess({
    complaintId: anonymousId, actorCategory: 'investigator'
  });

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'assignment_change',
    details: { anonymousId, investigatorName: investigator.name },
    req
  });

  return sendSuccess(res, {
    message: 'Investigator assigned successfully.',
    data: { complaint: updated }
  });
});
