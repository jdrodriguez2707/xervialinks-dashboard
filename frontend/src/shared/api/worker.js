import { getAuthHeaders } from "./auth";

export async function fetchWorkerDashboard() {
  const res = await fetch("/api/worker/dashboard", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}
