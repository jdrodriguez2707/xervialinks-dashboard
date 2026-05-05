import { getAuthHeaders } from "./auth";

/** Solo BD: subdominios + info de pago (rápido, sin GAM). */
export async function fetchWorkerContext({ paymentMonth } = {}) {
  const params = new URLSearchParams();
  if (paymentMonth) params.set("paymentMonth", paymentMonth);
  const query = params.toString();
  const url = `/api/worker/context${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

/** Métricas por periodos (puede tardar por GAM / caché). */
export async function fetchWorkerDashboard({ domain } = {}) {
  const params = new URLSearchParams();
  if (domain) params.set("domain", domain);
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Bogota";
    const currentDate = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    params.set("currentDate", currentDate);
  } catch {
    // ignore if browser cannot resolve timezone
  }
  const query = params.toString();
  const url = `/api/worker/dashboard${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${res.status}`);
  }
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
