const { getDb } = require("../../infrastructure/database/database");
const env = require("../../infrastructure/config/env");
const { buildMockReports } = require("../../infrastructure/integrations/mockReports");
const CACHE_TTL_MS = 60 * 1000;
const reportsCache = new Map();
const inflightRequests = new Map();
let seedPromise = null;

function getSeedingNetworkCode() {
  const db = getDb();
  const row = db
    .prepare("SELECT network_code AS c FROM gam_networks WHERE is_default = 1 LIMIT 1")
    .get();
  if (row?.c) return String(row.c);
  return String(env.GAM_NETWORK_CODE || "").trim() || "default";
}

/**
 * Returns reports from database only.
 *
 * @param {{
 *   domain?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   timeZone?: string,
 *   networkCode?: string,
 *   networkCodes?: string[],
 * }} filters
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

  const single = filters.networkCode != null && String(filters.networkCode).trim() !== "";
  const multi =
    Array.isArray(filters.networkCodes) &&
    filters.networkCodes.some((c) => String(c || "").trim() !== "");

  if (single) {
    where.push("network_code = ?");
    params.push(String(filters.networkCode).trim());
  } else if (multi) {
    const codes = [...new Set(filters.networkCodes.map((c) => String(c || "").trim()).filter(Boolean))];
    if (codes.length === 0) {
      return [];
    }
    where.push(`network_code IN (${codes.map(() => "?").join(",")})`);
    params.push(...codes);
  }

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
      `SELECT network_code AS networkCode, date, domain, impressions, revenue, ecpm
       FROM reports
       ${whereClause}
       ORDER BY date DESC, domain ASC`,
    )
    .all(...params);

  return rows.map(normalizeRow);
}

function upsertMany(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO reports (network_code, date, domain, impressions, revenue, ecpm, source, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(network_code, date, domain) DO UPDATE SET
       impressions = excluded.impressions,
       revenue = excluded.revenue,
       ecpm = excluded.ecpm,
       source = excluded.source,
       synced_at = datetime('now')`,
  );

  db.transaction((items) => {
    for (const row of items) {
      const normalized = normalizeRow(row);
      if (!normalized.date || !normalized.domain || !normalized.networkCode) continue;
      insert.run(
        normalized.networkCode,
        normalized.date,
        normalized.domain,
        normalized.impressions,
        normalized.revenue,
        normalized.ecpm,
        normalized.source || "sync",
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

function getSyncStatus() {
  const db = getDb();
  const globalRow = db
    .prepare(
      `SELECT synced_at AS lastSyncedAt, source AS lastSource
       FROM reports
       WHERE synced_at IS NOT NULL
       ORDER BY datetime(synced_at) DESC, id DESC
       LIMIT 1`,
    )
    .get();

  const byNetwork = db
    .prepare(
      `SELECT network_code AS networkCode,
              MAX(synced_at) AS lastSyncedAt
       FROM reports
       WHERE synced_at IS NOT NULL
       GROUP BY network_code
       ORDER BY network_code ASC`,
    )
    .all();

  return {
    lastSyncedAt: globalRow?.lastSyncedAt || null,
    lastSource: globalRow?.lastSource || null,
    totalRows: countAll(),
    byNetwork: byNetwork.map((r) => ({
      networkCode: r.networkCode,
      lastSyncedAt: r.lastSyncedAt || null,
    })),
  };
}

function getLastSyncForNetwork(networkCode) {
  const code = String(networkCode || "").trim();
  if (!code) return { lastSyncedAt: null, lastSource: null };
  const db = getDb();
  const row = db
    .prepare(
      `SELECT synced_at AS lastSyncedAt, source AS lastSource
       FROM reports
       WHERE network_code = ? AND synced_at IS NOT NULL
       ORDER BY datetime(synced_at) DESC, id DESC
       LIMIT 1`,
    )
    .get(code);
  return {
    lastSyncedAt: row?.lastSyncedAt || null,
    lastSource: row?.lastSource || null,
  };
}

function buildCacheKey({ startDate, endDate, domain, networkCode, networkCodes }) {
  let net = "";
  if (networkCode != null && String(networkCode).trim() !== "") {
    net = `c:${String(networkCode).trim()}`;
  } else if (Array.isArray(networkCodes) && networkCodes.length) {
    net = `in:${[...new Set(networkCodes.map((c) => String(c || "").trim()).filter(Boolean))]
      .sort()
      .join(",")}`;
  } else {
    net = "all";
  }
  return `${net}|${startDate || ""}|${endDate || ""}|${domain || "*"}`;
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
      const net = getSeedingNetworkCode();
      const rows = buildMockReports(undefined, net);
      upsertMany(rows.map((r) => ({ ...r, source: "mock-seed" })));
    })
    .finally(() => {
      seedPromise = null;
    });
  return seedPromise;
}

function normalizeRow(row) {
  const net =
    row?.networkCode != null
      ? String(row.networkCode).trim()
      : row?.network_code != null
        ? String(row.network_code).trim()
        : "";
  return {
    networkCode: net,
    date: String(row?.date || ""),
    domain: String(row?.domain || ""),
    impressions: Number(row?.impressions || 0),
    revenue: Number(Number(row?.revenue || 0).toFixed(6)),
    ecpm: Number(Number(row?.ecpm || 0).toFixed(4)),
    source: row?.source ? String(row.source) : undefined,
  };
}

module.exports = {
  findAll,
  upsertMany,
  countAll,
  clearCache,
  getSyncStatus,
  getLastSyncForNetwork,
  getSeedingNetworkCode,
};
