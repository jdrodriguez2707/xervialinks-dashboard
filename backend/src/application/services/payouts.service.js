const reportsRepo = require("../../domain/repositories/reports.repository");
const workersRepo = require("../../domain/repositories/workers.repository");
const workerNetRevenueOverridesRepo = require("../../domain/repositories/workerNetRevenueOverrides.repository");
const gamNetworksRepo = require("../../domain/repositories/gamNetworks.repository");

/**
 * Calculates the payout for each worker based on their assigned properties
 * and the revenue from matching reports in the given date range.
 *
 * Formula: payout = assignedRevenue * (percentage / 100)
 *
 * Domain revenue matches (domain, network_code) from each domain property row.
 *
 * @param {{
 *   startDate?: string,
 *   endDate?: string,
 *   timeZone?: string,
 *   networkCode?: string,
 *   networkCodes?: string[],
 * }} filters
 * @param {string|null} requesterEmail  When set (worker role), only returns that worker's payout.
 */
async function calculatePayouts(filters = {}, requesterEmail = null) {
  const allWorkers = workersRepo.findAll({ includeDeleted: true });
  const workers = requesterEmail
    ? allWorkers.filter((w) => w.email === requesterEmail)
    : allWorkers;

  const reportFilters = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    timeZone: filters.timeZone,
    networkCode: filters.networkCode,
    networkCodes: filters.networkCodes,
  };

  if (requesterEmail && workers.length > 0) {
    const slots = workers.flatMap((w) => getAssignedDomainSlots(w.properties));
    const codes = [...new Set(slots.map((s) => s.gamNetworkCode).filter(Boolean))];
    if (codes.length > 0) {
      reportFilters.networkCodes = codes;
    }
    delete reportFilters.networkCode;
  }

  const reports = await reportsRepo.findAll(reportFilters);

  const tz = filters.timeZone || "America/Bogota";

  const payouts = workers
    .map((worker) => {
      const workerDeletedCalendar = deletedAtToBusinessCalendarISO(worker.deleted_at, tz);
      const filterStart = filters.startDate || "0000-00-00";
      const filterEnd = filters.endDate || "9999-12-31";
      const effectiveStart = filterStart;
      const effectiveEnd =
        workerDeletedCalendar && workerDeletedCalendar < filterEnd
          ? workerDeletedCalendar
          : filterEnd;
      if (effectiveStart > effectiveEnd) return null;

      const domainSlots = getAssignedDomainSlots(worker.properties);
      const assignedDomains = domainSlots.map((s) => s.value);
      const matchingReports = reports.filter(
        (r) =>
          domainSlots.some(
            (s) =>
              s.value === r.domain &&
              String(s.gamNetworkCode) === String(r.networkCode || "").trim(),
          ) &&
          r.date >= effectiveStart &&
          r.date <= effectiveEnd,
      );

      const assignedRevenueGam = sumRevenue(matchingReports);
      const assignedImpressions = sumImpressions(matchingReports);
      const netCode =
        reportFilters.networkCode != null && String(reportFilters.networkCode).trim() !== ""
          ? String(reportFilters.networkCode).trim()
          : null;
      const overrideRow =
        !requesterEmail && netCode
          ? workerNetRevenueOverridesRepo.find(
              worker.id,
              netCode,
              effectiveStart,
              effectiveEnd,
            )
          : null;
      const assignedRevenue =
        overrideRow != null ? Number(overrideRow.netRevenue) : assignedRevenueGam;
      const payout = computePayout(assignedRevenue, worker.percentage);

      if (workerDeletedCalendar && assignedRevenueGam === 0 && assignedImpressions === 0) {
        return null;
      }

      return {
        workerId: worker.id,
        name: worker.name,
        email: worker.email,
        percentage: worker.percentage,
        deletedAt: workerDeletedCalendar || null,
        assignedDomains,
        domainSlots,
        assignedProperties: worker.properties,
        assignedRevenue,
        assignedRevenueGam,
        hasRevenueOverride: overrideRow != null,
        assignedImpressions,
        payout,
      };
    })
    .filter(Boolean);

  const totalPayout = parseFloat(payouts.reduce((sum, w) => sum + w.payout, 0).toFixed(6));

  return { payouts, totalPayout };
}

