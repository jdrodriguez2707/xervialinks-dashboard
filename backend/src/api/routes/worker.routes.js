const { Router } = require("express");
const worker = require("../controllers/worker.controller");

const router = Router();

router.get("/dashboard", worker.getDashboard);
router.put("/payment-info", worker.upsertPaymentInfo);

module.exports = router;
