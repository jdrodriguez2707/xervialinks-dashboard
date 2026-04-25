const summaryService = require("../services/summary.service");

// Both helpers use UTC to match toISOString() and avoid cross-month edge cases.
function currentMonthStartISO() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function getSummary(req, res) {
  const startDate = req.query.startDate ?? currentMonthStartISO();
  const endDate   = req.query.endDate   ?? todayISO();
  const summary = await summaryService.getSummary({ startDate, endDate });
  res.json({ data: summary });
}

module.exports = { getSummary };
