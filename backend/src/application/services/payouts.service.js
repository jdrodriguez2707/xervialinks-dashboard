const reportsRepo = require("../../domain/repositories/reports.repository");
const workersRepo = require("../../domain/repositories/workers.repository");
const workerNetRevenueOverridesRepo = require("../../domain/repositories/workerNetRevenueOverrides.repository");
const workerDomainNetRevenueOverridesRepo = require("../../domain/repositories/workerDomainNetRevenueOverrides.repository");
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

      let assignedRevenue = assignedRevenueGam;
      let hasRevenueOverride = false;
      let hasDomainRevenueOverrides = false;
      let aggregateOverrideOnly = false;
      let domainBreakdown = [];

      if (!requesterEmail && netCode) {
        const nw = computeNetworkAssignmentForWorker({
          workerId: worker.id,
          percentage: worker.percentage,
          domainSlots,
          reports: matchingReports,
          effectiveStart,
          effectiveEnd,
          netCode,
        });
        assignedRevenue = nw.assignedRevenue;
        hasRevenueOverride = nw.hasRevenueOverride;
        hasDomainRevenueOverrides = nw.hasDomainRevenueOverrides;
        aggregateOverrideOnly = nw.aggregateOverrideOnly;
        domainBreakdown = nw.domainBreakdown;
      }

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
        hasRevenueOverride,
        hasDomainRevenueOverrides,
        aggregateOverrideOnly,
        domainBreakdown,
        assignedImpressions,
        payout,
      };
    })
    .filter(Boolean);

  const totalPayout = parseFloat(payouts.reduce((sum, w) => sum + w.payout, 0).toFixed(6));

  return { payouts, totalPayout };
}

/**
 * Ingreso neto efectivo y desglose por subdominio en una red y rango (admin / historial).
 * Precedencia: overrides por dominio si existe al menos uno; si no, override agregado por red; si no, GAM.
 */
