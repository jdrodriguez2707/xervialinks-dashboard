const workersService = require("../services/workers.service");
const revenueService = require("../services/revenue.service");

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
    },
  });
}

module.exports = { getDashboard };
