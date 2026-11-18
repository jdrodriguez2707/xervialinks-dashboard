import { getAuthHeaders } from "./auth";
import { apiUrl } from "./client";

export async function fetchWorkerDailyStatsVisibility() {
  const res = await fetch(apiUrl("/api/settings/worker-daily-stats"), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function updateWorkerDailyStatsVisibility(enabled) {
  const res = await fetch(apiUrl("/api/settings/worker-daily-stats"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}
