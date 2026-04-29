import { getAuthHeaders } from "./auth";

export async function fetchWorkerDashboard() {
  const res = await fetch("/api/worker/dashboard", { headers: getAuthHeaders() });
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
