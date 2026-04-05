import { Complaint } from '../models/complaint.model.js';
import { User } from '../models/user.model.js';
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
    recentNotifications
  ] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      Complaint.countDocuments(),
      Complaint.countDocuments({ 'assignedNgo.ngoId': { $ne: null } }),
      getRecentComplaints(),
      getComplaintStatusSummary(),
      getComplaintRiskSummary(),
      getComplaintTrend(),
      getComplaintHeatmapData(),
      countUnreadNotifications(),
      listRecentNotifications()
    ]);

  res.status(200).json({
    success: true,
    data: {
      appName: 'Dahej Control System',
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
      generatedAt: new Date().toISOString()
    }
  });
});

export const getDashboardComplaints = asyncHandler(async (req, res) => {
  const { status } = req.validated.complaintFilter;
  const complaints = await listComplaints({ status });

  res.status(200).json({
    success: true,
    data: {
      complaints
    }
  });
});

export const updateDashboardComplaintStatus = asyncHandler(async (req, res) => {
  const nextStatus = req.validated.complaintStatusUpdate.status;

  const complaint = await updateComplaintStatusByAnonymousId(req.params.anonymousId, nextStatus);

  res.status(200).json({
    success: true,
    message: 'Complaint status updated successfully.',
    data: {
      complaint
    }
  });
});
