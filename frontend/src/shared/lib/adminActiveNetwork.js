const STORAGE_KEY = "adminActiveGamNetworkCode";

export function readAdminActiveGamNetworkCode() {
  if (typeof window === "undefined") return null;
  const v = window.sessionStorage.getItem(STORAGE_KEY);
  return v && String(v).trim() ? String(v).trim() : null;
}

export function writeAdminActiveGamNetworkCode(code) {
  if (typeof window === "undefined") return;
  const c = String(code || "").trim();
  if (!c) window.sessionStorage.removeItem(STORAGE_KEY);
  else window.sessionStorage.setItem(STORAGE_KEY, c);
}
