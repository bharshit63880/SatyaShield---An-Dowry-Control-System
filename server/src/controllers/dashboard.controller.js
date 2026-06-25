import { Complaint } from '../models/complaint.model.js';
import { User } from '../models/user.model.js';
import { NGO } from '../models/ngo.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import { Escalation } from '../models/escalation.model.js';
import {
  getComplaintHeatmapData,
  getComplaintRiskSummary,
  getComplaintStatusSummary,
  getComplaintTrend,
  getRecentComplaints,
  listComplaints,
  updateComplaintStatusByAnonymousId
} from '../services/complaint.service.js';
import { countUnreadNotifications, listRecentNotifications } from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    adminUsers,
    totalComplaints,
    totalNgoAssigned,
    recentComplaints,
    complaintStatusSummary,
    complaintRiskSummary,
    complaintTrend,
    complaintHeatmap,
    unreadNotifications,
    recentNotifications,
    escalationCount,
    ngoCount
  ] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: { $in: ['admin', 'superadmin'] } }),
      Complaint.countDocuments(),
      Complaint.countDocuments({ 'assignedNgo.ngoId': { $ne: null } }),
      getRecentComplaints(),
      getComplaintStatusSummary(),
      getComplaintRiskSummary(),
      getComplaintTrend(),
      getComplaintHeatmapData(),
      countUnreadNotifications(),
      listRecentNotifications(),
      Escalation.countDocuments({ status: 'pending' }),
      NGO.countDocuments()
    ]);

  res.status(200).json({
    success: true,
    data: {
      appName: 'SatyaShield Operations Control',
      totalUsers,
      adminUsers,
      totalComplaints,
      totalNgoAssigned,
      currentAdmin: {
        role: req.user.role
      },
      complaintStatusSummary,
      complaintRiskSummary,
      complaintTrend,
      complaintHeatmap,
      unreadNotifications,
      recentNotifications,
      recentComplaints,
      escalationCount,
      ngoCount,
      generatedAt: new Date().toISOString()
    }
  });
});

export const getDashboardComplaints = asyncHandler(async (req, res) => {
  const { status, riskLevel, search, page, limit } = req.query;

  const result = await listComplaints({
    status: status || 'all',
    riskLevel: riskLevel || 'all',
    search: search || '',
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

export const updateDashboardComplaintStatus = asyncHandler(async (req, res) => {
  const nextStatus = req.body.status;

  const complaint = await updateComplaintStatusByAnonymousId(req.params.anonymousId, nextStatus, req.user);

  res.status(200).json({
    success: true,
    message: 'Complaint status updated successfully.',
    data: {
      complaint
    }
  });
});

// View system operations audit logs (Admin/SuperAdmin only)
export const getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const logs = await AuditLog.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await AuditLog.countDocuments();

  res.status(200).json({
    success: true,
    data: {
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get Escalations (Admin/SuperAdmin)
export const getEscalations = asyncHandler(async (req, res) => {
  const escalations = await Escalation.find().sort({ createdAt: -1 }).lean();
  res.status(200).json({
    success: true,
    data: { escalations }
  });
});

// Advanced Analytics Panel
export const getDetailedAnalytics = asyncHandler(async (req, res) => {
  // NGO Performance aggregation
  const ngoPerformance = await NGO.find({}, 'name metrics').lean();

  // Resolution and response time estimation
  const totalCases = await Complaint.countDocuments();
  const resolvedCases = await Complaint.countDocuments({ status: 'resolved' });
  const rejectedCases = await Complaint.countDocuments({ status: 'rejected' });
  
  const resolutionRate = totalCases > 0 ? Math.round(((resolvedCases + rejectedCases) / totalCases) * 100) : 0;

  // Aggregate by district
  const districtStats = await getComplaintHeatmapData(50);

  res.status(200).json({
    success: true,
    data: {
      resolutionRate,
      ngoPerformance,
      districtStats,
      totalCases,
      escalationRate: totalCases > 0 ? Math.round(((await Escalation.countDocuments()) / totalCases) * 100) : 0
    }
  });
});
