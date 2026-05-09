const bcrypt = require("bcryptjs");
const workersRepo = require("../../domain/repositories/workers.repository");
const authRepo = require("../../domain/repositories/auth.repository");
const gamNetworksRepo = require("../../domain/repositories/gamNetworks.repository");
const { isAssignableSubdomain } = require("./sites.service");
const { encryptPassword, decryptPassword } = require("../../infrastructure/security/passwordVault");

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

function resolveGamNetworkCodeForWrite(explicit, queryFallback) {
  const fromExplicit = explicit != null ? String(explicit).trim() : "";
  if (fromExplicit) return fromExplicit;
  const fromQuery = queryFallback != null ? String(queryFallback).trim() : "";
  if (fromQuery) return fromQuery;
  const def = gamNetworksRepo.getDefaultNetworkCode();
  if (def) return String(def).trim();
  const first = gamNetworksRepo.listAll()[0];
  if (first?.networkCode) return String(first.networkCode).trim();
  return "";
}

/**
 * @param {unknown} raw
 * @param {string} defaultGamNetworkCode
 * @returns {{ value: string, gamNetworkCode: string }[]}
 */
function normalizeDomainAssignments(raw, defaultGamNetworkCode) {
  if (!Array.isArray(raw)) return [];
  const def = String(defaultGamNetworkCode || "").trim();
  const out = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const value = item.trim();
      if (value) out.push({ value, gamNetworkCode: def });
    } else if (item && typeof item === "object") {
      const value = String(item.value ?? "").trim();
      const gamNetworkCode = String(item.gamNetworkCode ?? item.gam_network_code ?? def).trim();
      if (value && gamNetworkCode) out.push({ value, gamNetworkCode });
    }
  }
  return out;
}

function getAllWorkers(includeDeleted = false, paymentMonth = null, includePassword = false) {
  const resolvedMonth = resolvePaymentMonth(paymentMonth);
  const workers = workersRepo.findAll({
    includeDeleted: !!includeDeleted,
    paymentMonth: resolvedMonth,
  });
  if (!includePassword) return workers;
  return workers.map(attachPasswordField);
}

function getWorkerByEmail(email, paymentMonth = null) {
  return (
    workersRepo.findByEmail(email, { paymentMonth: resolvePaymentMonth(paymentMonth) }) || null
  );
}

function getWorkerByEmailIncludingDeleted(email) {
  return workersRepo.findByEmail(email, { includeDeleted: true }) || null;
}

function getWorkerById(id, paymentMonth = null, includePassword = false) {
  const worker = workersRepo.findById(Number(id), {
    paymentMonth: resolvePaymentMonth(paymentMonth),
  });
  if (!worker) throw new NotFoundError(`Worker ${id} not found`);
  return includePassword ? attachPasswordField(worker) : worker;
}

/**
 * Creates a worker and, if a password is provided, also creates their user
 * account atomically in a single SQLite transaction so both records are
 * always in sync.
 *
 * @param {{ name: string, email: string, percentage: number, password: string }} data
 */
async function createWorker({ name, email, percentage, password }) {
  if (!name || !email || percentage == null || !password || !String(password).trim()) {
    throw new ValidationError("Nombre, email, porcentaje y contraseña son requeridos");
  }
  if (typeof percentage !== "number" || percentage <= 0 || percentage > 100) {
    throw new ValidationError("El porcentaje debe ser un número entre 0 y 100 (exclusivo)");
  }

  const existingWorker = workersRepo.findByEmail(email, { includeDeleted: true });
  if (existingWorker) throw new ConflictError(`El email ${email} ya está en uso`);

  const existingUser = authRepo.findByEmail(email);
  if (existingUser)
    throw new ConflictError(`Ya existe una cuenta de usuario con el email ${email}`);

  const trimmedPassword = String(password).trim();
  const passwordHash = await bcrypt.hash(trimmedPassword, 10);
  const passwordCipher = encryptPassword(trimmedPassword);
  return workersRepo.createWithUser({ name, email, percentage }, { passwordHash, passwordCipher });
}

function deleteWorker(id) {
  const numericId = Number(id);
  const worker = workersRepo.findById(numericId);
  if (!worker) throw new NotFoundError(`Worker ${id} not found`);

  const hasAssignedDomains = (worker.properties || []).some((p) => p.type === "domain");
  const deleted = hasAssignedDomains
    ? workersRepo.deleteById(numericId)
    : workersRepo.hardDeleteById(numericId);

  if (!deleted) throw new NotFoundError(`Worker ${id} not found`);
}

