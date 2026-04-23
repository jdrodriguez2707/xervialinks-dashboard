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
    { date: date(0), domain: "sports.example.com", impressions: 120000, revenue: 210.45, ecpm: 1.75 },
    { date: date(0), domain: "tech.example.com",   impressions: 85000,  revenue: 178.5,  ecpm: 2.1  },
    { date: date(1), domain: "sports.example.com", impressions: 130000, revenue: 234.0,  ecpm: 1.8  },
    { date: date(1), domain: "tech.example.com",   impressions: 92000,  revenue: 193.2,  ecpm: 2.1  },
    { date: date(3), domain: "sports.example.com", impressions: 110000, revenue: 187.0,  ecpm: 1.7  },
    { date: date(3), domain: "tech.example.com",   impressions: 78000,  revenue: 156.0,  ecpm: 2.0  },
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

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

module.exports = { findAll };
