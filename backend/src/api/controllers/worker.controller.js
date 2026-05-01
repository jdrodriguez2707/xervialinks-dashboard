const workersService = require("../../application/services/workers.service");
const revenueService = require("../../application/services/revenue.service");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");

async function getContext(req, res) {
  const worker = workersService.getWorkerByEmail(req.user.email);

  if (!worker) {
    return res
      .status(404)
      .json({ error: "No tienes un perfil de trabajador asignado" });
  }

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
  const worker = workersService.getWorkerByEmail(req.user.email);

  if (!worker) {
    return res
      .status(404)
      .json({ error: "No tienes un perfil de trabajador asignado" });
  }

  const timeZone = clientTimeZoneFromRequest(req);
  const domain =
    typeof req.query.domain === "string" && req.query.domain.trim()
      ? req.query.domain.trim()
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
