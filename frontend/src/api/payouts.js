export async function fetchPayouts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  const query = params.toString();
  const url = `/api/payouts${query ? `?${query}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch payouts: ${res.status}`);
  const json = await res.json();
  return json.data;
}
