const { Router } = require("express");
const workers = require("../controllers/workers.controller");

const router = Router();

router.get("/", workers.listWorkers);
router.post("/", workers.createWorker);
router.get("/:id", workers.getWorker);
router.patch("/:id", workers.updateWorker);
router.delete("/:id", workers.deleteWorker);
router.delete("/:id/purge-inactive", workers.purgeInactiveWorker);
router.post("/:id/properties", workers.addProperty);

module.exports = router;
