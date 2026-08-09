function resolveApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

  if (!configuredBaseUrl) {
    return '/api/v1';
  }

  return configuredBaseUrl.replace(/\/+$/, '');
}

const API_BASE_URL = resolveApiBaseUrl();
let staffAccessToken = null;
let csrfToken = null;
let refreshPromise = null;

export function getPlatformConfigRequest() {
  return request('/platform/config');
}

export function setStaffAuthState(nextAccessToken, nextCsrfToken = csrfToken) {
  staffAccessToken = nextAccessToken;
  csrfToken = nextCsrfToken;
}

function readCsrfCookie() {
  if (typeof document === 'undefined') return null;
  const item = document.cookie.split(';').map((value) => value.trim())
    .find((value) => value.startsWith('ss_csrf='));
  return item ? decodeURIComponent(item.slice('ss_csrf='.length)) : null;
}

async function refreshStaffSession() {
  if (!refreshPromise) {
    refreshPromise = request('/auth/refresh', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken || readCsrfCookie() },
      _skipRefresh: true
    }).then((payload) => {
      setStaffAuthState(payload.data.accessToken, payload.data.csrfToken);
      return payload.data.accessToken;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request(path, options = {}) {
  const { token, headers, body, _skipRefresh = false, ...restOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
      credentials: 'include',
      ...restOptions
    });
  } catch (_error) {
    throw new Error('Unable to reach the server right now. Please try again in a moment.');
  }

  const payload = await response.json().catch(() => ({
    message: 'Unexpected server response.'
  }));

  if (!response.ok) {
    if (
      response.status === 401 && !_skipRefresh && token &&
      token === staffAccessToken && path !== '/auth/refresh'
    ) {
      const nextToken = await refreshStaffSession();
      return request(path, { ...options, token: nextToken, _skipRefresh: true });
    }
    const error = new Error(payload.message || 'Request failed.');
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }

  return payload;
}

// Authentication
export function loginRequest(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: credentials
  });
}

export function loginMfaRequest(payload) {
  return request('/auth/login/mfa', {
    method: 'POST',
    body: payload
  });
}

export function refreshSessionRequest() {
  return refreshStaffSession();
}

export function logoutRequest() {
  return request('/auth/logout', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken || readCsrfCookie() },
    _skipRefresh: true
  });
}

export function registerRequest(payload) {
  return request('/auth/register', {
    method: 'POST',
    body: payload
  });
}

export function getCurrentUser(token) {
  return request('/auth/me', {
    method: 'GET',
    token
  });
}

export function setupMfaRequest(token) {
  return request('/auth/mfa/setup', {
    method: 'POST',
    token
  });
}

export function enableMfaRequest(token, code) {
  return request('/auth/mfa/enable', {
    method: 'POST',
    token,
    body: { code }
  });
}

export function forgotPasswordRequest(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: { email }
  });
}

export function resetPasswordRequest(token, newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword }
  });
}

export function verifyEmailRequest(token) {
  return request('/auth/verify-email', { method: 'POST', body: { token } });
}

export function resendVerificationRequest(email) {
  return request('/auth/verification/resend', { method: 'POST', body: { email } });
}

export function changePasswordRequest(token, currentPassword, newPassword, code, recoveryCode) {
  return request('/auth/password/change', {
    method: 'POST', token, body: { currentPassword, newPassword, code, recoveryCode }
  });
}

export function listSessionsRequest(token) {
  return request('/auth/sessions', { method: 'GET', token });
}

