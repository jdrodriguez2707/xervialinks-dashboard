require("express-async-errors");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");

const env = require("./infrastructure/config/env");
const { authenticate, requireAdmin } = require("./api/middleware/authenticate");
const healthRoutes = require("./api/routes/health.routes");
const internalRoutes = require("./api/routes/internal.routes");
const authRoutes = require("./api/routes/auth.routes");
const summaryRoutes = require("./api/routes/summary.routes");
const sitesRoutes = require("./api/routes/sites.routes");
const workersRoutes = require("./api/routes/workers.routes");
const payoutsRoutes = require("./api/routes/payouts.routes");
const workerRoutes = require("./api/routes/worker.routes");
const syncRoutes = require("./api/routes/sync.routes");
const gamNetworksRoutes = require("./api/routes/gamNetworks.routes");
const errorHandler = require("./api/middleware/errorHandler");

const app = express();

if (env.nodeEnv === "production") {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const corsOptions = buildCorsOptions();
app.use(cors(corsOptions));

app.use(express.json({ limit: "64kb" }));
app.use(env.nodeEnv === "production" ? morgan("combined") : morgan("dev"));

// Cron / internal (no JWT; protected by X-Cron-Secret when configured)
app.use("/api/internal", internalRoutes);

// Public routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);

// Protected routes (require valid JWT)
app.use("/api/summary", authenticate, requireAdmin, summaryRoutes);
app.use("/api/sites", authenticate, requireAdmin, sitesRoutes);
app.get("/api/workers/me", authenticate, require("./api/controllers/workers.controller").getMe);
app.use("/api/workers", authenticate, requireAdmin, workersRoutes);
app.use("/api/payouts", authenticate, payoutsRoutes);
app.use("/api/worker", authenticate, workerRoutes);
app.use("/api/sync", authenticate, syncRoutes);
app.use("/api/gam-networks", authenticate, requireAdmin, gamNetworksRoutes);

app.use(errorHandler);

module.exports = app;

function buildCorsOptions() {
  const raw = String(env.CORS_ORIGIN || "").trim();
  if (!raw) {
    if (env.nodeEnv === "production") {
      console.warn(
        "[cors] CORS_ORIGIN is empty in production — cross-origin browser requests will be rejected.",
      );
      return { origin: false, credentials: false };
    }
    return { origin: true, credentials: false };
  }
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return { origin: true, credentials: false };
  return {
    origin: list.length === 1 ? list[0] : list,
    credentials: false,
  };
}
