import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { NGO } from '../models/ngo.model.js';
import { User } from '../models/user.model.js';
import { Complaint } from '../models/complaint.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createAuditLog } from '../services/audit.service.js';

// Register NGO
export const registerNgo = asyncHandler(async (req, res) => {
  const { name, email, password, phone, city, district, description, servedCities, servedDistricts } = req.body;

  if (!name || !email || !password || !phone || !city || !district) {
    throw new ApiError(400, 'Please fill out all required NGO profile fields.');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(400, 'An account with this email already exists.');
  }

  // Create pending User
  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: 'user', // remains simple user until approved
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

  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    role: 'guest',
    action: 'admin_action',
    details: { msg: 'NGO registered (pending approval)', ngoId: ngo.id },
    req
  });

  res.status(201).json({
    success: true,
    message: 'NGO registration submitted. Awaiting administrator review.',
    data: { ngo }
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

  // If approved, update corresponding user's role to 'ngo' and verify
  if (status === 'approved' && ngo.userId) {
    const user = await User.findById(ngo.userId);
    if (user) {
      user.role = 'ngo';
      user.isVerified = true;
      await user.save();
    }
  }

  await createAuditLog({
    userId: req.user.id,
    userEmail: req.user.email,
    role: req.user.role,
    action: 'admin_action',
    details: { msg: `NGO status set to ${status}`, ngoId: id, notes },
    req
  });

  res.status(200).json({
    success: true,
    message: `NGO successfully ${status}.`,
    data: { ngo }
  });
});

// List NGOs (filter by status)
export const listNgos = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status) {
    query.status = status;
  }
  const ngos = await NGO.find(query).sort({ createdAt: -1 }).lean();
  res.status(200).json({
    success: true,
    data: { ngos }
  });
});

// NGO Analytics dashboard
export const getNgoDashboard = asyncHandler(async (req, res) => {
  // Find NGO corresponding to active user
  const ngo = await NGO.findOne({ userId: req.user.id }).lean();
  if (!ngo) {
    throw new ApiError(404, 'NGO profile not found for this account.');
  }

  // Count assigned complaints
  const totalAssigned = await Complaint.countDocuments({ 'assignedNgo.ngoId': ngo.id || ngo._id.toString() });
  const openCases = await Complaint.countDocuments({
    'assignedNgo.ngoId': ngo.id || ngo._id.toString(),
    status: { $in: ['submitted', 'under-review'] }
  });
  const resolvedCases = await Complaint.countDocuments({
    'assignedNgo.ngoId': ngo.id || ngo._id.toString(),
    status: 'resolved'
  });

  res.status(200).json({
    success: true,
    data: {
      profile: ngo,
      metrics: {
        totalAssigned,
        openCases,
        resolvedCases,
        resolutionRate: totalAssigned > 0 ? Math.round((resolvedCases / totalAssigned) * 100) : 0
      }
    }
  });
});
