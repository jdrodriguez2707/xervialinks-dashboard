const workersService = require("../../application/services/workers.service");
const revenueService = require("../../application/services/revenue.service");

async function getDashboard(req, res) {
  const worker = workersService.getWorkerByEmail(req.user.email);

  if (!worker) {
    return res
      .status(404)
      .json({ error: "No tienes un perfil de trabajador asignado" });
  }

  const periods = await revenueService.getWorkerDashboardPeriods(worker);
  res.json({
    data: {
      ...periods,
      properties: worker.properties,
      paymentInfo: worker.paymentInfo || null,
    },
  });
}

async function upsertPaymentInfo(req, res) {
  const { methodType, paymentDetails } = req.body || {};
  const paymentInfo = workersService.updateWorkerPaymentInfoByEmail(req.user.email, {
    methodType,
    paymentDetails,
  });
  res.json({ data: paymentInfo });
}

module.exports = { getDashboard, upsertPaymentInfo };