/**
 * Admin: guarda ingreso neto manual para un trabajador + red + rango de fechas (alinea con GET /api/payouts).
 */
function upsertWorkerNetRevenueOverrideAdmin({
  workerId,
  gamNetworkCode,
  periodStart,
  periodEnd,
  netRevenue,
}) {
  const ps = String(periodStart || "").trim();
  const pe = String(periodEnd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ps) || !/^\d{4}-\d{2}-\d{2}$/.test(pe)) {
    const e = new Error("periodStart y periodEnd deben ser fechas YYYY-MM-DD");
    e.statusCode = 400;
    throw e;
  }
  if (ps > pe) {
    const e = new Error("La fecha inicial no puede ser posterior a la final");
    e.statusCode = 400;
    throw e;
  }
  const wid = Number(workerId);
  if (!Number.isFinite(wid)) {
    const e = new Error("Trabajador inválido");
    e.statusCode = 400;
    throw e;
  }
  const worker = workersRepo.findById(wid, { includeDeleted: true });
  if (!worker) {
    const e = new Error("Trabajador no encontrado");
    e.statusCode = 404;
    throw e;
  }
  const code = String(gamNetworkCode || "").trim();
  if (!code || !gamNetworksRepo.findByCode(code)) {
    const e = new Error("Código de red no registrado");
    e.statusCode = 400;
    throw e;
  }
  const net = Number(netRevenue);
  if (!Number.isFinite(net) || net < 0) {
    const e = new Error("Ingreso neto inválido");
    e.statusCode = 400;
    throw e;
  }
  return workerNetRevenueOverridesRepo.upsert({
    workerId: wid,
    gamNetworkCode: code,
    periodStart: ps,
    periodEnd: pe,
    netRevenue: net,
  });
}

// ─── Pure helpers (easy to unit-test in isolation) ────────────────────────────

function getAssignedDomains(properties) {
  return properties.filter((p) => p.type === "domain").map((p) => p.value);
}

function getAssignedDomainSlots(properties) {
  return properties
    .filter((p) => p.type === "domain")
    .map((p) => ({
      value: String(p.value || "").trim(),
      gamNetworkCode: String(p.gamNetworkCode || p.gam_network_code || "").trim(),
    }))
    .filter((s) => s.value && s.gamNetworkCode);
}

function computePayout(revenue, percentage) {
  return parseFloat(((revenue * percentage) / 100).toFixed(6));
}

function sumRevenue(reports) {
  return parseFloat(reports.reduce((sum, r) => sum + r.revenue, 0).toFixed(6));
}

function sumImpressions(reports) {
  return reports.reduce((sum, r) => sum + r.impressions, 0);
}

function normalizeDate(value) {
  if (!value || typeof value !== "string") return "";
  return value.slice(0, 10);
}

/** SQLite datetime('now') is UTC; interpret ambiguous strings as UTC for indexing. */
function parseDeletedAtToUtcMs(raw) {
  if (!raw || typeof raw !== "string") return NaN;
  const s = raw.trim();
  if (!s) return NaN;
  if (s.includes("T")) {
    return Date.parse(s);
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?/);
  if (!m) return NaN;
  const datePart = m[1];
  const timePart = m[2] || "00:00:00";
  return Date.parse(`${datePart}T${timePart}Z`);
}

function deletedAtToBusinessCalendarISO(deletedAtRaw, timeZone) {
  if (!deletedAtRaw || typeof deletedAtRaw !== "string") return "";
  const trimmed = deletedAtRaw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const tz = typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : "America/Bogota";
  const ms = parseDeletedAtToUtcMs(trimmed);
  if (!Number.isFinite(ms)) return normalizeDate(deletedAtRaw);
  try {
    return new Date(ms).toLocaleDateString("en-CA", { timeZone: tz });
  } catch {
    return normalizeDate(deletedAtRaw);
  }
}

module.exports = {
  calculatePayouts,
  getAssignedDomains,
  getAssignedDomainSlots,
  computePayout,
  sumRevenue,
  sumImpressions,
  deletedAtToBusinessCalendarISO,
  upsertWorkerNetRevenueOverrideAdmin,
};
