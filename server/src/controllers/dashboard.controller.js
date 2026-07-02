import { Complaint } from '../models/complaint.model.js';
import { env } from '../config/env.js';
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
import { sendSuccess } from '../utils/apiResponse.js';
import { buildPaginationMeta, escapeRegExp } from '../utils/query.js';

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

  return sendSuccess(res, {
    message: 'Dashboard summary fetched successfully.',
    data: {
      appName: `${env.appName} Operations Control`,
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
  const filter = req.validated.complaintFilter;

  const result = await listComplaints({
    status: filter.status,
    riskLevel: filter.riskLevel,
    assignedNgoId: filter.assignedNgoId,
    assignedInvestigatorId: filter.assignedInvestigatorId,
    search: filter.search,
    page: filter.page,
    limit: filter.limit,
    skip: filter.skip,
    sort: filter.sort
  });

  return sendSuccess(res, {
    message: 'Complaints fetched successfully.',
    data: result,
    meta: { pagination: result.pagination }
  });
});

export const updateDashboardComplaintStatus = asyncHandler(async (req, res) => {
  const nextStatus = req.validated.complaintStatusUpdate.status;

  const complaint = await updateComplaintStatusByAnonymousId(req.params.anonymousId, nextStatus, req.user);

  return sendSuccess(res, {
    message: 'Complaint status updated successfully.',
    data: {
      complaint
    }
  });
});

// View system operations audit logs (Admin/SuperAdmin only)
export const getAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip, search, action, role, sort } = req.validated.auditLogQuery;
  const query = {};

  if (action) {
    query.action = action;
  }

  if (role) {
    query.role = role;
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), 'i');
    query.$or = [{ userEmail: regex }, { action: regex }, { role: regex }, { ipAddress: regex }];
  }

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean(),
    AuditLog.countDocuments(query)
  ]);

  const pagination = buildPaginationMeta({ total, page, limit });

  return sendSuccess(res, {
    message: 'Audit logs fetched successfully.',
    data: {
      logs,
      pagination
    },
    meta: { pagination }
  });
});

// Get Escalations (Admin/SuperAdmin)
export const getEscalations = asyncHandler(async (req, res) => {
  const { page, limit, skip, status, search, sort } = req.validated.escalationQuery;
  const query = {};

  if (status) {
    query.status = status;
  }

  if (search) {
    const regex = new RegExp(escapeRegExp(search), 'i');
    query.$or = [{ complaintId: regex }, { reason: regex }, { raisedByName: regex }, { raisedByRole: regex }];
  }

  const [escalations, total] = await Promise.all([
    Escalation.find(query).sort(sort).skip(skip).limit(limit).lean(),
    Escalation.countDocuments(query)
  ]);

  const pagination = buildPaginationMeta({ total, page, limit });

  return sendSuccess(res, {
    message: 'Escalations fetched successfully.',
    data: { escalations, pagination },
    meta: { pagination }
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

  return sendSuccess(res, {
    message: 'Detailed analytics fetched successfully.',
    data: {
      resolutionRate,
      ngoPerformance,
      districtStats,
      totalCases,
      escalationRate: totalCases > 0 ? Math.round(((await Escalation.countDocuments()) / totalCases) * 100) : 0
    }
  });
});
