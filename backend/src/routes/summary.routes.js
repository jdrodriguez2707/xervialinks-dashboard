const express = require("express");
const router = express.Router();
const { getSummary } = require("../controllers/summary.controller");

router.get("/", getSummary);

module.exports = router;
