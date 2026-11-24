import { getAuthHeaders } from "./auth";
import { apiUrl } from "./client";

/** Solo BD: subdominios asignados y ajustes visibles para el trabajador (rápido, sin GAM). */
export async function fetchWorkerContext() {
  const url = apiUrl("/api/worker/context");
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
  const url = apiUrl(`/api/worker/dashboard${query ? `?${query}` : ""}`);
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}
