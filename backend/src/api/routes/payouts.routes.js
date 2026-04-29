const { Router } = require("express");
const payouts = require("../controllers/payouts.controller");

const router = Router();

router.get("/", payouts.getPayouts);

module.exports = router;
