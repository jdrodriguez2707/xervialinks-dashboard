const workersService = require("../services/workers.service");
const revenueService = require("../services/revenue.service");

async function getDashboard(req, res) {
  const worker = workersService.getWorkerByEmail(req.user.email);

  if (!worker) {
    return res
      .status(404)
      .json({ error: "No tienes un perfil de trabajador asignado" });
  }

  const revenue = await revenueService.getWorkerDashboard(worker);
  res.json({
    data: {
      ...revenue,
      properties: worker.properties,
    },
  });
}

module.exports = { getDashboard };
