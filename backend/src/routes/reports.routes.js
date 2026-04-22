const { Router } = require("express");
const { getReports } = require("../controllers/reports.controller");

const router = Router();

router.get("/", getReports);

module.exports = router;
