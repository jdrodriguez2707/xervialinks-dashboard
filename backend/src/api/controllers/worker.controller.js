const workersService = require("../../application/services/workers.service");
const revenueService = require("../../application/services/revenue.service");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");
const { isValidISODate } = require("../../application/services/clientTimezone");
const appSettingsService = require("../../application/services/appSettings.service");

/** Worker UI must not expose Ad Manager network identifiers or labels. */
function stripGamNetworkFromWorkerProperties(properties) {
  return (properties || []).map((p) => {
    const copy = { ...p };
    delete copy.gam_network_code;
    delete copy.gamNetworkCode;
    delete copy.networkDisplayName;
    return copy;
  });
}

async function getContext(req, res) {
  const workerIncludingDeleted = workersService.getWorkerByEmailIncludingDeleted(req.user.email);

  if (!workerIncludingDeleted) {
    return res.status(404).json({ error: "No tienes un perfil de trabajador asignado" });
  }
  if (workerIncludingDeleted.deleted_at) {
    return res
      .status(403)
      .json({ error: "Tu cuenta de trabajador fue eliminada. Contacta al administrador." });
  }
  const worker = workersService.getWorkerByEmail(req.user.email);

  res.json({
    data: {
      workerId: worker.id,
      properties: stripGamNetworkFromWorkerProperties(worker.properties),
      dailyStatsEnabled: appSettingsService.getWorkerDailyStatsEnabled(),
    },
  });
}

async function getDashboard(req, res) {
  const worker = workersService.getWorkerByEmailIncludingDeleted(req.user.email);

  if (!worker) {
    return res.status(404).json({ error: "No tienes un perfil de trabajador asignado" });
  }
  if (worker.deleted_at) {
    return res
      .status(403)
      .json({ error: "Tu cuenta de trabajador fue eliminada. Contacta al administrador." });
  }

  const timeZone = clientTimeZoneFromRequest(req);
  const domain =
    typeof req.query.domain === "string" && req.query.domain.trim()
      ? req.query.domain.trim()
      : null;
  const referenceDate =
    typeof req.query.currentDate === "string" && isValidISODate(req.query.currentDate)
      ? req.query.currentDate
      : null;

  if (domain) {
    const assigned = new Set(
      (worker.properties || [])
        .filter((p) => p.type === "domain")
        .map((p) => String(p.value || "").trim()),
    );
    if (!assigned.has(domain)) {
      return res
        .status(400)
        .json({ error: "El subdominio solicitado no está asignado a tu cuenta" });
    }
  }

  const periods = await revenueService.getWorkerDashboardPeriods(worker, timeZone, {
    domain,
    referenceDate,
  });
  res.json({ data: periods });
}

module.exports = { getContext, getDashboard };
