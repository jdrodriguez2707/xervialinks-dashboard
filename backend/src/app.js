require("express-async-errors");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const healthRoutes = require("./routes/health.routes");
const reportsRoutes = require("./routes/reports.routes");
const workersRoutes = require("./routes/workers.routes");
const payoutsRoutes = require("./routes/payouts.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/health", healthRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/workers", workersRoutes);
app.use("/api/payouts", payoutsRoutes);

app.use(errorHandler);

module.exports = app;
