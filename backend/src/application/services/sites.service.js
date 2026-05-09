const reportsRepository = require("../../domain/repositories/reports.repository");

/**
 * Returns the sorted list of unique site domains seen in reports from the
 * last 30 days. Works with both mock data and the real GAM API.
 *
 * Only assignable subdomains are returned (e.g. foo.example.com).
 * Apex/root domains (e.g. example.com) are excluded by design.
 *
 * @param {string} timeZone
 * @param {{ networkCode?: string }} [opts]
 */
async function getSites(timeZone, opts = {}) {
  const reports = await reportsRepository.findAll({
    timeZone,
    networkCode: opts.networkCode,
  });
  const unique = [
    ...new Set(reports.map((r) => r.domain).filter((domain) => isAssignableSubdomain(domain))),
  ].sort();
  return unique;
}

function isAssignableSubdomain(domain) {
  if (!domain || typeof domain !== "string") return false;
  const normalized = domain.trim().toLowerCase();
  if (!normalized || normalized.includes("..")) return false;
  const labels = normalized.split(".").filter(Boolean);
  // Require at least one subdomain level before the apex domain.
  return labels.length >= 3;
}

module.exports = { getSites, isAssignableSubdomain };
