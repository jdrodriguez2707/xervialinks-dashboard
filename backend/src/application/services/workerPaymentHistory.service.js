const reportsRepo = require("../../domain/repositories/reports.repository");
const workersRepo = require("../../domain/repositories/workers.repository");
const { getAssignedDomainSlots } = require("./payouts.service");
const workerNetRevenueOverridesRepo = require("../../domain/repositories/workerNetRevenueOverrides.repository");

/**
 * Live payout breakdown for a worker + payment month (uses current worker.percentage).
 * Used when period is pending and to build the snapshot when marking paid.
 *
 * @returns {{ rows: Array<{ domain: string, impressions: number, grossRevenue: number, percentage: number, payout: number }>, totalNet: number, percentage: number }}
 */
async function computePaidSnapshot(worker, paymentMonth, timeZone) {
  const slots = getAssignedDomainSlots(worker.properties);
  if (slots.length === 0) {
    return { rows: [], totalNet: 0, percentage: Number(worker.percentage) || 0 };
  }

  const pct = Number(worker.percentage) || 0;
  const { startDate, endDate } = monthRange(paymentMonth);
  const networkCodes = [...new Set(slots.map((s) => s.gamNetworkCode))];
  const reports = await reportsRepo.findAll({ startDate, endDate, timeZone, networkCodes });

  /** @type {Map<string, { impressions: number, grossRevenue: number }>} key domain|||network */
  const slotStats = new Map();
  for (const slot of slots) {
    const domainReports = reports.filter(
      (r) =>
        r.domain === slot.value && String(r.networkCode || "").trim() === slot.gamNetworkCode,
    );
    const impressions = domainReports.reduce((sum, r) => sum + (r.impressions || 0), 0);
    const grossRevenue = domainReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const k = `${slot.value}|||${slot.gamNetworkCode}`;
    const prev = slotStats.get(k) || { impressions: 0, grossRevenue: 0 };
    slotStats.set(k, {
      impressions: prev.impressions + impressions,
      grossRevenue: prev.grossRevenue + grossRevenue,
    });
  }

  /** Collapse by domain for worker UI cards */
  const byDomain = new Map();
  for (const [key, agg] of slotStats) {
    const domain = key.split("|||")[0];
    const payout = parseFloat(((agg.grossRevenue * pct) / 100).toFixed(2));
    const prev = byDomain.get(domain) || { impressions: 0, grossRevenue: 0, payout: 0 };
    byDomain.set(domain, {
      impressions: prev.impressions + agg.impressions,
      grossRevenue: prev.grossRevenue + agg.grossRevenue,
      payout: prev.payout + payout,
    });
  }

  const rows = [...byDomain.entries()].map(([domain, agg]) => ({
    domain,
    impressions: agg.impressions,
    grossRevenue: parseFloat(Number(agg.grossRevenue || 0).toFixed(6)),
    percentage: pct,
    payout: parseFloat(Number(agg.payout || 0).toFixed(2)),
  }));

  const totalNet = computeTotalNetPayoutWithOverrides(
    worker,
    startDate,
    endDate,
    networkCodes,
    reports,
    slots,
    pct,
  );
  return { rows, totalNet, percentage: pct };
}

/**
 * Total a pagar al trabajador en el mes: por cada red GAM, ingreso asignado = override o suma GAM,
 * luego aplica el porcentaje (misma regla que calculatePayouts por red). Las filas por subdominio
 * siguen solo con datos GAM.
 */
function computeTotalNetPayoutWithOverrides(worker, startDate, endDate, networkCodes, reports, slots, pct) {
  let total = 0;
  for (const net of networkCodes) {
    const netStr = String(net || "").trim();
    let sumGam = 0;
    for (const slot of slots) {
      if (String(slot.gamNetworkCode || "").trim() !== netStr) continue;
      const domainReports = reports.filter(
        (r) =>
          r.domain === slot.value && String(r.networkCode || "").trim() === netStr,
      );
      sumGam += domainReports.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    }
    const overrideRow = workerNetRevenueOverridesRepo.find(worker.id, netStr, startDate, endDate);
    const assigned = overrideRow != null ? Number(overrideRow.netRevenue) : sumGam;
    const part = (Number(assigned) * pct) / 100;
    total += Number.isFinite(part) ? part : 0;
  }
  return parseFloat(total.toFixed(2));
}

async function getWorkerPaymentHistoryByEmail(email, { paymentMonth, timeZone }) {
  const worker = workersRepo.findByEmail(email, { paymentMonth });
  if (!worker) {
    return { period: paymentMonth, rows: [], paymentStatus: "pending", totalPayout: 0 };
  }

  const statusRow = workersRepo.getPaymentStatusRow(worker.id, paymentMonth);
  const effectiveStatus = statusRow.paymentStatus || "pending";

  if (statusRow.paidRowsJson) {
    try {
      const parsed = JSON.parse(statusRow.paidRowsJson);
      const rows = Array.isArray(parsed)
        ? parsed.map((r) => ({
            domain: r.domain,
            impressions: r.impressions ?? 0,
            payout: r.payout ?? 0,
            paymentStatus: effectiveStatus,
          }))
        : [];
      const paidTotal =
        statusRow.paidTotalAmount != null && !Number.isNaN(Number(statusRow.paidTotalAmount))
          ? Number(statusRow.paidTotalAmount)
          : parseFloat(rows.reduce((s, r) => s + Number(r.payout || 0), 0).toFixed(2));
      return {
        period: paymentMonth,
        rows,
        paymentStatus: effectiveStatus,
        paidTotalAmount: statusRow.paidTotalAmount,
        totalPayout: paidTotal,
      };
    } catch {
      // fall through to live calculation
    }
  }

  const live = await computePaidSnapshot(worker, paymentMonth, timeZone);
  const rows = live.rows.map((r) => ({
    domain: r.domain,
    impressions: r.impressions,
    payout: r.payout,
    paymentStatus: worker.paymentStatus || "pending",
  }));

  return {
    period: paymentMonth,
    rows,
    paymentStatus: worker.paymentStatus || "pending",
    paidTotalAmount: null,
    totalPayout: live.totalNet,
  };
}

function monthRange(paymentMonth) {
  const [yearStr, monthStr] = String(paymentMonth || "").split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { startDate: toISO(start), endDate: toISO(end) };
}

function toISO(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

module.exports = {
  getWorkerPaymentHistoryByEmail,
  computePaidSnapshot,
};
