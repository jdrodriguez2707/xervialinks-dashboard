const workersService = require("../services/workers.service");

async function listWorkers(req, res) {
  const workers = workersService.getAllWorkers();
  res.json({ data: workers });
}

async function getWorker(req, res) {
  const worker = workersService.getWorkerById(req.params.id);
  res.json({ data: worker });
}

async function createWorker(req, res) {
  const { name, email, percentage } = req.body;
  const worker = workersService.createWorker({ name, email, percentage });
  res.status(201).json({ data: worker });
}

async function addProperty(req, res) {
  const { type, value } = req.body;
  const property = workersService.addPropertyToWorker(req.params.id, {
    type,
    value,
  });
  res.status(201).json({ data: property });
}

module.exports = { listWorkers, getWorker, createWorker, addProperty };
