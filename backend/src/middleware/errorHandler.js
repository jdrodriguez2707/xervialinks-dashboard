const env = require("../config/env");

/**
 * Centralized error handler — attached as the last middleware in app.js.
 * Express identifies it as an error handler by the 4-argument signature (err, req, res, next).
 *
 * @param {Error} err
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  const body = { error: message };

  if (env.nodeEnv === "development") {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
