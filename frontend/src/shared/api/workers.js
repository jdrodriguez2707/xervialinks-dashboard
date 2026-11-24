import { getAuthHeaders } from "./auth";
import { apiUrl } from "./client";

export async function fetchWorkers({ includeDeleted = false, networkCode } = {}) {
  const params = new URLSearchParams();
  if (includeDeleted) params.set("includeDeleted", "true");
  if (networkCode) params.set("networkCode", networkCode);
  const qs = params.size ? `?${params.toString()}` : "";
  const res = await fetch(apiUrl(`/api/workers${qs}`), { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function updateWorker(workerId, body, { networkCode } = {}) {
  const params = new URLSearchParams();
  if (networkCode) params.set("networkCode", networkCode);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(apiUrl(`/api/workers/${workerId}${qs}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function createWorker({ name, email, password }) {
  const res = await fetch(apiUrl("/api/workers"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function addProperty(workerId, { type, value, gamNetworkCode }, { networkCode } = {}) {
  const params = new URLSearchParams();
  if (networkCode) params.set("networkCode", networkCode);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(apiUrl(`/api/workers/${workerId}/properties${qs}`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ type, value, gamNetworkCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function deleteWorker(workerId) {
  const res = await fetch(apiUrl(`/api/workers/${workerId}`), {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
}

export async function purgeInactiveWorker(workerId) {
  const res = await fetch(apiUrl(`/api/workers/${workerId}/purge-inactive`), {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
}
