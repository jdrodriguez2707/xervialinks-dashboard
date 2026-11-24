/**
 * Domain slots assigned to a worker: each subdomain paired with its Ad Manager network.
 * @param {Array<{ type: string, value: string, gamNetworkCode?: string, gam_network_code?: string }>} properties
 * @returns {Array<{ value: string, gamNetworkCode: string }>}
 */
function getAssignedDomainSlots(properties) {
  return (properties || [])
    .filter((p) => p.type === "domain")
    .map((p) => ({
      value: String(p.value || "").trim(),
      gamNetworkCode: String(p.gamNetworkCode || p.gam_network_code || "").trim(),
    }))
    .filter((s) => s.value && s.gamNetworkCode);
}

module.exports = { getAssignedDomainSlots };
