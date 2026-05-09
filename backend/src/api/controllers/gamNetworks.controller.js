const gamNetworksService = require("../../application/services/gamNetworks.service");
const { syncReportsBatch } = require("../../application/services/reportsSync.service");

async function listNetworks(_req, res) {
  const rows = gamNetworksService.listNetworks();
  res.json({ data: rows });
}

async function getServiceAccountEmail(_req, res) {
  res.json({ data: { email: gamNetworksService.getServiceAccountEmailForUi() } });
}

async function getSaInviteResearch(_req, res) {
  res.json({
    data: {
      automatedInviteSupported: false,
      summary:
        "Google Ad Manager no expone en la API REST v1 una operación documentada para invitar o crear usuarios de red con la misma identidad que el flujo manual de la consola. El enfoque recomendado es invitar la cuenta de servicio en Admin → Acceso y usar «Verificar acceso» en este panel.",
      references: [
        "https://developers.google.com/ad-manager/api/beta",
        "https://developers.google.com/ad-manager/api/rest/reference/rest/v1/networks",
      ],
    },
  });
}

async function createNetwork(req, res) {
  const row = gamNetworksService.createNetwork(req.body || {});
  res.status(201).json({ data: row });
}

async function updateDisplayName(req, res) {
  const row = gamNetworksService.updateNetworkDisplay(req.params.code, req.body?.displayName);
  res.json({ data: row });
}

async function setDefault(req, res) {
  const row = gamNetworksService.setDefaultNetwork(req.params.code);
  res.json({ data: row });
}

async function verifyAccess(req, res) {
  const row = await gamNetworksService.verifyNetworkAccess(req.params.code);
  res.json({ data: row });
}

async function syncNetworkNow(req, res) {
  const code = String(req.params.code || "").trim();
  const row = gamNetworksService.listNetworks().find((n) => n.networkCode === code);
  if (!row) {
    return res.status(404).json({ error: "Red no encontrada" });
  }
  if (row.accessStatus !== "ok") {
    return res.status(400).json({ error: "Verifica el acceso antes de sincronizar esta red" });
  }
  const result = await syncReportsBatch({ onlyNetworkCode: code });
  res.json({ data: { networkCode: code, ...result } });
}

async function deleteNetwork(req, res) {
  try {
    gamNetworksService.deleteNetwork(req.params.code);
    res.status(204).end();
  } catch (err) {
    if (String(err.message || "").includes("default")) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
}

module.exports = {
  listNetworks,
  getServiceAccountEmail,
  getSaInviteResearch,
  createNetwork,
  updateDisplayName,
  setDefault,
  verifyAccess,
  syncNetworkNow,
  deleteNetwork,
};
