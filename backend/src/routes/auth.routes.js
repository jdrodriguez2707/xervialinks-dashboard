const { Router } = require("express");
const auth = require("../controllers/auth.controller");
const { authenticate, requireAdmin } = require("../middleware/authenticate");

const router = Router();

router.post("/login", auth.login);
router.post("/register", authenticate, requireAdmin, auth.register);
router.get("/me", authenticate, auth.me);

module.exports = router;
