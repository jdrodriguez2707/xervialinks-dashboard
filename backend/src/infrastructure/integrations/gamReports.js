const axios = require("axios");
const { getAccessToken, networkUrl } = require("./gamClient");

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20; // ~60 seconds max
const RETRY_DELAYS_MS = [500, 1200, 2500];

/**
 * Fetches reports from the Google Ad Manager REST API v1.
 *
 * Correct flow per official docs:
 *   1. Create report definition (POST /reports)
 *   2. Run the report (POST /reports/{id}:run) → returns a long-running Operation
 *   3. Poll the Operation until done=true → response contains reportResult name
 *   4. Fetch rows (GET /reports/{id}/results/{resultId}:fetchRows, paginated)
 *
 * @param {{ startDate: string, endDate: string }} dateRange  ISO dates "YYYY-MM-DD"
 * @returns {Promise<Array<{ date, domain, impressions, revenue, ecpm }>>}
 */
async function fetchReports({ startDate, endDate }) {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const reportId = await step("createReport", () =>
    createReport(headers, { startDate, endDate })
  );
  const operationId = await step("runReport", () =>
    runReport(headers, reportId)
  );
  const resultId = await step("pollOperation", () =>
    pollOperation(headers, operationId)
  );
  const rows = await step("fetchRows", () =>
    fetchAllRows(headers, reportId, resultId)
  );

  return normalizeRows(rows);
}

/**
 * Wraps a GAM API call to surface the real Google error message
 * and make it clear which step failed.
 */
async function step(name, fn) {
  try {
    return await withRetry(fn);
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      // Log the full response so we can see every detail from Google
      console.error(
        `[GAM] ${name} failed — status: ${status}\n`,
        JSON.stringify(err.response.data, null, 2)
      );
      const gamError = err.response.data?.error || err.response.data;
      const message =
        gamError?.message ||
        gamError?.details?.map((d) => d.description || d.reason).join("; ") ||
        JSON.stringify(gamError);
      throw createGamHttpError(
        status,
        `GAM API error at ${name}: ${message}`
      );
    }
    if (err.statusCode) throw err;
    throw createGamHttpError(
      503,
      `GAM API error at ${name}: ${err.message || "Service unavailable"}`
    );
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function createReport(headers, { startDate, endDate }) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);

  // In the REST API the Report resource fields go directly in the body (no wrapper).
  // Dimension "TOP_PRIVATE_DOMAIN" = "Domain" column in the GAM UI.
  // Metrics "AD_SERVER_IMPRESSIONS" and "AD_SERVER_REVENUE" are HISTORICAL-compatible.
  const body = {
    displayName: `Revenue ${startDate}→${endDate}`,
      reportDefinition: {
        // IMPRESSIONS + REVENUE map to "Total impressions" and "Total revenue" in the GAM UI,
        // which include Ad Server, AdSense, Ad Exchange, and yield group partners.
        // AD_SERVER_* metrics only cover direct-sold line items (not Ad Exchange).
        // SITE dimension groups by subdomain (e.g. "elvalerobux.barbacoadicto.com"),
        // matching the "Site" column in the GAM UI — this is what we assign to workers.
        dimensions: ["DATE", "SITE"],
        metrics: ["IMPRESSIONS", "REVENUE"],
        dateRange: {
          // DateRange is a union: use "fixed" for explicit dates, "relative" for enums like YESTERDAY.
          fixed: {
            startDate: { year: sy, month: sm, day: sd },
            endDate:   { year: ey, month: em, day: ed },
          },
        },
        reportType: "HISTORICAL",
      },
  };

  const res = await axios.post(networkUrl("/reports"), body, { headers });
  // Response shape: { name: "networks/{code}/reports/{id}", reportId, reportDefinition, ... }
  return res.data.reportId || lastSegment(res.data.name);
}

async function runReport(headers, reportId) {
  // :run returns a long-running Operation, not a report status.
  // Operation name: "networks/{networkCode}/operations/reports/runs/{operationId}"
  const res = await axios.post(
    networkUrl(`/reports/${reportId}:run`),
    {},
    { headers }
  );
  return lastSegment(res.data.name); // extract operationId
}

async function pollOperation(headers, operationId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await withRetry(() =>
      axios.get(networkUrl(`/operations/reports/runs/${operationId}`), { headers })
    );

    if (res.data.done) {
      const reportResult = res.data.response?.reportResult;
      if (!reportResult) {
        throw new Error("Operation done but reportResult is missing");
      }
      // reportResult = "networks/.../reports/{reportId}/results/{resultId}"
      return lastSegment(reportResult); // extract resultId
    }

    if (res.data.error) {
      throw createGamHttpError(
        502,
        `GAM operation failed: ${
          res.data.error.message || JSON.stringify(res.data.error)
        }`
      );
    }

    await sleep(POLL_INTERVAL_MS + attempt * 200);
  }

  throw createGamHttpError(
    504,
    "Google Ad Manager tardó demasiado en responder. Intenta nuevamente en unos segundos."
  );
}

async function fetchAllRows(headers, reportId, resultId) {
  const rows = [];
  let pageToken = null;

  do {
    const url =
      networkUrl(`/reports/${reportId}/results/${resultId}:fetchRows`) +
      (pageToken ? `?pageToken=${pageToken}` : "");

    const res = await axios.get(url, { headers });
    const page = res.data;

    if (page.rows) rows.push(...page.rows);
    pageToken = page.nextPageToken || null;
  } while (pageToken);

  return rows;
}

/**
 * Maps GAM REST API v1 row format to our internal shape.
 *
 * Actual GAM response format (observed):
 *   dimensionValues: [
 *     { intValue: "20260330" },                          // DATE → YYYYMMDD as string
 *     { stringValue: "elvalerobux.barbacoadicto.com" },  // SITE → subdomain
 *   ]
 *   metricValueGroups: [{
 *     primaryValues: [
 *       { intValue: "163" },         // IMPRESSIONS
 *       { doubleValue: 0.620437 },   // REVENUE in USD (already in network currency, NOT micros)
 *     ]
 *   }]
 *
 * Second dimension is SITE (subdomain), stored as "domain" — the field name
 * used throughout the app (payouts service, worker filtering, etc).
 */
function normalizeRows(rows) {
  return rows.map((row) => {
    const dimValues     = row.dimensionValues ?? [];
    const primaryValues = row.metricValueGroups?.[0]?.primaryValues ?? [];

    const date   = parseGamDate(dimValues[0]?.intValue);
    const domain = dimValues[1]?.stringValue ?? "";

    const impressions = parseInt(primaryValues[0]?.intValue ?? "0", 10);
    const revenue = parseFloat(
      (primaryValues[1]?.doubleValue ?? 0).toFixed(6)
    );
    const ecpm = impressions > 0
      ? parseFloat(((revenue / impressions) * 1000).toFixed(4))
      : 0;

    return { date, domain, impressions, revenue, ecpm };
  });
}

/**
 * GAM returns DATE dimension as YYYYMMDD in intValue (e.g. "20260330").
 * Convert to ISO "YYYY-MM-DD" to match the rest of the app.
 */
function parseGamDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function lastSegment(resourceName) {
  return resourceName.split("/").pop();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createGamHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function backoffMs(attempt) {
  const base = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const jitter = Math.floor(Math.random() * 200);
  return base + jitter;
}

async function withRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      if (!isRetryableStatus(status) || attempt === RETRY_DELAYS_MS.length) {
        break;
      }
      await sleep(backoffMs(attempt));
    }
  }
  throw lastError;
}

module.exports = { fetchReports };
