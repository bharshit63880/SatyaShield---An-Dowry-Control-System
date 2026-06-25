import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';

import { env } from '../config/env.js';
import {
  createComplaint,
  hasRecentComplaintFingerprint,
  serializeComplaintForAdmin,
  updateComplaintStatusByAnonymousId,
  assignInvestigatorToComplaint
} from '../services/complaint.service.js';
import { sanitizeUploadedMedia } from '../services/media-privacy.service.js';
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

function getMediaUrl(req, filename) {
  if (!filename) {
    return null;
  }

  const baseUrl = env.serverPublicUrl || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${filename}`;
}

function getMediaType(file) {
  if (!file) {
    return 'none';
  }

  return file.mimetype.startsWith('video/') ? 'video' : 'image';
}

// 1. Submit Anonymous Complaint
export const submitComplaint = asyncHandler(async (req, res) => {
  const { description, locationConsent, approximateLocation, submissionFingerprintHash } =
    req.validated.complaint;

  if (await hasRecentComplaintFingerprint(submissionFingerprintHash)) {
    throw new ApiError(
      429,
      'This complaint looks like a recent duplicate submission. Please wait before sending it again.',
      {
        code: 'COMPLAINT_DUPLICATE_SUBMISSION'
      }
    );
  }

  const sanitizedMedia = await sanitizeUploadedMedia(req.file);

  try {
    const complaint = await createComplaint({
      description,
      mediaUrl: getMediaUrl(req, sanitizedMedia?.filename),
      mediaType: getMediaType(sanitizedMedia ?? req.file),
      locationConsent,
      approximateLocation,
      submissionFingerprintHash
    });

    await createNewComplaintNotification(complaint);

    // If media was uploaded, create an Evidence record
    if (sanitizedMedia) {
      const fileBuffer = await fs.readFile(sanitizedMedia.path);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      await Evidence.create({
        complaintId: complaint.anonymousId,
        category: getMediaType(sanitizedMedia),
        fileUrl: complaint.mediaUrl,
        originalName: req.file.originalname,
        mimeType: sanitizedMedia.mimetype,
        fileSize: req.file.size,
        fileHash,
        uploadedBy: 'victim'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      data: {
        complaint: serializeComplaintForAdmin(complaint)
      }
    });
  } catch (error) {
    if (sanitizedMedia?.path) {
      await fs.rm(sanitizedMedia.path, { force: true }).catch(() => {});
    }

    throw error;
  }
});

// 2. Public Lookup (Anonymous Case Status Details)
export const lookupComplaint = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const complaint = await Complaint.findOne({ anonymousId })
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .lean();

  if (!complaint) {
    throw new ApiError(404, 'No complaint found matching this tracking ID.');
  }

  res.status(200).json({
    success: true,
    data: {
      complaint: serializeComplaintForAdmin(complaint)
    }
  });
});

// 3. Public Case Timeline History
export const getComplaintTimeline = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const history = await CaseHistory.find({ complaintId: anonymousId })
    .sort({ createdAt: 1 })
    .lean();

  res.status(200).json({
    success: true,
    data: { history }
  });
});

// 4. Secure File Upload for Case Evidence
export const uploadComplaintEvidence = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const complaint = await Complaint.findOne({ anonymousId }).lean();

  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.');
  }

  if (!req.file) {
    throw new ApiError(400, 'Please select a file to upload as evidence.');
  }

  const sanitized = await sanitizeUploadedMedia(req.file);

  try {
    const fileUrl = getMediaUrl(req, sanitized.filename);
    const fileBuffer = await fs.readFile(sanitized.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Duplicate Check
    const duplicate = await Evidence.findOne({ fileHash }).lean();
    if (duplicate) {
      await fs.rm(sanitized.path, { force: true }).catch(() => {});
      throw new ApiError(409, 'This file has already been uploaded as evidence for this platform.', {
        code: 'EVIDENCE_DUPLICATE'
      });
    }

    // Role detection
    const uploaderRole = req.user ? req.user.role : 'victim';

    const evidence = await Evidence.create({
      complaintId: anonymousId,
      category: req.file.mimetype.startsWith('video/') ? 'video' : 'image',
      fileUrl,
      originalName: req.file.originalname,
      mimeType: sanitized.mimetype,
      fileSize: req.file.size,
      fileHash,
      uploadedBy: uploaderRole,
      uploaderId: req.user ? req.user.id : null
    });

    // Write timeline trace
    await CaseHistory.create({
      complaintId: anonymousId,
      userId: req.user ? req.user.id : null,
      userName: req.user ? req.user.name : 'Anonymous Reporter',
      userRole: uploaderRole,
      action: 'evidence_upload',
      description: `New evidence uploaded: ${req.file.originalname}`
    });

    await createAuditLog({
      userId: req.user ? req.user.id : null,
      userEmail: req.user ? req.user.email : 'anonymous',
      role: uploaderRole,
      action: 'evidence_upload',
      details: { anonymousId, fileUrl },
      req
    });

    res.status(201).json({
      success: true,
      message: 'Evidence uploaded securely.',
      data: { evidence }
    });
  } catch (error) {
    if (sanitized?.path) {
      await fs.rm(sanitized.path, { force: true }).catch(() => {});
    }
    throw error;
  }
});

// 5. Get evidence list
export const getEvidenceList = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const evidenceList = await Evidence.find({ complaintId: anonymousId }).sort({ createdAt: -1 }).lean();
  res.status(200).json({
    success: true,
    data: { evidenceList }
  });
});

// 6. Raise Escalation
export const escalateComplaint = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Provide a reason for the escalation.');
  }

  const complaint = await Complaint.findOne({ anonymousId }).lean();
  if (!complaint) {
    throw new ApiError(404, 'Complaint not found.');
  }

  const escalation = await Escalation.create({
    complaintId: anonymousId,
    reason,
    raisedById: req.user.id,
    raisedByName: req.user.name,
    raisedByRole: req.user.role
  });

  // Track timeline
  await CaseHistory.create({
    complaintId: anonymousId,
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'escalated',
    description: `Case escalated: ${reason}`
  });

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'escalation_raised',
    details: { anonymousId, reason },
    req
  });

  res.status(201).json({
    success: true,
    message: 'Complaint escalated successfully.',
    data: { escalation }
  });
});

// 7. Resolve Escalation
export const resolveEscalation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body;

  if (!resolution) {
    throw new ApiError(400, 'Provide a resolution description.');
  }

  const escalation = await Escalation.findById(id);
  if (!escalation) {
    throw new ApiError(404, 'Escalation record not found.');
  }

  escalation.status = 'resolved';
  escalation.resolution = resolution;
  escalation.resolvedById = req.user.id;
  escalation.resolvedAt = new Date();
  await escalation.save();

  // Track timeline
  await CaseHistory.create({
    complaintId: escalation.complaintId,
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'escalation_resolved',
    description: `Escalation resolved: ${resolution}`
  });

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'escalation_resolved',
    details: { escalationId: id, resolution },
    req
  });

  res.status(200).json({
    success: true,
    message: 'Escalation resolved successfully.',
    data: { escalation }
  });
});

// 8. Assign NGO
export const assignNgo = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const { ngoId } = req.body;

  const ngo = await NGO.findById(ngoId).lean();
  if (!ngo) {
    throw new ApiError(404, 'NGO not found.');
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

  res.status(200).json({
    success: true,
    data: { complaint: serializeComplaintForAdmin(complaint) }
  });
});

// 9. Assign Investigator
export const assignInvestigator = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const { investigatorId } = req.body;

  const investigator = await Investigator.findOne({ userId: investigatorId }).lean();
  if (!investigator) {
    throw new ApiError(404, 'Investigator not found.');
  }

  const updated = await assignInvestigatorToComplaint(anonymousId, investigator, req.user);

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'assignment_change',
    details: { anonymousId, investigatorName: investigator.name },
    req
  });

  res.status(200).json({
    success: true,
    data: { complaint: updated }
  });
});
