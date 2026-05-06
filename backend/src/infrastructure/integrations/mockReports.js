const { getDefaultTimeZone, daysAgoISO } = require("../../application/services/clientTimezone");

/**
 * Mock data with dynamic dates so revenue ranges (today, yesterday, last 7
 * days, current month) always return meaningful values in development/tests.
 *
 * Revenue is in USD (floating point, 6 decimal precision).
 */
function buildMockReports(timeZone) {
  const tz = timeZone || getDefaultTimeZone();
  const date = (daysAgo) => daysAgoISO(daysAgo, tz);

  return [
    {
      date: date(0),
      domain: "elvalerobux.barbacoadicto.com",
      impressions: 29714,
      revenue: 279.42,
      ecpm: 9.4,
    },
    {
      date: date(0),
      domain: "parceitorobux.barbacoadicto.com",
      impressions: 45661,
      revenue: 552.1,
      ecpm: 12.09,
    },
    {
      date: date(0),
      domain: "plez.barbacoadicto.com",
      impressions: 27527,
      revenue: 53.54,
      ecpm: 1.94,
    },
    { date: date(0), domain: "barbacoadicto.com", impressions: 16, revenue: 0.01, ecpm: 0.42 },
    {
      date: date(0),
      domain: "mundialautos.barbacoadicto.com",
      impressions: 62,
      revenue: 0.1,
      ecpm: 1.59,
    },
    {
      date: date(1),
      domain: "elvalerobux.barbacoadicto.com",
      impressions: 28100,
      revenue: 265.8,
      ecpm: 9.46,
    },
    {
      date: date(1),
      domain: "parceitorobux.barbacoadicto.com",
      impressions: 43200,
      revenue: 520.3,
      ecpm: 12.04,
    },
    {
      date: date(1),
      domain: "plez.barbacoadicto.com",
      impressions: 25900,
      revenue: 50.1,
      ecpm: 1.93,
    },
    {
      date: date(3),
      domain: "elvalerobux.barbacoadicto.com",
      impressions: 26500,
      revenue: 248.6,
      ecpm: 9.38,
    },
    {
      date: date(3),
      domain: "parceitorobux.barbacoadicto.com",
      impressions: 41800,
      revenue: 498.7,
      ecpm: 11.93,
    },
    {
      date: date(3),
      domain: "plez.barbacoadicto.com",
      impressions: 24300,
      revenue: 47.2,
      ecpm: 1.94,
    },
  ];
}

module.exports = { buildMockReports };
