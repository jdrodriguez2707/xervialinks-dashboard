import { getAuthHeaders } from "./auth";

export async function fetchWorkers() {
  const res = await fetch("/api/workers", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function createWorker({ name, email, percentage, password }) {
  const res = await fetch("/api/workers", {
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

export async function addProperty(workerId, { type, value }) {
  const res = await fetch(`/api/workers/${workerId}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ type, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function deleteWorker(workerId) {
  const res = await fetch(`/api/workers/${workerId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
}
