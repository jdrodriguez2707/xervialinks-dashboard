const workersRepo = require("../repositories/workers.repository");

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
  }
}

function getAllWorkers() {
  return workersRepo.findAll();
}

function getWorkerById(id) {
  const worker = workersRepo.findById(Number(id));
  if (!worker) throw new NotFoundError(`Worker ${id} not found`);
  return worker;
}

function createWorker({ name, email, percentage }) {
  if (!name || !email || percentage == null) {
    throw new ValidationError("name, email and percentage are required");
  }
  if (typeof percentage !== "number" || percentage <= 0 || percentage > 100) {
    throw new ValidationError("percentage must be a number between 0 and 100 (exclusive)");
  }

  const existing = workersRepo.findByEmail(email);
  if (existing) throw new ConflictError(`Email ${email} is already in use`);

  return workersRepo.create({ name, email, percentage });
}

function addPropertyToWorker(workerId, { type, value }) {
  const VALID_TYPES = ["domain", "ad_unit"];
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError(`type must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new ValidationError("value is required and must be a non-empty string");
  }

  getWorkerById(workerId);

  try {
    return workersRepo.addProperty(Number(workerId), { type, value: value.trim() });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      throw new ConflictError(`Property (${type}: ${value}) already assigned to this worker`);
    }
    throw err;
  }
}

module.exports = {
  getAllWorkers,
  getWorkerById,
  createWorker,
  addPropertyToWorker,
};
