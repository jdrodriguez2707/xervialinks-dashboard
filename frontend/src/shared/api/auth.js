import { apiUrl } from "./client";

const TOKEN_KEY = "adm_token";
const USER_KEY = "adm_user";

export async function login(email, password) {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Credenciales inválidas");
  }

  const { data } = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
}

export function setStoredUser(user) {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

/** IANA timezone from the browser (used by the API for calendar-day boundaries). */
export function getClientTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function getAuthHeaders() {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const tz = getClientTimeZone();
  if (tz) headers["X-Client-Timezone"] = tz;
  return headers;
}

/** JWT payload: { userId, email, role }. Use before heavy dashboard fetches to avoid a burst of 401s. */
export async function fetchSession() {
  const res = await fetch(apiUrl("/api/auth/me"), { headers: getAuthHeaders() });
  if (!res.ok) {
    if (res.status === 401) throw new Error("401");
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  const { data } = await res.json();
  return data;
}

export async function fetchAdminProfile() {
  const res = await fetch(apiUrl("/api/auth/profile"), { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  const { data } = await res.json();
  return data;
}

export async function updateAdminProfile(payload) {
  const res = await fetch(apiUrl("/api/auth/profile"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  const { data } = await res.json();
  return data;
}

export async function changeAdminPassword(payload) {
  const res = await fetch(apiUrl("/api/auth/change-password"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
}
