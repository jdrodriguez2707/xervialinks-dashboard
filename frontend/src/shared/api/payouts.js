import { getAuthHeaders } from "./auth";
import { apiUrl } from "./client";

export async function fetchPayouts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.networkCode) params.set("networkCode", filters.networkCode);

  const query = params.toString();
  const url = apiUrl(`/api/payouts${query ? `?${query}` : ""}`);

  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchPaymentHistory({ networkCode } = {}) {
  const params = new URLSearchParams();
  if (networkCode) params.set("networkCode", networkCode);
  const qs = params.toString();
  const res = await fetch(apiUrl(`/api/payouts/history${qs ? `?${qs}` : ""}`), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}
