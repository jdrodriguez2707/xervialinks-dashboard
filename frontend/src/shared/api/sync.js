import { getAuthHeaders } from "./auth";

export async function fetchSyncStatus() {
  const res = await fetch("/api/sync/status", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}
