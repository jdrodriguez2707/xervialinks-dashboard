import { getAuthHeaders } from "./auth";

/** Solo BD: subdominios + info de pago (rápido, sin GAM). */
export async function fetchWorkerContext() {
  const res = await fetch("/api/worker/context", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}

/** Métricas por periodos (puede tardar por GAM / caché). */
export async function fetchWorkerDashboard({ domain } = {}) {
  const params = new URLSearchParams();
  if (domain) params.set("domain", domain);
  const query = params.toString();
  const url = `/api/worker/dashboard${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function upsertWorkerPaymentInfo({ methodType, paymentDetails }) {
  const res = await fetch("/api/worker/payment-info", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ methodType, paymentDetails }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}
