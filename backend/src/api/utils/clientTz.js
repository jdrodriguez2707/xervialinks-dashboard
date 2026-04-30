const { resolveClientTimeZone } = require("../../application/services/clientTimezone");

/** Express: reads X-Client-Timezone header (IANA). */
function clientTimeZoneFromRequest(req) {
  return resolveClientTimeZone(req.headers["x-client-timezone"]);
}

module.exports = { clientTimeZoneFromRequest };
