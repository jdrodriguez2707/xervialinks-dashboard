const workersService = require("../../application/services/workers.service");
const revenueService = require("../../application/services/revenue.service");
const workerPaymentHistoryService = require("../../application/services/workerPaymentHistory.service");
const gamNetworksRepo = require("../../domain/repositories/gamNetworks.repository");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");
const { isValidISODate } = require("../../application/services/clientTimezone");

function enrichWorkerPropertiesForResponse(properties) {
  const displayMap = gamNetworksRepo.getDisplayNameMap();
  return (properties || []).map((p) => {
    const base = { ...p };
    if (p.type === "domain") {
      const code = String(p.gamNetworkCode || p.gam_network_code || "").trim();
      base.networkDisplayName = code ? displayMap[code] || code : null;
    }
    return base;
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
  const worker = workersService.getWorkerByEmail(req.user.email, req.query.paymentMonth);

  res.json({
    data: {
      workerId: worker.id,
      properties: enrichWorkerPropertiesForResponse(worker.properties),
      paymentInfo: worker.paymentInfo || null,
      paymentStatus: worker.paymentStatus || "pending",
      paymentStatusUpdatedAt: worker.paymentStatusUpdatedAt || null,
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
  const networkCode =
    typeof req.query.networkCode === "string" && req.query.networkCode.trim()
      ? req.query.networkCode.trim()
      : null;
  const referenceDate =
    typeof req.query.currentDate === "string" && isValidISODate(req.query.currentDate)
      ? req.query.currentDate
      : null;

  if (domain) {
    const slots = (worker.properties || [])
      .filter((p) => p.type === "domain")
      .map((p) => ({
        value: String(p.value || "").trim(),
        gamNetworkCode: String(p.gamNetworkCode || p.gam_network_code || "").trim(),
      }))
      .filter((s) => s.value && s.gamNetworkCode);
    const matching = slots.filter((s) => s.value === domain);
    if (matching.length === 0) {
      return res
        .status(400)
        .json({ error: "El subdominio solicitado no está asignado a tu cuenta" });
    }
    if (matching.length > 1 && !networkCode) {
      return res.status(400).json({
        error:
          "Este subdominio está en varias redes; indica networkCode en la petición (coincide con tu asignación).",
      });
    }
    if (networkCode && !matching.some((s) => s.gamNetworkCode === networkCode)) {
      return res
        .status(400)
        .json({ error: "La combinación dominio / red no está asignada a tu cuenta" });
    }
  }

  const periods = await revenueService.getWorkerDashboardPeriods(worker, timeZone, {
    domain,
    networkCode,
    referenceDate,
  });
  res.json({ data: periods });
}

async function upsertPaymentInfo(req, res) {
  const { methodType, paymentDetails } = req.body || {};
  const paymentInfo = workersService.updateWorkerPaymentInfoByEmail(req.user.email, {
    methodType,
    paymentDetails,
  });
  res.json({ data: paymentInfo });
}

async function getPaymentHistory(req, res) {
  const workerIncludingDeleted = workersService.getWorkerByEmailIncludingDeleted(req.user.email);
  if (!workerIncludingDeleted) {
    return res.status(404).json({ error: "No tienes un perfil de trabajador asignado" });
  }
  if (workerIncludingDeleted.deleted_at) {
    return res
      .status(403)
      .json({ error: "Tu cuenta de trabajador fue eliminada. Contacta al administrador." });
  }

  const paymentMonth = workersService.resolvePaymentMonth(req.query.paymentMonth);
  const timeZone = clientTimeZoneFromRequest(req);
  const history = await workerPaymentHistoryService.getWorkerPaymentHistoryByEmail(req.user.email, {
    paymentMonth,
    timeZone,
  });
  res.json({ data: history });
}

module.exports = { getContext, getDashboard, upsertPaymentInfo, getPaymentHistory };
