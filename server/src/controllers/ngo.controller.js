import { NGO } from '../models/ngo.model.js';
import { User } from '../models/user.model.js';
import { Complaint } from '../models/complaint.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createAuditLog } from '../services/audit.service.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { buildPaginationMeta, escapeRegExp } from '../utils/query.js';
import { resolveStaffActor } from '../services/authorization.service.js';
import { serializeComplaintForNGO } from '../services/complaint.service.js';
import { serializeNgoDirectoryEntry } from '../services/staff-serializer.service.js';
import { hashPassword } from '../services/password.service.js';
import { resendVerification } from '../services/auth.service.js';
import { NgoAssignment } from '../models/ngo-assignment.model.js';

export const acknowledgeNgoAssignment = asyncHandler(async (req, res) => {
  const { anonymousId } = req.params;
  const acknowledgedAt = new Date();
  const complaint = await Complaint.findOneAndUpdate(
    {
      anonymousId,
      'assignedNgo.ngoId': req.staffActor.ngoId
    },
    { $set: { 'assignedNgo.acknowledgedAt': acknowledgedAt } },
    { new: true }
  )
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .lean();

  if (!complaint) {
    throw new ApiError(403, 'You are not authorized to perform this action.', {
      code: 'RESOURCE_ACCESS_DENIED'
    });
  }

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'assignment_acknowledged',
    details: { anonymousId },
    req
  });

  return sendSuccess(res, {
    message: 'Assignment acknowledged successfully.',
    data: { complaint: serializeComplaintForNGO(complaint) }
  });
});

// Register NGO
export const registerNgo = asyncHandler(async (req, res) => {
  const { name, email, password, phone, city, district, description, servedCities, servedDistricts } = req.body;

  if (!name || !email || !password || !phone || !city || !district) {
    throw new ApiError(400, 'Please fill out all required NGO profile fields.', {
      code: 'NGO_REQUIRED_FIELDS'
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(400, 'An account with this email already exists.', {
      code: 'NGO_ACCOUNT_EXISTS'
    });
  }

  // Create pending User
  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: 'ngo',
    isVerified: false
  });

  const ngo = await NGO.create({
    name,
    email: email.toLowerCase().trim(),
    phone,
    city,
    district,
    description,
    servedCities: servedCities || [city],
    servedDistricts: servedDistricts || [district],
    status: 'pending',
    userId: user.id
  });
  const delivery = await resendVerification(user.email, req);

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: 'guest',
    action: 'admin_action',
    details: { event: 'ngo_registration_submitted' },
    req
  });

  return sendCreated(res, {
    message: 'NGO registration submitted. Awaiting administrator review.',
    data: { ngo: serializeNgoDirectoryEntry(ngo), deliveryState: delivery.deliveryState }
  });
});

// Approve/Reject NGO Workflow
export const reviewNgo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Invalid status update. Choose approved or rejected.');
  }

  const ngo = await NGO.findById(id);
  if (!ngo) {
    throw new ApiError(404, 'NGO record not found.');
  }

  ngo.status = status;
  ngo.approvalWorkflow = {
    reviewerId: req.user.id,
    notes,
    approvedAt: new Date()
  };
  await ngo.save();

  // Approval and email verification are independent gates.
  if (status === 'approved' && ngo.userId) {
    const user = await User.findById(ngo.userId);
    if (user) {
      if (user.role !== 'ngo') {
        user.role = 'ngo';
        user.authVersion += 1;
      }
      await user.save();
    }
  }

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'admin_action',
    details: { event: 'ngo_reviewed', status, notesLength: notes?.length ?? 0 },
    req
  });

  return sendSuccess(res, {
    message: `NGO successfully ${status}.`,
    data: { ngo: serializeNgoDirectoryEntry(ngo) }
  });
});

// List NGOs (filter by status)
export const listNgos = asyncHandler(async (req, res) => {
  const { page, limit, skip, status, city, district, search, sort } = req.validated.ngoListQuery;
  const query = {};
  if (status) {
    query.status = status;
  }
  if (city) {
    query.city = new RegExp(`^${escapeRegExp(city)}$`, 'i');
  }
  if (district) {
    query.district = new RegExp(`^${escapeRegExp(district)}$`, 'i');
  }
  if (search) {
    const regex = new RegExp(escapeRegExp(search), 'i');
    query.$or = [{ name: regex }, { email: regex }, { city: regex }, { district: regex }];
  }

  const [ngos, total] = await Promise.all([
    NGO.find(query).sort(sort).skip(skip).limit(limit).lean(),
    NGO.countDocuments(query)
  ]);
  const pagination = buildPaginationMeta({ total, page, limit });

  return sendSuccess(res, {
    message: 'NGOs fetched successfully.',
    data: { ngos: ngos.map(serializeNgoDirectoryEntry), pagination },
    meta: { pagination }
  });
});

// NGO Analytics dashboard
export const getNgoDashboard = asyncHandler(async (req, res) => {
  const actor = await resolveStaffActor(req.user);
  const ngo = actor.profile;

  const currentAssignments = await NgoAssignment.find({
    ngoPublicId: actor.ngoId, isCurrent: true, state: { $in: ['acknowledged', 'active'] }
  }).select('complaintId -_id').lean();
  const complaintIds = currentAssignments.map((item) => item.complaintId);
  const totalAssigned = complaintIds.length;
  const openCases = await Complaint.countDocuments({
    anonymousId: { $in: complaintIds }, status: { $in: ['submitted', 'under-review'] }
  });
  const resolvedCases = await Complaint.countDocuments({
    anonymousId: { $in: complaintIds }, status: 'resolved'
  });
  const complaints = await Complaint.find({ anonymousId: { $in: complaintIds } })
    .select('+approximateLocationEncrypted +descriptionEncrypted')
    .sort({ timestamp: -1 })
    .lean();

  return sendSuccess(res, {
    message: 'NGO dashboard fetched successfully.',
    data: {
      profile: {
        name: ngo.name,
        email: ngo.email,
        phone: ngo.phone,
        city: ngo.city,
        district: ngo.district,
        servedCities: ngo.servedCities ?? [],
        servedDistricts: ngo.servedDistricts ?? [],
        status: ngo.verificationStatus,
        operationalStatus: ngo.operationalStatus
      },
      complaints: complaints.map(serializeComplaintForNGO),
      metrics: {
        totalAssigned,
        openCases,
        resolvedCases,
        resolutionRate: totalAssigned > 0 ? Math.round((resolvedCases / totalAssigned) * 100) : 0
      }
    }
  });
});
