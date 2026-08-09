import { env } from '../config/env.js';
import { mockNgoDirectory } from '../data/mock-ngos.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

const publicContent = {
  hero: {
    title: 'Your Silence Ends Here.',
    subtitle:
      'Anonymous protection and structured reporting for dowry harassment victims with NGO response workflows.'
  },
  navigation: [
    { to: '/', label: 'Home' },
    { to: '/report', label: 'Report' },
    { to: '/dashboard', label: 'Dashboard' }
  ],
  publicFeatures: [
    'Anonymous case ID generation',
    'Approximate location sharing with consent',
    'Encrypted private evidence storage',
    'Local risk triage and NGO routing',
    'Case status tracking'
  ],
  safetyNotice:
    'Do not share your name, phone number, exact address, GPS coordinates, bank details, or other identifying information.'
};

export const getPlatformConfig = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    message: 'Platform configuration fetched successfully.',
    data: {
      appName: env.appName,
      apiVersion: env.apiVersion,
      environment: env.nodeEnv,
      features: {
        anonymousComplaints: true,
        mediaUpload: true,
        chatbot: false,
        mfa: true,
        auditLogging: true,
        sosInternalSupport: env.sosEnabled && env.sosInternalRoutingEnabled,
        sosLocation: env.sosEnabled && env.sosLocationEnabled,
        sosExternalDelivery: false
      }
    }
  });
});

export const getPublicContent = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    message: 'Public content fetched successfully.',
    data: {
      content: publicContent,
      ngoDirectoryPreview: mockNgoDirectory.map(({ ngoId, name, city, district, coverageLabel }) => ({
        ngoId,
        name,
        city,
        district,
        coverageLabel
      }))
    }
  });
});
