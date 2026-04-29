import { getAuthHeaders } from "./auth";

export async function fetchSites() {
  const res = await fetch("/api/sites", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data; // string[]
}
