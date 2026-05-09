const axios = require("axios");
const env = require("../../infrastructure/config/env");
const gamNetworksRepo = require("../../domain/repositories/gamNetworks.repository");
const { getAccessToken, networkUrlFor, getServiceAccountEmail } = require("../../infrastructure/integrations/gamClient");

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

/**
 * GET networks/{networkCode} — confirms the service account can access the network.
 */
async function verifyNetworkAccess(networkCode) {
  const code = String(networkCode || "").trim();
  const existing = gamNetworksRepo.findByCode(code);
  if (!existing) {
    throw new NotFoundError("Registra la red en el panel antes de verificar el acceso");
  }
  if (!env.USE_REAL_GAM_API) {
    return gamNetworksRepo.updateAccessStatus(code, { accessStatus: "ok", lastError: null });
  }
  if (!/^\d+$/.test(code)) {
    throw new ValidationError(
      "Para verificar contra Google Ad Manager el código de red debe ser numérico",
    );
  }
  const token = await getAccessToken();
  const url = networkUrlFor(code, "");
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const displayName =
      res.data?.displayName ||
      res.data?.name?.split("/")?.pop() ||
      code;
    const row = gamNetworksRepo.findByCode(code);
    if (row && (!row.displayName || row.displayName === code)) {
      gamNetworksRepo.updateDisplayName(code, String(displayName));
    }
    return gamNetworksRepo.updateAccessStatus(code, { accessStatus: "ok", lastError: null });
  } catch (err) {
    const msg =
      err.response?.data?.error?.message ||
      err.response?.data?.message ||
      err.message ||
      "No se pudo verificar el acceso";
    gamNetworksRepo.updateAccessStatus(code, { accessStatus: "error", lastError: String(msg) });
    throw err;
  }
}

function listNetworks() {
  return gamNetworksRepo.listAll();
}

function getServiceAccountEmailForUi() {
  try {
    return getServiceAccountEmail() || null;
  } catch {
    return null;
  }
}

function createNetwork({ networkCode, displayName }) {
  const code = String(networkCode || "").trim();
  if (!/^\d+$/.test(code)) {
    throw new ValidationError("El código de red debe ser numérico");
  }
  if (gamNetworksRepo.findByCode(code)) {
    throw new ValidationError("Esa red ya está registrada");
  }
  const name = String(displayName || "").trim() || `Red ${code}`;
  return gamNetworksRepo.insert({ networkCode: code, displayName: name, accessStatus: "unknown" });
}

function updateNetworkDisplay(networkCode, displayName) {
  const row = gamNetworksRepo.findByCode(networkCode);
  if (!row) throw new NotFoundError("Red no encontrada");
  return gamNetworksRepo.updateDisplayName(networkCode, displayName);
}

function setDefaultNetwork(networkCode) {
  const row = gamNetworksRepo.findByCode(networkCode);
  if (!row) throw new NotFoundError("Red no encontrada");
  return gamNetworksRepo.setDefaultNetwork(networkCode);
}

function deleteNetwork(networkCode) {
  gamNetworksRepo.deleteByCode(networkCode);
}

function resolveNetworkForAdminQuery(requestedCode) {
  if (requestedCode != null && String(requestedCode).trim() !== "") {
    const row = gamNetworksRepo.findByCode(String(requestedCode).trim());
    if (!row) throw new ValidationError("Código de red no registrado");
    if (row.accessStatus !== "ok") {
      throw new ValidationError("La red no tiene acceso verificado. Usa Verificar acceso primero.");
    }
    return row.networkCode;
  }
  const def = gamNetworksRepo.getDefaultNetworkCode();
  if (def) {
    const row = gamNetworksRepo.findByCode(def);
    if (row?.accessStatus === "ok") return def;
  }
  const okList = gamNetworksRepo.listCodesWithAccessOk();
  if (okList.length > 0) return okList[0];
  const first = gamNetworksRepo.listAll()[0];
  if (first?.networkCode) return first.networkCode;
  return String(env.GAM_NETWORK_CODE || "").trim() || "default";
}

module.exports = {
  verifyNetworkAccess,
  listNetworks,
  getServiceAccountEmailForUi,
  createNetwork,
  updateNetworkDisplay,
  setDefaultNetwork,
  deleteNetwork,
  resolveNetworkForAdminQuery,
  ValidationError,
  NotFoundError,
};
