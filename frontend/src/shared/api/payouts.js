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

/**
 * @param {{
 *   workerId: number,
 *   gamNetworkCode: string,
 *   periodStart: string,
 *   periodEnd: string,
 *   netRevenue: number,
 * }} body
 */
export async function upsertWorkerNetRevenueOverride(body) {
  const params = new URLSearchParams();
  if (body.gamNetworkCode) params.set("networkCode", body.gamNetworkCode);
  const qs = params.toString();
  const url = apiUrl(`/api/payouts/worker-net-revenue-override${qs ? `?${qs}` : ""}`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      workerId: body.workerId,
      gamNetworkCode: body.gamNetworkCode,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      netRevenue: body.netRevenue,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
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