function purgeInactiveWorker(id) {
  const purged = workersRepo.hardDeleteInactiveById(Number(id));
  if (!purged) {
    throw new ValidationError("Solo se pueden eliminar definitivamente trabajadores inactivos");
  }
}

function addPropertyToWorker(workerId, { type, value, gamNetworkCode }, queryFallback = null) {
  const VALID_TYPES = ["domain", "ad_unit"];
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError(`El tipo debe ser uno de: ${VALID_TYPES.join(", ")}`);
  }
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new ValidationError("El valor es requerido y debe ser una cadena no vacía");
  }

  getWorkerById(workerId);
  const trimmedValue = value.trim();
  const net = resolveGamNetworkCodeForWrite(gamNetworkCode, queryFallback);
  if (!net) {
    throw new ValidationError("Se requiere código de red GAM (gamNetworkCode o red activa en la URL)");
  }
  const networkRow = gamNetworksRepo.findByCode(net);
  if (!networkRow) {
    throw new ValidationError("El código de red no está registrado");
  }

  // Domain ownership is exclusive across workers (same dominio + misma red).
  if (type === "domain") {
    if (!isAssignableSubdomain(trimmedValue)) {
      throw new ValidationError(
        "Solo se permiten subdominios asignables (ej: elvalerobux.barbacoadicto.com)",
      );
    }
    const existingDomain = workersRepo.findPropertyByTypeAndValue("domain", trimmedValue, net);
    if (existingDomain && existingDomain.worker_id !== Number(workerId)) {
      throw new ConflictError(
        `El subdominio ${trimmedValue} en la red ${net} ya está asignado a otro trabajador`,
      );
    }
  }

  try {
    return workersRepo.addProperty(Number(workerId), {
      type,
      value: trimmedValue,
      gamNetworkCode: net,
    });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      throw new ConflictError(
        `La propiedad (${type}: ${value}) ya está asignada a este trabajador`,
      );
    }
    throw err;
  }
}

function updateWorkerPaymentInfoByEmail(email, { methodType, paymentDetails }) {
  const worker = getWorkerByEmail(email);
  if (!worker) {
    throw new NotFoundError("No tienes un perfil de trabajador asignado");
  }
  if (!methodType || typeof methodType !== "string" || !methodType.trim()) {
    throw new ValidationError("El tipo de método de pago es requerido");
  }
  if (!paymentDetails || typeof paymentDetails !== "string" || !paymentDetails.trim()) {
    throw new ValidationError("La información de pago es requerida");
  }

  return workersRepo.upsertPaymentInfo(worker.id, {
    methodType: methodType.trim(),
    paymentDetails: paymentDetails.trim(),
  });
}

/**
 * @param {number|string} workerId
 * @param {{
 *   name: string,
 *   email: string,
 *   percentage: number,
 *   password?: string,
 *   domains: (string | { value: string, gamNetworkCode?: string })[],
 * }} body
 * @param {{ defaultGamNetworkCode?: string }} [opts]
 */
