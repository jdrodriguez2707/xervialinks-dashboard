const workersService = require("../../application/services/workers.service");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");

async function listWorkers(req, res) {
  const includeDeleted = req.query.includeDeleted === "true" || req.query.includeDeleted === "1";
  const timeZone = clientTimeZoneFromRequest(req);
  const workers = workersService.getAllWorkers(includeDeleted, req.query.paymentMonth, true, timeZone);
  res.json({ data: workers });
}

async function getWorker(req, res) {
  const timeZone = clientTimeZoneFromRequest(req);
  const worker = workersService.getWorkerById(req.params.id, req.query.paymentMonth, true, timeZone);
  res.json({ data: worker });
}

async function getMe(req, res) {
  const timeZone = clientTimeZoneFromRequest(req);
  const worker = workersService.getWorkerByEmail(req.user.email, req.query.paymentMonth, timeZone);
  if (!worker) {
    return res.status(404).json({ error: "No tienes un perfil de trabajador asignado" });
  }
  res.json({ data: worker });
}

async function createWorker(req, res) {
  const { name, email, percentage, password } = req.body;
  const worker = await workersService.createWorker({ name, email, percentage, password });
  res.status(201).json({ data: worker });
}

async function addProperty(req, res) {
  const { type, value, gamNetworkCode } = req.body || {};
  const property = workersService.addPropertyToWorker(
    req.params.id,
    { type, value, gamNetworkCode },
    req.query.networkCode,
  );
  res.status(201).json({ data: property });
}

async function deleteWorker(req, res) {
  workersService.deleteWorker(req.params.id);
  res.status(204).end();
}

async function purgeInactiveWorker(req, res) {
  workersService.purgeInactiveWorker(req.params.id);
  res.status(204).end();
}

async function updatePaymentStatus(req, res) {
  const { status, paymentMonth } = req.body || {};
  const timeZone = clientTimeZoneFromRequest(req);
  const paymentStatus = await workersService.updateWorkerPaymentStatus(
    req.params.id,
    status,
    paymentMonth,
    { timeZone },
  );
  res.json({ data: paymentStatus });
}

async function updateWorker(req, res) {
  const worker = await workersService.updateWorker(req.params.id, req.body || {}, {
    defaultGamNetworkCode: req.query.networkCode,
  });
  res.json({ data: worker });
}

module.exports = {
  listWorkers,
  getWorker,
  getMe,
  createWorker,
  deleteWorker,
  purgeInactiveWorker,
  addProperty,
  updatePaymentStatus,
  updateWorker,
};
