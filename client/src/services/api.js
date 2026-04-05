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
      body,
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

export function loginRequest(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
}

export function submitComplaintRequest(formData) {
  return request('/complaints', {
    method: 'POST',
    body: formData
  });
}

export function getCurrentUser(token) {
  return request('/auth/me', {
    method: 'GET',
    token
  });
}

export function getDashboardSummary(token) {
  return request('/dashboard/summary', {
    method: 'GET',
    token
  });
}

export function getDashboardComplaints(token, status = 'all') {
  const searchParams = new URLSearchParams();

  if (status && status !== 'all') {
    searchParams.set('status', status);
  }

  const query = searchParams.toString();

  return request(`/dashboard/complaints${query ? `?${query}` : ''}`, {
    method: 'GET',
    token
  });
}

export function updateDashboardComplaintStatusRequest(token, anonymousId, status) {
  return request(`/dashboard/complaints/${anonymousId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status })
  });
}

export function createChatbotReplyRequest(messages) {
  return request('/chatbot', {
    method: 'POST',
    body: JSON.stringify({ messages })
  });
}
