const { Router } = require("express");
const worker = require("../controllers/worker.controller");

const router = Router();

router.get("/context", worker.getContext);
router.get("/dashboard", worker.getDashboard);
router.get("/payment-history", worker.getPaymentHistory);
// router.put("/payment-info", worker.upsertPaymentInfo);

module.exports = router;
