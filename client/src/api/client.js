/**
 * SentinelAI API Client
 * Interacts with backend Express REST API via Vite proxy with authentication and timeout management.
 */

const API_BASE = '/api';
const API_KEY = import.meta.env?.VITE_SENTINEL_API_KEY || 'sentinel-dev-key';

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  let signal = options.signal;
  if (!signal && typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    try {
      signal = AbortSignal.timeout(timeoutMs);
    } catch {
      // Fallback if timeout throws
    }
  }

  const headers = {
    'x-api-key': API_KEY,
    ...(options.headers || {}),
  };

  return fetch(url, { ...options, headers, signal });
}

async function handleResponse(res) {
  const json = await res.json();
  if (!res.ok) {
    const errorMsg = json?.error?.message || json?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.code = json?.error?.code;
    throw err;
  }
  return json.data;
}

export async function fetchHealth() {
  const res = await fetchWithTimeout(`${API_BASE}/health`, {}, 4000);
  return handleResponse(res);
}

export async function fetchApplications() {
  const res = await fetchWithTimeout(`${API_BASE}/applications`);
  return handleResponse(res);
}

export async function fetchProfiles() {
  const res = await fetchWithTimeout(`${API_BASE}/applications/profiles`);
  return handleResponse(res);
}

export async function createApplication(payload) {
  const res = await fetchWithTimeout(`${API_BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateApplication(applicationId, payload) {
  const res = await fetchWithTimeout(`${API_BASE}/applications/${applicationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function triggerScan({ applicationId, triggerSource = 'manual', sync = false }) {
  const res = await fetchWithTimeout(`${API_BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId, triggerSource, sync }),
  }, 15000);
  return handleResponse(res);
}

export async function runDemoAssessment() {
  const res = await fetchWithTimeout(`${API_BASE}/scans/demo-assessment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, 30000);
  return handleResponse(res);
}

export async function fetchScans({ applicationId, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (applicationId) params.append('applicationId', applicationId);
  params.append('page', page);
  params.append('limit', limit);

  const res = await fetchWithTimeout(`${API_BASE}/scans?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchScan(scanId) {
  const res = await fetchWithTimeout(`${API_BASE}/scans/${scanId}`);
  return handleResponse(res);
}

export async function fetchScanResults(scanId) {
  const res = await fetchWithTimeout(`${API_BASE}/scans/${scanId}/results`);
  return handleResponse(res);
}

export async function fetchFindings({ applicationId, scanId, severity, status, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (applicationId) params.append('applicationId', applicationId);
  if (scanId) params.append('scanId', scanId);
  if (severity) params.append('severity', severity);
  if (status) params.append('status', status);
  params.append('page', page);
  params.append('limit', limit);

  const res = await fetchWithTimeout(`${API_BASE}/findings?${params.toString()}`);
  return handleResponse(res);
}

export async function fetchFindingsSummary({ applicationId } = {}) {
  const params = new URLSearchParams();
  if (applicationId) params.append('applicationId', applicationId);

  const res = await fetchWithTimeout(`${API_BASE}/findings/summary?${params.toString()}`);
  return handleResponse(res);
}

export async function updateFinding(findingId, { status, notes }) {
  const res = await fetchWithTimeout(`${API_BASE}/findings/${findingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
  return handleResponse(res);
}

export async function setApplicationBaseline(applicationId, scanId) {
  const res = await fetchWithTimeout(`${API_BASE}/applications/${applicationId}/baseline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scanId }),
  });
  return handleResponse(res);
}

export async function fetchScanRegression(scanId) {
  const res = await fetchWithTimeout(`${API_BASE}/scans/${scanId}/regression`);
  return handleResponse(res);
}

export async function compareScans(targetScanId, baselineScanId) {
  const res = await fetchWithTimeout(`${API_BASE}/scans/${targetScanId}/compare/${baselineScanId}`, {
    method: 'POST',
  });
  return handleResponse(res);
}
