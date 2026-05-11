import { getAuthHeaders } from "./auth";
import { apiUrl } from "./client";

export async function fetchWorkers({ includeDeleted = false, paymentMonth, networkCode } = {}) {
  const params = new URLSearchParams();
  if (includeDeleted) params.set("includeDeleted", "true");
  if (paymentMonth) params.set("paymentMonth", paymentMonth);
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

export async function createWorker({ name, email, percentage, password }) {
  const res = await fetch(apiUrl("/api/workers"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ name, email, percentage, password }),
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

export async function updateWorkerPaymentStatus(workerId, status, paymentMonth) {
  const res = await fetch(apiUrl(`/api/workers/${workerId}/payment-status`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ status, paymentMonth }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  const json = await res.json();
  return json.data;
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
