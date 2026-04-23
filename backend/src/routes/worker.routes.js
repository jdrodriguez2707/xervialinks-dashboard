const { Router } = require("express");
const worker = require("../controllers/worker.controller");

const router = Router();

router.get("/dashboard", worker.getDashboard);

module.exports = router;
