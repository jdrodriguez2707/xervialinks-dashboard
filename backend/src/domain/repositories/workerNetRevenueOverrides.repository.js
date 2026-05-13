const { getDb } = require("../../infrastructure/database/database");

function find(workerId, gamNetworkCode, periodStart, periodEnd) {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT id, worker_id AS workerId, gam_network_code AS gamNetworkCode,
                period_start AS periodStart, period_end AS periodEnd,
                net_revenue AS netRevenue, updated_at AS updatedAt
         FROM worker_net_revenue_overrides
         WHERE worker_id = ? AND gam_network_code = ? AND period_start = ? AND period_end = ?`,
      )
      .get(
        Number(workerId),
        String(gamNetworkCode || "").trim(),
        String(periodStart || "").trim(),
        String(periodEnd || "").trim(),
      ) || null
  );
}

function upsert({ workerId, gamNetworkCode, periodStart, periodEnd, netRevenue }) {
  const db = getDb();
  const wid = Number(workerId);
  const net = Number(netRevenue);
  if (!Number.isFinite(wid) || !Number.isFinite(net)) {
    throw new Error("Invalid worker or net revenue");
  }
  const code = String(gamNetworkCode || "").trim();
  const ps = String(periodStart || "").trim();
  const pe = String(periodEnd || "").trim();
  if (!code || !ps || !pe) throw new Error("Missing network or period");

  db.prepare(
    `INSERT INTO worker_net_revenue_overrides (worker_id, gam_network_code, period_start, period_end, net_revenue, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(worker_id, gam_network_code, period_start, period_end) DO UPDATE SET
       net_revenue = excluded.net_revenue,
       updated_at = datetime('now')`,
  ).run(wid, code, ps, pe, net);
  return find(wid, code, ps, pe);
}

module.exports = { find, upsert };
