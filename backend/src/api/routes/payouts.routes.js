const { Router } = require("express");
const payouts = require("../controllers/payouts.controller");
const { requireAdmin } = require("../middleware/authenticate");

const router = Router();

router.get("/", payouts.getPayouts);
router.get("/history", payouts.getPaymentHistory);
router.put("/worker-net-revenue-override", requireAdmin, payouts.putWorkerNetRevenueOverride);
router.put("/worker-domain-net-revenue-override", requireAdmin, payouts.putWorkerDomainNetRevenueOverride);
router.delete("/worker-domain-net-revenue-override", requireAdmin, payouts.deleteWorkerDomainNetRevenueOverride);

module.exports = router;
