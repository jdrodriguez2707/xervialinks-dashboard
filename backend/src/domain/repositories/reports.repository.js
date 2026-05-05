const { getDb } = require("../../infrastructure/database/database");
const env = require("../../infrastructure/config/env");
const { buildMockReports } = require("../../infrastructure/integrations/mockReports");
const CACHE_TTL_MS = 60 * 1000;
const reportsCache = new Map();
const inflightRequests = new Map();
let seedPromise = null;

/**
 * Returns reports from database only.
 *
 * @param {{ domain?: string, startDate?: string, endDate?: string, timeZone?: string }} filters
 */
async function findAll(filters = {}) {
  if (!env.USE_REAL_GAM_API) {
    await ensureLocalMockSeed();
  }
  const cacheKey = buildCacheKey(filters);

  const cached = getCache(cacheKey);
  if (cached) return cached;

  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const request = Promise.resolve()
    .then(() => queryReportsFromDb(filters))
    .then((result) => {
      setCache(cacheKey, result);
      return result;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  inflightRequests.set(cacheKey, request);
  return request;
}

function queryReportsFromDb(filters = {}) {
  const db = getDb();
  const params = [];
  const where = [];

  if (filters.domain) {
    where.push("domain = ?");
    params.push(filters.domain);
  }
  if (filters.startDate) {
    where.push("date >= ?");
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    where.push("date <= ?");
    params.push(filters.endDate);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT date, domain, impressions, revenue, ecpm
       FROM reports
       ${whereClause}
       ORDER BY date DESC, domain ASC`
    )
    .all(...params);

  return rows.map(normalizeRow);
}

function upsertMany(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO reports (date, domain, impressions, revenue, ecpm, source, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(date, domain) DO UPDATE SET
       impressions = excluded.impressions,
       revenue = excluded.revenue,
       ecpm = excluded.ecpm,
       source = excluded.source,
       synced_at = datetime('now')`
  );

  db.transaction((items) => {
    for (const row of items) {
      const normalized = normalizeRow(row);
      if (!normalized.date || !normalized.domain) continue;
      insert.run(
        normalized.date,
        normalized.domain,
        normalized.impressions,
        normalized.revenue,
        normalized.ecpm,
        normalized.source || "sync"
      );
    }
  })(rows);

  clearCache();
}

function countAll() {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS total FROM reports").get();
  return row?.total || 0;
}

function buildCacheKey({ startDate, endDate, domain }) {
  return `${startDate || ""}|${endDate || ""}|${domain || "*"}`;
}

function getCache(key) {
  const entry = reportsCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    reportsCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  reportsCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function clearCache() {
  reportsCache.clear();
}

async function ensureLocalMockSeed() {
  if (countAll() > 0) return;
  if (seedPromise) return seedPromise;
  seedPromise = Promise.resolve()
    .then(() => {
      if (countAll() > 0) return;
      const rows = buildMockReports();
      upsertMany(rows.map((r) => ({ ...r, source: "mock-seed" })));
    })
    .finally(() => {
      seedPromise = null;
    });
  return seedPromise;
}

function normalizeRow(row) {
  return {
    date: String(row?.date || ""),
    domain: String(row?.domain || ""),
    impressions: Number(row?.impressions || 0),
    revenue: Number(Number(row?.revenue || 0).toFixed(6)),
    ecpm: Number(Number(row?.ecpm || 0).toFixed(4)),
    source: row?.source ? String(row.source) : undefined,
  };
}

module.exports = { findAll, upsertMany, countAll, clearCache };
