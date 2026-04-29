require("express-async-errors");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { authenticate, requireAdmin } = require("./api/middleware/authenticate");
const healthRoutes = require("./api/routes/health.routes");
const authRoutes = require("./api/routes/auth.routes");
const summaryRoutes = require("./api/routes/summary.routes");
const sitesRoutes   = require("./api/routes/sites.routes");
const workersRoutes = require("./api/routes/workers.routes");
const payoutsRoutes = require("./api/routes/payouts.routes");
const workerRoutes = require("./api/routes/worker.routes");
const errorHandler = require("./api/middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Public routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);

// Protected routes (require valid JWT)
app.use("/api/summary", authenticate, requireAdmin, summaryRoutes);
app.use("/api/sites",   authenticate, requireAdmin, sitesRoutes);
app.get("/api/workers/me", authenticate, require("./api/controllers/workers.controller").getMe);
app.use("/api/workers", authenticate, requireAdmin, workersRoutes);
app.use("/api/payouts", authenticate, payoutsRoutes);
app.use("/api/worker", authenticate, workerRoutes);

app.use(errorHandler);

module.exports = app;
