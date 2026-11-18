const { Router } = require("express");
const { requireAdmin } = require("../middleware/authenticate");
const appSettings = require("../controllers/appSettings.controller");

const router = Router();

router.get("/worker-daily-stats", appSettings.getWorkerDailyStatsVisibility);
router.put("/worker-daily-stats", requireAdmin, appSettings.updateWorkerDailyStatsVisibility);

module.exports = router;
