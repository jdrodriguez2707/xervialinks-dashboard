/**
 * Fetches advertising reports from the backend.
 *
 * @param {{ domain?: string, startDate?: string, endDate?: string }} filters
 * @returns {Promise<{ reports: Array, summary: object }>}
 */
export async function fetchReports(filters = {}) {
  const params = new URLSearchParams();

  if (filters.domain) params.set("domain", filters.domain);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  const query = params.toString();
  const url = `/api/reports${query ? `?${query}` : ""}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch reports: ${res.status}`);
  }

  return res.json();
}
