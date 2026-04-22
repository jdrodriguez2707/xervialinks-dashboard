import { getAuthHeaders } from "./auth";

export async function fetchReports(filters = {}) {
  const params = new URLSearchParams();
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  const query = params.toString();
  const url = `/api/reports${query ? `?${query}` : ""}`;

  const res = await fetch(url, { headers: getAuthHeaders() });

  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
