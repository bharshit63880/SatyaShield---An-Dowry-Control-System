function resolveApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_URL?.trim();

  if (!configuredBaseUrl) {
    return '/api/v1';
  }

  return configuredBaseUrl.replace(/\/+$/, '');
}

const API_BASE_URL = resolveApiBaseUrl();

async function request(path, options = {}) {
  const { token, headers, body, ...restOptions } = options;
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
      ...restOptions
    });
  } catch (_error) {
    throw new Error('Unable to reach the server right now. Please try again in a moment.');
  }

  const payload = await response.json().catch(() => ({
    message: 'Unexpected server response.'
  }));

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed.');
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

// Complaints - Anonymous Intake & Status Tracking
export function submitComplaintRequest(formData) {
  return request('/complaints', {
    method: 'POST',
    body: formData
  });
}

export function getPublicComplaintRequest(anonymousId) {
  return request(`/complaints/lookup/${anonymousId}`, {
    method: 'GET'
  });
}

export function getComplaintTimelineRequest(anonymousId) {
  return request(`/complaints/lookup/${anonymousId}/timeline`, {
    method: 'GET'
  });
}

export function getComplaintEvidenceRequest(anonymousId) {
  return request(`/complaints/lookup/${anonymousId}/evidence`, {
    method: 'GET'
  });
}

export function uploadComplaintEvidenceRequest(anonymousId, formData) {
  return request(`/complaints/lookup/${anonymousId}/evidence`, {
    method: 'POST',
    body: formData
  });
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

export function reviewNgoRequest(token, id, status, notes) {
  return request(`/ngos/${id}/review`, {
    method: 'PATCH',
    token,
    body: { status, notes }
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

export function sendChatMessageRequest(token, anonymousId, text, attachments = []) {
  return request(`/chat/${anonymousId}`, {
    method: 'POST',
    token,
    body: { text, attachments }
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
  return request(`/dashboard/complaints/${anonymousId}/assign-ngo`, {
    method: 'POST',
    token,
    body: { ngoId }
  });
}

export function assignInvestigatorRequest(token, anonymousId, investigatorId) {
  return request(`/dashboard/complaints/${anonymousId}/assign-investigator`, {
    method: 'POST',
    token,
    body: { investigatorId }
  });
}

export function escalateComplaintRequest(token, anonymousId, reason) {
  return request(`/dashboard/complaints/${anonymousId}/escalate`, {
    method: 'POST',
    token,
    body: { reason }
  });
}

export function resolveEscalationRequest(token, id, resolution) {
  return request(`/dashboard/escalations/${id}/resolve`, {
    method: 'PATCH',
    token,
    body: { resolution }
  });
}

export function getAuditLogsRequest(token, page = 1, limit = 50) {
  return request(`/dashboard/audit-logs?page=${page}&limit=${limit}`, {
    method: 'GET',
    token
  });
}

export function getEscalationsRequest(token) {
  return request('/dashboard/escalations', {
    method: 'GET',
    token
  });
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
