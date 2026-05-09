import { getAuthHeaders } from "./auth";

export async function fetchGamNetworks() {
  const res = await fetch("/api/gam-networks", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchGamServiceAccountEmail() {
  const res = await fetch("/api/gam-networks/service-account-email", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchSaInviteResearch() {
  const res = await fetch("/api/gam-networks/sa-invite-research", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function createGamNetwork({ networkCode, displayName }) {
  const res = await fetch("/api/gam-networks", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ networkCode, displayName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function verifyGamNetwork(networkCode) {
  const res = await fetch(
    `/api/gam-networks/${encodeURIComponent(networkCode)}/verify`,
    { method: "POST", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function syncGamNetworkNow(networkCode) {
  const res = await fetch(
    `/api/gam-networks/${encodeURIComponent(networkCode)}/sync`,
    { method: "POST", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function setDefaultGamNetwork(networkCode) {
  const res = await fetch(
    `/api/gam-networks/${encodeURIComponent(networkCode)}/default`,
    { method: "PATCH", headers: getAuthHeaders() },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function updateGamNetworkDisplayName(networkCode, displayName) {
  const res = await fetch(
    `/api/gam-networks/${encodeURIComponent(networkCode)}/display-name`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ displayName }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function deleteGamNetwork(networkCode) {
  const res = await fetch(`/api/gam-networks/${encodeURIComponent(networkCode)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `${res.status}`);
  }
}
