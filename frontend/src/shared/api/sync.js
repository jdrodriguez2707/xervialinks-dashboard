import { getAuthHeaders } from "./auth";

export async function fetchSyncStatus({ networkCode } = {}) {
  const params = new URLSearchParams();
  if (networkCode) params.set("networkCode", networkCode);
  const qs = params.toString();
  const res = await fetch(`/api/sync/status${qs ? `?${qs}` : ""}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}
