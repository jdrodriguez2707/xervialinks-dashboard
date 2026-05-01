const { Router } = require("express");
const workers = require("../controllers/workers.controller");

const router = Router();

router.get("/", workers.listWorkers);
router.post("/", workers.createWorker);
router.get("/:id", workers.getWorker);
router.delete("/:id", workers.deleteWorker);
router.post("/:id/properties", workers.addProperty);
router.patch("/:id/payment-status", workers.updatePaymentStatus);

module.exports = router;
