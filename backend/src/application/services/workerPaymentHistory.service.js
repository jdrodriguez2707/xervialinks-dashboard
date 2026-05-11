const reportsRepo = require("../../domain/repositories/reports.repository");
const workersRepo = require("../../domain/repositories/workers.repository");
const { getAssignedDomainSlots } = require("./payouts.service");

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

  const byDomain = new Map();
  for (const slot of slots) {
    const domainReports = reports.filter(
      (r) => r.domain === slot.value && String(r.networkCode || "").trim() === slot.gamNetworkCode,
    );
    const impressions = domainReports.reduce((sum, r) => sum + (r.impressions || 0), 0);
    const grossRevenue = domainReports.reduce((sum, r) => sum + (r.revenue || 0), 0);
    const prev = byDomain.get(slot.value) || { impressions: 0, grossRevenue: 0 };
    byDomain.set(slot.value, {
      impressions: prev.impressions + impressions,
      grossRevenue: prev.grossRevenue + grossRevenue,
    });
  }

  const rows = [...byDomain.entries()].map(([domain, agg]) => {
    const payout = parseFloat(((agg.grossRevenue * pct) / 100).toFixed(2));
    return {
      domain,
      impressions: agg.impressions,
      grossRevenue: parseFloat(Number(agg.grossRevenue || 0).toFixed(6)),
      percentage: pct,
      payout,
    };
  });

  const totalNet = parseFloat(rows.reduce((sum, r) => sum + r.payout, 0).toFixed(2));
  return { rows, totalNet, percentage: pct };
}

async function getWorkerPaymentHistoryByEmail(email, { paymentMonth, timeZone }) {
  const worker = workersRepo.findByEmail(email, { paymentMonth });
  if (!worker) {
    return { period: paymentMonth, rows: [], paymentStatus: "pending" };
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
      return {
        period: paymentMonth,
        rows,
        paymentStatus: effectiveStatus,
        paidTotalAmount: statusRow.paidTotalAmount,
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
