const env = require("../config/env");
const { fetchReports } = require("../integrations/gamReports");

/**
 * Mock data with dynamic dates so revenue ranges (today, yesterday, last 7
 * days, current month) always return meaningful values in development.
 *
 * Revenue is in USD (floating point, 6 decimal precision as GAM returns it).
 */
function buildMockReports() {
  const date = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  return [
    { date: date(0), domain: "elvalerobux.barbacoadicto.com",    impressions: 29714, revenue: 279.42, ecpm: 9.40 },
    { date: date(0), domain: "parceitorobux.barbacoadicto.com",  impressions: 45661, revenue: 552.10, ecpm: 12.09 },
    { date: date(0), domain: "plez.barbacoadicto.com",           impressions: 27527, revenue: 53.54,  ecpm: 1.94 },
    { date: date(0), domain: "barbacoadicto.com",                impressions: 16,    revenue: 0.01,   ecpm: 0.42 },
    { date: date(0), domain: "mundialautos.barbacoadicto.com",   impressions: 62,    revenue: 0.10,   ecpm: 1.59 },
    { date: date(1), domain: "elvalerobux.barbacoadicto.com",    impressions: 28100, revenue: 265.80, ecpm: 9.46 },
    { date: date(1), domain: "parceitorobux.barbacoadicto.com",  impressions: 43200, revenue: 520.30, ecpm: 12.04 },
    { date: date(1), domain: "plez.barbacoadicto.com",           impressions: 25900, revenue: 50.10,  ecpm: 1.93 },
    { date: date(3), domain: "elvalerobux.barbacoadicto.com",    impressions: 26500, revenue: 248.60, ecpm: 9.38 },
    { date: date(3), domain: "parceitorobux.barbacoadicto.com",  impressions: 41800, revenue: 498.70, ecpm: 11.93 },
    { date: date(3), domain: "plez.barbacoadicto.com",           impressions: 24300, revenue: 47.20,  ecpm: 1.94 },
  ];
}

const DEFAULT_DATE_RANGE_DAYS = 30;

/**
 * Returns reports from GAM or from mock data depending on USE_REAL_GAM_API.
 * Always async so callers don't need to change when switching to real API.
 *
 * @param {{ domain?: string, startDate?: string, endDate?: string }} filters
 */
async function findAll(filters = {}) {
  if (env.USE_REAL_GAM_API) {
    return findAllFromGam(filters);
  }
  return findAllFromMock(filters);
}

async function findAllFromGam(filters) {
  const today = todayISO();
  const startDate = filters.startDate || daysAgoISO(DEFAULT_DATE_RANGE_DAYS);
  const endDate = filters.endDate || today;

  const reports = await fetchReports({ startDate, endDate });

  return filters.domain
    ? reports.filter((r) => r.domain === filters.domain)
    : reports;
}

function findAllFromMock(filters) {
  let results = buildMockReports();

  if (filters.domain) {
    results = results.filter((r) => r.domain === filters.domain);
  }
  if (filters.startDate) {
    results = results.filter((r) => r.date >= filters.startDate);
  }
  if (filters.endDate) {
    results = results.filter((r) => r.date <= filters.endDate);
  }

  return results;
}

// Both helpers use UTC to stay consistent with toISOString().
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

module.exports = { findAll };
