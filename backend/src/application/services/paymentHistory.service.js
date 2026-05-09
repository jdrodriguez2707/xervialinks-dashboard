const workersRepo = require("../../domain/repositories/workers.repository");
const payoutsService = require("./payouts.service");

async function listPaymentHistory({ timeZone, networkCode } = {}) {
  const paidStatuses = workersRepo.listPaidPaymentStatuses();
  if (paidStatuses.length === 0) return [];

  const payoutsByMonth = new Map();
  const uniqueMonths = [...new Set(paidStatuses.map((row) => row.paymentMonth))];

  for (const month of uniqueMonths) {
    const { startDate, endDate } = getMonthRange(month);
    const result = await payoutsService.calculatePayouts(
      { startDate, endDate, timeZone, networkCode },
      null,
    );
    const byWorker = new Map(result.payouts.map((p) => [p.workerId, p]));
    payoutsByMonth.set(month, byWorker);
  }

  return paidStatuses.map((row) => {
    const payout = payoutsByMonth.get(row.paymentMonth)?.get(row.workerId)?.payout || 0;
    return {
      paidAt: row.paidAt,
      paymentMonth: row.paymentMonth,
      status: "success",
      statusLabel: "Pago realizado",
      workerName: row.workerName,
      methodType: row.methodType || null,
      amount: payout,
    };
  });
}

function getMonthRange(paymentMonth) {
  const [yearStr, monthStr] = String(paymentMonth).split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  const startDate = formatDate(start);
  const endDate = formatDate(end);
  return { startDate, endDate };
}

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

module.exports = { listPaymentHistory };