async function updateWorker(workerId, body, opts = {}) {
  const worker = getWorkerById(Number(workerId));
  const { name: rawName, email: rawEmail, percentage, password, domains } = body;

  if (!rawName || !rawEmail || percentage == null || !Array.isArray(domains)) {
    throw new ValidationError("Nombre, email, porcentaje y lista de subdominios son requeridos");
  }

  const name = String(rawName).trim();
  const email = String(rawEmail).trim();
  if (!name || !email) {
    throw new ValidationError("Nombre y email no pueden estar vacíos");
  }

  const pct = Number(percentage);
  if (typeof pct !== "number" || Number.isNaN(pct) || pct <= 0 || pct > 100) {
    throw new ValidationError("El porcentaje debe ser un número entre 0 y 100 (exclusivo)");
  }

  const defaultNet = resolveGamNetworkCodeForWrite(opts.defaultGamNetworkCode, null);
  const domainAssignments = normalizeDomainAssignments(domains, defaultNet);
  if (domainAssignments.length === 0 && domains.length > 0) {
    throw new ValidationError(
      "Cada subdominio necesita un código de red GAM (usa objetos { value, gamNetworkCode } o el query networkCode)",
    );
  }
  const seen = new Set();
  for (const slot of domainAssignments) {
    if (!isAssignableSubdomain(slot.value)) {
      throw new ValidationError(
        "Solo se permiten subdominios asignables (ej: elvalerobux.barbacoadicto.com)",
      );
    }
    if (!gamNetworksRepo.findByCode(slot.gamNetworkCode)) {
      throw new ValidationError(`Código de red no registrado: ${slot.gamNetworkCode}`);
    }
    const dedupeKey = `${slot.value}|||${slot.gamNetworkCode}`;
    if (seen.has(dedupeKey)) {
      throw new ValidationError("Lista de subdominios duplicada (mismo dominio y red)");
    }
    seen.add(dedupeKey);
    const existing = workersRepo.findPropertyByTypeAndValue(
      "domain",
      slot.value,
      slot.gamNetworkCode,
    );
    if (existing && Number(existing.worker_id) !== Number(worker.id)) {
      throw new ConflictError(
        `El subdominio ${slot.value} en la red ${slot.gamNetworkCode} ya está asignado a otro trabajador`,
      );
    }
  }

  const oldEmail = worker.email;
  if (email !== oldEmail) {
    const otherWorker = workersRepo.findByEmail(email, { includeDeleted: true });
    if (otherWorker && otherWorker.id !== worker.id) {
      throw new ConflictError(`El email ${email} ya está en uso`);
    }
    const userWithEmail = authRepo.findByEmail(email);
    if (userWithEmail && userWithEmail.email !== oldEmail) {
      throw new ConflictError(`Ya existe una cuenta con el email ${email}`);
    }
  }

  let passwordHash = null;
  let passwordCipher = null;
  let invalidateSessions = false;
  if (password != null && String(password).trim()) {
    const trimmedPassword = String(password).trim();
    passwordHash = await bcrypt.hash(trimmedPassword, 10);
    passwordCipher = encryptPassword(trimmedPassword);
    invalidateSessions = true;
  }

  try {
    return workersRepo.updateWorkerComplete(
      worker.id,
      oldEmail,
      {
        name,
        email,
        percentage: pct,
        passwordHash: passwordHash || null,
        passwordCipher: passwordCipher || null,
        invalidateSessions,
      },
      domainAssignments,
    );
  } catch (err) {
    if (String(err.message || err).includes("UNIQUE")) {
      throw new ConflictError("El email ya está en uso");
    }
    if (String(err.message).includes("Worker not found or inactive")) {
      throw new NotFoundError("Trabajador no encontrado o inactivo");
    }
    if (String(err.message).includes("Linked user not found")) {
      throw new NotFoundError("No se encontró la cuenta vinculada al trabajador");
    }
    throw err;
  }
}

function updateWorkerPaymentStatus(workerId, status, paymentMonth = null) {
  const VALID_STATUSES = ["pending", "paid"];
  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError(`El estado debe ser uno de: ${VALID_STATUSES.join(", ")}`);
  }
  const resolvedMonth = resolvePaymentMonth(paymentMonth);
  const numericId = Number(workerId);
  const worker = workersRepo.findById(numericId, { includeDeleted: true });
  if (!worker) {
    throw new NotFoundError(`Worker ${workerId} not found`);
  }
  if (worker.deleted_at) {
    throw new ValidationError("No se puede cambiar el estado de pago de trabajadores inactivos");
  }
  return workersRepo.upsertPaymentStatus(numericId, status, resolvedMonth);
}

function resolvePaymentMonth(paymentMonth) {
  if (paymentMonth == null || String(paymentMonth).trim() === "") {
    return getPreviousMonthKey();
  }
  const month = String(paymentMonth).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ValidationError("El periodo de pago debe tener formato YYYY-MM");
  }
  return month;
}

function getPreviousMonthKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const monthIdx = date.getUTCMonth() - 1;
  const target = new Date(Date.UTC(year, monthIdx, 1));
  const month = String(target.getUTCMonth() + 1).padStart(2, "0");
  return `${target.getUTCFullYear()}-${month}`;
}

function attachPasswordField(worker) {
  if (!worker?.email) return { ...worker, password: "" };
  const authUser = authRepo.findByEmailIncludingDeleted(worker.email);
  const password = decryptPassword(authUser?.password_cipher);
  return { ...worker, password };
}

module.exports = {
  getAllWorkers,
  getWorkerById,
  getWorkerByEmail,
  getWorkerByEmailIncludingDeleted,
  createWorker,
  deleteWorker,
  purgeInactiveWorker,
  addPropertyToWorker,
  updateWorker,
  updateWorkerPaymentInfoByEmail,
  updateWorkerPaymentStatus,
  resolvePaymentMonth,
};
