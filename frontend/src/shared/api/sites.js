import { getAuthHeaders } from "./auth";
import { apiUrl } from "./client";

export async function fetchSites({ networkCode } = {}) {
  const params = new URLSearchParams();
  if (networkCode) params.set("networkCode", networkCode);
  const qs = params.toString();
  const res = await fetch(apiUrl(`/api/sites${qs ? `?${qs}` : ""}`), { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data; // string[]
}
