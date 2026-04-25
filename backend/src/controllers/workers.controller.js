const workersService = require("../services/workers.service");

async function listWorkers(req, res) {
  const workers = workersService.getAllWorkers();
  res.json({ data: workers });
}

async function getWorker(req, res) {
  const worker = workersService.getWorkerById(req.params.id);
  res.json({ data: worker });
}

async function getMe(req, res) {
  const worker = workersService.getWorkerByEmail(req.user.email);
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
  const { type, value } = req.body;
  const property = workersService.addPropertyToWorker(req.params.id, { type, value });
  res.status(201).json({ data: property });
}

async function deleteWorker(req, res) {
  workersService.deleteWorker(req.params.id);
  res.status(204).end();
}

module.exports = { listWorkers, getWorker, getMe, createWorker, deleteWorker, addProperty };
