const reportsRepo = require("../../domain/repositories/reports.repository");
const workersService = require("./workers.service");
const { getAssignedDomainSlots } = require("./payouts.service");

async function getWorkerPaymentHistoryByEmail(email, { paymentMonth, timeZone }) {
  const worker = workersService.getWorkerByEmail(email, paymentMonth);
  if (!worker) {
    return { period: paymentMonth, rows: [], paymentStatus: "pending" };
  }

  const slots = getAssignedDomainSlots(worker.properties);

  if (slots.length === 0) {
    return {
      period: paymentMonth,
      rows: [],
      paymentStatus: worker.paymentStatus || "pending",
    };
  }

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

  const rows = [...byDomain.entries()].map(([domain, agg]) => ({
    domain,
    impressions: agg.impressions,
    payout: parseFloat(((agg.grossRevenue * worker.percentage) / 100).toFixed(2)),
    paymentStatus: worker.paymentStatus || "pending",
  }));

  return {
    period: paymentMonth,
    rows,
    paymentStatus: worker.paymentStatus || "pending",
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

module.exports = { getWorkerPaymentHistoryByEmail };
