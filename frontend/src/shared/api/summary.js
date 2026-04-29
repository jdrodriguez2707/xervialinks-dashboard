import { getAuthHeaders } from "./auth";

export async function fetchSummary() {
  const res = await fetch("/api/summary", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}
