require("dotenv").config();

const env = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || "development",

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "change-this-secret-in-production",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",

  // Google Ad Manager integration — always false in test env to use mock data
  USE_REAL_GAM_API: process.env.NODE_ENV !== "test" && process.env.USE_REAL_GAM_API === "true",
  GAM_NETWORK_CODE: process.env.GAM_NETWORK_CODE || "",
  GAM_CREDENTIALS_JSON: process.env.GAM_CREDENTIALS_JSON || "",
  GAM_KEY_FILE: process.env.GAM_KEY_FILE || "",
};

module.exports = env;