function computeNetworkAssignmentForWorker({
  workerId,
  percentage,
  domainSlots,
  reports,
  effectiveStart,
  effectiveEnd,
  netCode,
}) {
  const netStr = String(netCode || "").trim();
  if (!netStr) return null;
  const wid = Number(workerId);
  const pct = Number(percentage) || 0;
  const ps = String(effectiveStart || "").trim();
  const pe = String(effectiveEnd || "").trim();

  const slotsOnNet = domainSlots.filter((s) => String(s.gamNetworkCode || "").trim() === netStr);

  const domainRows = workerDomainNetRevenueOverridesRepo.listByWorkerNetworkPeriod(
    wid,
    netStr,
    ps,
    pe,
  );
  const hasDomain = domainRows.length > 0;
  const domainOverrideMap = new Map(
    domainRows.map((r) => [String(r.domain || "").trim(), Number(r.netRevenue)]),
  );

  const networkRow = workerNetRevenueOverridesRepo.find(wid, netStr, ps, pe);

  let sumGam = 0;
  const slotGam = slotsOnNet.map((slot) => {
    const domainReports = reports.filter(
      (r) =>
        r.domain === slot.value &&
        String(r.networkCode || "").trim() === netStr &&
        r.date >= ps &&
        r.date <= pe,
    );
    const netGam = parseFloat(
      domainReports.reduce((s, r) => s + (Number(r.revenue) || 0), 0).toFixed(6),
    );
    const impressions = domainReports.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
    sumGam += netGam;
    return { slot, netGam, impressions };
  });

  const domainBreakdown = [];

  if (slotsOnNet.length === 0) {
    const assignedRevenueGam = 0;
    if (networkRow != null) {
      const assignedRevenue = parseFloat(Number(networkRow.netRevenue).toFixed(6));
      return {
        assignedRevenue,
        assignedRevenueGam,
        hasRevenueOverride: true,
        hasDomainRevenueOverrides: hasDomain,
        aggregateOverrideOnly: !hasDomain,
        domainBreakdown,
      };
    }
    return {
      assignedRevenue: 0,
      assignedRevenueGam,
      hasRevenueOverride: hasDomain,
      hasDomainRevenueOverrides: hasDomain,
      aggregateOverrideOnly: false,
      domainBreakdown,
    };
  }

  if (hasDomain) {
    let sumNetEff = 0;
    for (const { slot, netGam, impressions } of slotGam) {
      const hasOverride = domainOverrideMap.has(slot.value);
      const netEff = hasOverride ? Number(domainOverrideMap.get(slot.value)) : netGam;
      const payoutPreview = computePayout(netEff, pct);
      sumNetEff += netEff;
      domainBreakdown.push({
        domain: slot.value,
        gamNetworkCode: netStr,
        impressions,
        netGam,
        netEffective: netEff,
        hasDomainOverride: hasOverride,
        payoutPreview,
      });
    }
    return {
      assignedRevenue: parseFloat(sumNetEff.toFixed(6)),
      assignedRevenueGam: parseFloat(sumGam.toFixed(6)),
      hasRevenueOverride: hasDomain || networkRow != null,
      hasDomainRevenueOverrides: true,
      aggregateOverrideOnly: false,
      domainBreakdown,
    };
  }

  if (networkRow != null) {
    const networkNet = Number(networkRow.netRevenue);
    const assignedRevenue = parseFloat(Number(networkNet).toFixed(6));
    const assignedRevenueGam = parseFloat(sumGam.toFixed(6));
    for (const { slot, netGam, impressions } of slotGam) {
      let payoutPreview = 0;
      if (sumGam > 0) {
        payoutPreview = parseFloat((((networkNet * pct) / 100) * (netGam / sumGam)).toFixed(6));
      }
      domainBreakdown.push({
        domain: slot.value,
        gamNetworkCode: netStr,
        impressions,
        netGam,
        netEffective: netGam,
        hasDomainOverride: false,
        payoutPreview,
      });
    }
    return {
      assignedRevenue,
      assignedRevenueGam,
      hasRevenueOverride: true,
      hasDomainRevenueOverrides: false,
      aggregateOverrideOnly: true,
      domainBreakdown,
    };
  }

  let sumNetEff = 0;
  for (const { slot, netGam, impressions } of slotGam) {
    const payoutPreview = computePayout(netGam, pct);
    sumNetEff += netGam;
    domainBreakdown.push({
      domain: slot.value,
      gamNetworkCode: netStr,
      impressions,
      netGam,
      netEffective: netGam,
      hasDomainOverride: false,
      payoutPreview,
    });
  }
  return {
    assignedRevenue: parseFloat(sumNetEff.toFixed(6)),
    assignedRevenueGam: parseFloat(sumGam.toFixed(6)),
    hasRevenueOverride: false,
    hasDomainRevenueOverrides: false,
    aggregateOverrideOnly: false,
    domainBreakdown,
  };
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

/**
 * Admin: override de ingreso neto por subdominio (dominio + red + periodo).
 * Si existen filas por dominio para ese trabajador+red+periodo, el override agregado por red deja de aplicarse.
 */
function upsertWorkerDomainNetRevenueOverrideAdmin({
  workerId,
  gamNetworkCode,
  domain,
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
  const dom = String(domain || "").trim();
  if (!code || !gamNetworksRepo.findByCode(code)) {
    const e = new Error("Código de red no registrado");
    e.statusCode = 400;
    throw e;
  }
  const slots = getAssignedDomainSlots(worker.properties);
  const slotOk = slots.some(
    (s) => s.value === dom && String(s.gamNetworkCode || "").trim() === code,
  );
  if (!slotOk) {
    const e = new Error("El subdominio no está asignado a este trabajador en esa red");
    e.statusCode = 400;
    throw e;
  }
  const net = Number(netRevenue);
  if (!Number.isFinite(net) || net < 0) {
    const e = new Error("Ingreso neto inválido");
    e.statusCode = 400;
    throw e;
  }
  return workerDomainNetRevenueOverridesRepo.upsert({
    workerId: wid,
    gamNetworkCode: code,
    domain: dom,
    periodStart: ps,
    periodEnd: pe,
    netRevenue: net,
  });
}

function deleteWorkerDomainNetRevenueOverrideAdmin({
  workerId,
  gamNetworkCode,
  domain,
  periodStart,
  periodEnd,
}) {
  const ps = String(periodStart || "").trim();
  const pe = String(periodEnd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ps) || !/^\d{4}-\d{2}-\d{2}$/.test(pe)) {
    const e = new Error("periodStart y periodEnd deben ser fechas YYYY-MM-DD");
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
  const dom = String(domain || "").trim();
  if (!code || !dom) {
    const e = new Error("Faltan red o subdominio");
    e.statusCode = 400;
    throw e;
  }
  const ok = workerDomainNetRevenueOverridesRepo.remove(wid, code, dom, ps, pe);
  if (!ok) {
    const e = new Error("No había override para ese subdominio y periodo");
    e.statusCode = 404;
    throw e;
  }
  return { deleted: true };
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
  upsertWorkerDomainNetRevenueOverrideAdmin,
  deleteWorkerDomainNetRevenueOverrideAdmin,
  computeNetworkAssignmentForWorker,
};
