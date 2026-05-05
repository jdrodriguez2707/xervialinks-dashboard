const workersService = require("../../application/services/workers.service");
const revenueService = require("../../application/services/revenue.service");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");
const { isValidISODate } = require("../../application/services/clientTimezone");

async function getContext(req, res) {
  const workerIncludingDeleted = workersService.getWorkerByEmailIncludingDeleted(req.user.email);

  if (!workerIncludingDeleted) {
    return res
      .status(404)
      .json({ error: "No tienes un perfil de trabajador asignado" });
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
      properties: worker.properties,
      paymentInfo: worker.paymentInfo || null,
      paymentStatus: worker.paymentStatus || "pending",
      paymentStatusUpdatedAt: worker.paymentStatusUpdatedAt || null,
    },
  });
}

async function getDashboard(req, res) {
  const worker = workersService.getWorkerByEmailIncludingDeleted(req.user.email);

  if (!worker) {
    return res
      .status(404)
      .json({ error: "No tienes un perfil de trabajador asignado" });
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
    const assignedDomains = worker.properties
      .filter((p) => p.type === "domain")
      .map((p) => p.value);
    if (!assignedDomains.includes(domain)) {
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

async function upsertPaymentInfo(req, res) {
  const { methodType, paymentDetails } = req.body || {};
  const paymentInfo = workersService.updateWorkerPaymentInfoByEmail(req.user.email, {
    methodType,
    paymentDetails,
  });
  res.json({ data: paymentInfo });
}

module.exports = { getContext, getDashboard, upsertPaymentInfo };
