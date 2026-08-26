// import.meta.env is undefined outside Vite (node test runners), so guard it.
const BASE = (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_API_URL) || '';

export class ApiError extends Error {
  constructor(message, { status = 0, fields = null } = {}) {
    super(message); this.name = 'ApiError'; this.status = status; this.fields = fields;
  }
}

/**
 * The access token lives in this module's closure — not localStorage, not
 * sessionStorage. Nothing on the page can read it, and it dies with the tab.
 * Session continuity comes from the httpOnly refresh cookie instead.
 */
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;

/** Set by AuthProvider so a 401 anywhere can trigger one silent refresh. */
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

let refreshing = null;   // de-duplicates concurrent refreshes

export async function api(path, { method = 'GET', body, auth = false, retry = true, raw = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',      // lets the refresh cookie travel
    });
  } catch {
    throw new ApiError('Cannot reach the Toolshed server.', { status: 0 });
  }

  // An expired access token is recoverable: refresh once, then replay.
  if (res.status === 401 && auth && retry && onUnauthorized) {
    refreshing ||= onUnauthorized().finally(() => { refreshing = null; });
    const recovered = await refreshing;
    if (recovered) return api(path, { method, body, auth, raw, retry: false });
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(payload?.error?.message || `Request failed (${res.status}).`, {
      status: res.status, fields: payload?.error?.fields ?? null,
    });
  }
  // `raw` hands back the whole envelope for the few callers that need `meta`.
  return raw ? payload : payload?.data;
}

export const signup  = (body) => api('/auth/signup', { method: 'POST', body });
export const login   = (body) => api('/auth/login',  { method: 'POST', body });
export const refresh = ()     => api('/auth/refresh', { method: 'POST' });
export const logout  = ()     => api('/auth/logout',  { method: 'POST' });
export const myLoans = ()     => api('/loans', { auth: true });
export const allLoans = ()    => api('/loans/all', { auth: true });
