const express = require("express");
const router = express.Router();
const { getSites } = require("../controllers/sites.controller");

router.get("/", getSites);

module.exports = router;
