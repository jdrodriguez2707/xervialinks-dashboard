const axios = require("axios");
const { getAccessToken, networkUrl } = require("./gamClient");

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20; // ~60 seconds max

/**
 * Fetches reports from the Google Ad Manager REST API v1.
 *
 * Flow: create report definition → run job → poll until done → download results.
 *
 * @param {{ startDate: string, endDate: string }} dateRange  ISO dates "YYYY-MM-DD"
 * @returns {Promise<Array<{ date, domain, impressions, revenue, ecpm }>>}
 */
async function fetchReports({ startDate, endDate }) {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const reportName = await createReport(headers, { startDate, endDate });
  await runReport(headers, reportName);
  await pollUntilDone(headers, reportName);
  const rawRows = await downloadResults(headers, reportName);

  return normalizeRows(rawRows);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function createReport(headers, { startDate, endDate }) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);

  const body = {
    displayName: `Revenue ${startDate}→${endDate}`,
    definition: {
      dimensions: ["DATE", "DOMAIN"],
      metrics: [
        "TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS",
        "TOTAL_LINE_ITEM_LEVEL_ALL_REVENUE",
      ],
      dateRange: {
        startDate: { year: sy, month: sm, day: sd },
        endDate: { year: ey, month: em, day: ed },
      },
    },
  };

  const res = await axios.post(networkUrl("/reports"), body, { headers });
  // GAM returns the full resource name, e.g. "networks/123/reports/456"
  return res.data.name;
}

async function runReport(headers, reportName) {
  const reportId = lastSegment(reportName);
  await axios.post(networkUrl(`/reports/${reportId}:run`), {}, { headers });
}

async function pollUntilDone(headers, reportName) {
  const reportId = lastSegment(reportName);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await axios.get(networkUrl(`/reports/${reportId}`), {
      headers,
    });
    const status = res.data?.reportJob?.reportJobStatus;

    if (status === "COMPLETED") return;
    if (status === "FAILED") {
      throw new Error("Google Ad Manager report job failed");
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error("Google Ad Manager report timed out");
}

async function downloadResults(headers, reportName) {
  const reportId = lastSegment(reportName);
  const res = await axios.get(networkUrl(`/reports/${reportId}/results`), {
    headers,
  });
  return res.data?.rows || [];
}

/**
 * Converts GAM raw rows into the same shape our mock data uses.
 *
 * GAM returns revenue in micros (millionths of a currency unit).
 * ecpm is calculated from totals, not averaged from individual rows.
 *
 * @param {Array<{ dimensionValues: string[], metricValues: string[] }>} rows
 */
function normalizeRows(rows) {
  return rows.map((row) => {
    const [dateStr, domain] = row.dimensionValues;
    const impressions = parseInt(row.metricValues[0], 10);
    const revenueInMicros = parseInt(row.metricValues[1], 10);

    const revenue = parseFloat((revenueInMicros / 1_000_000).toFixed(6));
    const ecpm =
      impressions > 0
        ? parseFloat(((revenue / impressions) * 1000).toFixed(4))
        : 0;

    return { date: dateStr, domain, impressions, revenue, ecpm };
  });
}

function lastSegment(resourceName) {
  return resourceName.split("/").pop();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchReports };
