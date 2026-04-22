export async function fetchWorkers() {
  const res = await fetch("/api/workers");
  if (!res.ok) throw new Error(`Failed to fetch workers: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function createWorker({ name, email, percentage }) {
  const res = await fetch("/api/workers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, percentage }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create worker: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function addProperty(workerId, { type, value }) {
  const res = await fetch(`/api/workers/${workerId}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to add property: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}