export function revokeSessionRequest(token, sessionId) {
  return request(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', token });
}

// Phase 6 NGO verification and assignment operations
export const getNgoProfileRequest = (token) =>
  request('/ngos/profile/me', { method: 'GET', token });
export const updateNgoProfileRequest = (token, body) =>
  request('/ngos/profile/me', { method: 'PATCH', token, body });
export const submitNgoProfileRequest = (token) =>
  request('/ngos/profile/submit', { method: 'POST', token });
export const getNgoAssignmentsRequest = (token) =>
  request('/ngos/assignments', { method: 'GET', token });
export const getNgoOfferRequest = (token, assignmentId) =>
  request(`/ngos/assignments/${encodeURIComponent(assignmentId)}`, { method: 'GET', token });
export const acknowledgeNgoOfferRequest = (token, assignmentId) =>
  request(`/ngos/assignments/${encodeURIComponent(assignmentId)}/acknowledge`, { method: 'POST', token });
export const rejectNgoOfferRequest = (token, assignmentId, reasonCategory) =>
  request(`/ngos/assignments/${encodeURIComponent(assignmentId)}/reject`, {
    method: 'POST', token, body: { reasonCategory }
  });
export const getNgoReviewQueueRequest = (token) =>
  request('/dashboard/ngos/review-queue', { method: 'GET', token });
export const getNgoCandidatesRequest = (token, caseId) =>
  request(`/dashboard/complaints/${encodeURIComponent(caseId)}/ngo-candidates`, { method: 'GET', token });
export const createNgoOfferRequest = (token, caseId, ngoPublicId) =>
  request(`/dashboard/complaints/${encodeURIComponent(caseId)}/ngo-offers`, {
    method: 'POST', token, body: { ngoPublicId, source: 'routing_recommendation' }
  });
export const getTriageQueueRequest = (token, filters = {}) => {
  const query = new URLSearchParams(filters);
  return request(`/dashboard/triage/queue?${query}`, { method: 'GET', token });
};
export const getTriageHistoryRequest = (token, caseId) =>
  request(`/dashboard/complaints/${encodeURIComponent(caseId)}/triage`, { method: 'GET', token });
export const reviewTriageRequest = (token, caseId, body) =>
  request(`/dashboard/complaints/${encodeURIComponent(caseId)}/triage/review`, {
    method: 'POST', token, body
  });

export function regenerateRecoveryCodesRequest(token, proof) {
  return request('/auth/mfa/recovery/regenerate', { method: 'POST', token, body: proof });
}

export function logoutOtherSessionsRequest(token) {
  return request('/auth/sessions/logout-others', { method: 'POST', token });
}

export function logoutAllSessionsRequest(token) {
  return request('/auth/sessions/logout-all', { method: 'POST', token });
}

// Complaints - Anonymous Intake & Status Tracking
export function submitComplaintRequest(formData) {
  return request('/complaints', {
    method: 'POST',
    body: formData
  });
}

export function exchangeReporterAccessRequest(caseId, accessSecret) {
  return request('/complaints/reporter-access/token', {
    method: 'POST',
    body: { caseId, accessSecret }
  });
}

export function getPublicComplaintRequest(anonymousId, token) {
  return request(`/complaints/lookup/${anonymousId}`, {
    method: 'GET',
    token
  });
}

export function getComplaintTimelineRequest(anonymousId, token) {
  return request(`/complaints/lookup/${anonymousId}/timeline`, {
    method: 'GET',
    token
  });
}

export function getComplaintEvidenceRequest(anonymousId, token) {
  return request(`/complaints/lookup/${anonymousId}/evidence`, {
    method: 'GET',
    token
  });
}
export function getComplaintTriageRequest(anonymousId, token) {
  return request(`/complaints/lookup/${encodeURIComponent(anonymousId)}/triage`, {
    method: 'GET', token
  });
}

export function uploadComplaintEvidenceRequest(anonymousId, formData, token) {
  return request(`/complaints/lookup/${anonymousId}/evidence`, {
    method: 'POST',
    body: formData,
    token
  });
}

export async function downloadComplaintEvidenceRequest(anonymousId, evidenceId, token) {
  let response;
  try {
    response = await fetch(
      `${API_BASE_URL}/complaints/lookup/${anonymousId}/evidence/${evidenceId}/download`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch {
    throw new Error('Unable to reach the server right now. Please try again in a moment.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.message || 'Evidence download failed.');
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return {
    blob: await response.blob(),
    contentDisposition: response.headers.get('Content-Disposition')
  };
}

// NGO Endpoints
export function registerNgoRequest(payload) {
  return request('/ngos/register', {
    method: 'POST',
    body: payload
  });
}

export function listNgosRequest(token, status = '') {
  return request(`/ngos${status ? `?status=${status}` : ''}`, {
    method: 'GET',
    token
  });
}

export function reviewNgoRequest(token, id, status, notes, profileVersion) {
  const action = status === 'approved' ? 'approve' : 'reject';
  return request(`/dashboard/ngos/${encodeURIComponent(id)}/review/${action}`, {
    method: 'POST',
    token,
    body: { profileVersion, reasonCategory: status === 'rejected' ? 'other_internal_review' : undefined, notes }
  });
}

export function getNgoDashboardRequest(token) {
  return request('/ngos/dashboard', {
    method: 'GET',
    token
  });
}

// Investigator Endpoints
export function registerInvestigatorRequest(token, payload) {
  return request('/investigators/register', {
    method: 'POST',
    token,
    body: payload
  });
}

export function listInvestigatorsRequest(token) {
  return request('/investigators', {
    method: 'GET',
    token
  });
}

export function getInvestigatorDashboardRequest(token) {
  return request('/investigators/dashboard', {
    method: 'GET',
    token
  });
}

export function addInvestigationNoteRequest(token, anonymousId, note) {
  return request(`/investigators/complaints/${anonymousId}/notes`, {
    method: 'POST',
    token,
    body: { note }
  });
}

// Chat System
export function getChatMessagesRequest(token, anonymousId) {
  return request(`/chat/${anonymousId}`, {
    method: 'GET',
    token
  });
}

export function sendChatMessageRequest(token, anonymousId, text, attachmentsOrOptions = []) {
  const options = Array.isArray(attachmentsOrOptions)
    ? { attachments: attachmentsOrOptions }
    : attachmentsOrOptions;
  return request(`/chat/${anonymousId}`, {
    method: 'POST',
    token,
    body: {
      text,
      attachments: options.attachments || [],
      clientMessageId: options.clientMessageId
    }
  });
}

export function markChatAsReadRequest(token, anonymousId) {
  return request(`/chat/${anonymousId}/read`, {
    method: 'POST',
    token
  });
}

// Dashboard Operations
export function getDashboardSummary(token) {
  return request('/dashboard/summary', {
    method: 'GET',
    token
  });
}

export function getDashboardComplaints(token, { status = 'all', riskLevel = 'all', search = '', page = 1, limit = 10 } = {}) {
  const searchParams = new URLSearchParams({ status, riskLevel, search, page: String(page), limit: String(limit) });
  return request(`/dashboard/complaints?${searchParams.toString()}`, {
    method: 'GET',
    token
  });
}

export function updateDashboardComplaintStatusRequest(token, anonymousId, status) {
  return request(`/dashboard/complaints/${anonymousId}/status`, {
    method: 'PATCH',
    token,
    body: { status }
  });
}

export function assignNgoRequest(token, anonymousId, ngoId) {
  return request(`/dashboard/complaints/${anonymousId}/ngo-offers`, {
    method: 'POST',
    token,
    body: { ngoPublicId: ngoId, source: 'routing_recommendation' }
  });
}

export function assignInvestigatorRequest(token, anonymousId, investigatorId) {
  return request(`/dashboard/complaints/${anonymousId}/assign-investigator`, {
    method: 'POST',
    token,
    body: { investigatorId }
  });
}

export function acknowledgeNgoAssignmentRequest(token, anonymousId) {
  return request(`/ngos/complaints/${anonymousId}/acknowledge`, {
    method: 'POST',
    token
  });
}

export function escalateComplaintRequest(token, anonymousId, reasonCategory, idempotencyKey) {
  return request(`/dashboard/complaints/${anonymousId}/escalate`, {
    method: 'POST',
    token,
    body: { reasonCategory, idempotencyKey }
  });
}

export function resolveEscalationRequest(token, id, version, note) {
  return request(`/dashboard/workflow/escalations/${encodeURIComponent(id)}/actions`, {
    method: 'POST',
    token,
    body: { version, action: 'resolve', reasonCategory: 'workflow_completed', note }
  });
}

export function getAuditLogsRequest(token, page = 1, limit = 50) {
  return request(`/dashboard/audit-logs?page=${page}&limit=${limit}`, {
    method: 'GET',
    token
  });
}

export function getEscalationsRequest(token) {
  return request('/dashboard/workflow/escalations', {
    method: 'GET',
    token
  });
}

export function getWorkflowDeadlinesRequest(token) {
  return request('/dashboard/workflow/deadlines', { method: 'GET', token });
}

export const startSosConfirmationRequest = (token, caseId, idempotencyKey) =>
  request(`/complaints/lookup/${encodeURIComponent(caseId)}/sos/confirmations`, {
    method: 'POST', token,
    body: { acknowledgedNonDispatch: true, idempotencyKey }
  });

export const cancelSosRequest = (token, caseId, sosId) =>
  request(`/complaints/lookup/${encodeURIComponent(caseId)}/sos/${encodeURIComponent(sosId)}`, {
    method: 'DELETE', token
  });

export const activateSosRequest = (token, caseId, sosId, body) =>
  request(`/complaints/lookup/${encodeURIComponent(caseId)}/sos/${encodeURIComponent(sosId)}/activate`, {
    method: 'POST', token, body
  });

export const getCurrentSosRequest = (token, caseId) =>
  request(`/complaints/lookup/${encodeURIComponent(caseId)}/sos`, {
    method: 'GET', token
  });

export const getSosQueueRequest = (token) =>
  request('/dashboard/sos', { method: 'GET', token });

export const updateSosRequest = (token, caseId, sosId, body) =>
  request(`/dashboard/complaints/${encodeURIComponent(caseId)}/sos/${encodeURIComponent(sosId)}/actions`, {
    method: 'POST', token, body
  });

export function getVerifiedHelplinesRequest({ country, region, category } = {}) {
  const query = new URLSearchParams({ ...(country ? { country } : {}),
    ...(region ? { region } : {}), ...(category ? { category } : {}) });
  return request(`/platform/helplines?${query}`, { method: 'GET' });
}

export function getDetailedAnalyticsRequest(token) {
  return request('/dashboard/analytics', {
    method: 'GET',
    token
  });
}

export function createChatbotReplyRequest(messages) {
  return request('/chatbot', {
    method: 'POST',
    body: { messages }
  });
}
