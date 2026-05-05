const { Router } = require("express");
const sync = require("../controllers/sync.controller");

const router = Router();

router.get("/status", sync.getSyncStatus);

module.exports = router;
