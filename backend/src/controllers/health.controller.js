/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function getHealth(req, res) {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
