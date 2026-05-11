const { Router } = require("express");
const { requireCronSecret } = require("../middleware/cronSecret");
const internal = require("../controllers/internal.controller");

const router = Router();

router.post("/sync-reports", requireCronSecret, internal.postCronSyncReports);

module.exports = router;
