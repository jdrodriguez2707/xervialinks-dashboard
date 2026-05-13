const reportsRepo = require("../../domain/repositories/reports.repository");
const workersRepo = require("../../domain/repositories/workers.repository");
const {
  getAssignedDomainSlots,
  computePayout,
  computeNetworkAssignmentForWorker,
} = require("./payouts.service");

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

  const mergedByDomain = new Map();
  let totalNet = 0;

  for (const net of networkCodes) {
    const nw = computeNetworkAssignmentForWorker({
      workerId: worker.id,
      percentage: pct,
      domainSlots: slots,
      reports,
      effectiveStart: startDate,
      effectiveEnd: endDate,
      netCode: net,
    });
    if (!nw) continue;
    totalNet += computePayout(nw.assignedRevenue, pct);
    for (const row of nw.domainBreakdown) {
      const prev = mergedByDomain.get(row.domain) || { impressions: 0, netEffective: 0, payout: 0 };
      mergedByDomain.set(row.domain, {
        impressions: prev.impressions + row.impressions,
        netEffective: prev.netEffective + row.netEffective,
        payout: prev.payout + row.payoutPreview,
      });
    }
  }

  const rows = [...mergedByDomain.entries()].map(([domain, agg]) => ({
    domain,
    impressions: agg.impressions,
    grossRevenue: parseFloat(Number(agg.netEffective || 0).toFixed(6)),
    percentage: pct,
    payout: parseFloat(Number(agg.payout || 0).toFixed(2)),
  }));

  return {
    rows,
    totalNet: parseFloat(totalNet.toFixed(2)),
    percentage: pct,
  };
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
