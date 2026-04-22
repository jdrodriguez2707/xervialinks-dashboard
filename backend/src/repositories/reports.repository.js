/**
 * Mock data that mirrors the shape Google Ad Manager API returns.
 * When we integrate the real API, only this file changes.
 *
 * revenue is in USD (floating point, 6 decimal precision as GAM returns it).
 * ecpm = (revenue / impressions) * 1000
 */
const mockReports = [
  {
    date: "2024-04-01",
    domain: "sports.example.com",
    impressions: 120000,
    revenue: 210.45,
    ecpm: 1.75,
  },
  {
    date: "2024-04-01",
    domain: "tech.example.com",
    impressions: 85000,
    revenue: 178.5,
    ecpm: 2.1,
  },
  {
    date: "2024-04-02",
    domain: "sports.example.com",
    impressions: 130000,
    revenue: 234.0,
    ecpm: 1.8,
  },
  {
    date: "2024-04-02",
    domain: "tech.example.com",
    impressions: 92000,
    revenue: 193.2,
    ecpm: 2.1,
  },
  {
    date: "2024-04-03",
    domain: "sports.example.com",
    impressions: 110000,
    revenue: 187.0,
    ecpm: 1.7,
  },
  {
    date: "2024-04-03",
    domain: "tech.example.com",
    impressions: 78000,
    revenue: 156.0,
    ecpm: 2.0,
  },
];

/**
 * Returns all reports, optionally filtered by domain and/or date range.
 *
 * @param {{ domain?: string, startDate?: string, endDate?: string }} filters
 * @returns {typeof mockReports}
 */
function findAll(filters = {}) {
  let results = mockReports;

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

module.exports = { findAll };
