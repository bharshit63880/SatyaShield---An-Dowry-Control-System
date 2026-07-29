import { Investigator } from '../models/investigator.model.js';
import { User } from '../models/user.model.js';
import { Complaint } from '../models/complaint.model.js';
import { CaseHistory } from '../models/case-history.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createAuditLog } from '../services/audit.service.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { buildPaginationMeta, escapeRegExp } from '../utils/query.js';
import { resolveStaffActor } from '../services/authorization.service.js';
import { serializeComplaintForInvestigator } from '../services/complaint.service.js';
import { serializeInvestigatorDirectoryEntry } from '../services/staff-serializer.service.js';
import { hashPassword } from '../services/password.service.js';
import { resendVerification } from '../services/auth.service.js';

// Admin-only register investigator
export const registerInvestigator = asyncHandler(async (req, res) => {
  const { name, email, password, badgeNumber, agency, phone, assignedDistricts, assignedCities } = req.body;

  if (!name || !email || !password || !badgeNumber || !agency || !phone) {
    throw new ApiError(400, 'Please complete all required Investigator profile fields.');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(400, 'An account with this email already exists.');
  }

  // Create Investigator User
  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: 'investigator',
    isVerified: false
  });

  const investigator = await Investigator.create({
    userId: user.id,
    name,
    badgeNumber,
    agency,
    phone,
    assignedDistricts: assignedDistricts || [],
    assignedCities: assignedCities || []
  });
  const delivery = await resendVerification(user.email, req);

  await createAuditLog({
    userId: req.user?.id || user.id,
    userEmail: req.user?.email || user.email,
    role: req.user?.role || 'admin',
    action: 'admin_action',
    details: { event: 'investigator_registered', badgeNumber },
    req
  });

  return sendCreated(res, {
    message: 'Investigator account created successfully.',
    data: {
      investigator: serializeInvestigatorDirectoryEntry(investigator),
      deliveryState: delivery.deliveryState
    }
  });
});

// List Investigators
export const listInvestigators = asyncHandler(async (req, res) => {
  const { page, limit, skip, agency, search, sort } = req.validated.investigatorListQuery;
  const query = {};

  if (agency) {
    query.agency = new RegExp(escapeRegExp(agency), 'i');
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), 'i');
    query.$or = [{ name: regex }, { badgeNumber: regex }, { agency: regex }, { phone: regex }];
  }

  const [investigators, total] = await Promise.all([
    Investigator.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Investigator.countDocuments(query)
  ]);
  const pagination = buildPaginationMeta({ total, page, limit });

  return sendSuccess(res, {
    message: 'Investigators fetched successfully.',
    data: { investigators: investigators.map(serializeInvestigatorDirectoryEntry), pagination },
    meta: { pagination }
  });
});

// Investigator dashboard and case list
export const getInvestigatorDashboard = asyncHandler(async (req, res) => {
  const actor = await resolveStaffActor(req.user);
  const investigator = actor.profile;

  // Fetch assigned complaints
  const complaints = await Complaint.find({ 'assignedInvestigator.investigatorId': req.user.id })
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .sort({ timestamp: -1 })
    .lean();

  const totalAssigned = complaints.length;
  const activeCases = complaints.filter((c) => ['submitted', 'under-review'].includes(c.status)).length;
  const resolvedCases = complaints.filter((c) => c.status === 'resolved').length;

  return sendSuccess(res, {
    message: 'Investigator dashboard fetched successfully.',
    data: {
      profile: {
        name: investigator.name,
        badgeNumber: investigator.badgeNumber,
        agency: investigator.agency,
        phone: investigator.phone,
        assignedDistricts: investigator.assignedDistricts ?? [],
        assignedCities: investigator.assignedCities ?? [],
        isActive: investigator.isActive,
        isEligible: investigator.isEligible
      },
      complaints: complaints.map(serializeComplaintForInvestigator),
      metrics: {
        totalAssigned,
        activeCases,
        resolvedCases
      }
    }
  });
});

// Add investigation notes to timeline
export const addInvestigationNote = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const { note } = req.body;

  if (!note) {
    throw new ApiError(400, 'Investigation note content cannot be empty.');
  }

  if (!req.authorizedComplaint) {
    throw new ApiError(403, 'You are not authorized to add notes to this complaint.', {
      code: 'RESOURCE_ACCESS_DENIED'
    });
  }

  // Create Case History Log
  const history = await CaseHistory.create({
    complaintId: anonymousId,
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    action: 'investigation_note',
    description: `[INVESTIGATION NOTE] ${note}`
  });

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'case_edit',
    details: { anonymousId, noteLength: note.length },
    req
  });

  return sendCreated(res, {
    message: 'Investigation note added successfully.',
    data: {
      history: {
        action: history.action,
        description: history.description,
        actorRole: history.userRole,
        createdAt: history.createdAt
      }
    }
  });
});
