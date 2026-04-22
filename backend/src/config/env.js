require("dotenv").config();

const env = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || "development",

  // Google Ad Manager integration
  USE_REAL_GAM_API: process.env.USE_REAL_GAM_API === "true",
  GAM_NETWORK_CODE: process.env.GAM_NETWORK_CODE || "",
  // Provide one of the two credential options:
  GAM_CREDENTIALS_JSON: process.env.GAM_CREDENTIALS_JSON || "",
  GAM_KEY_FILE: process.env.GAM_KEY_FILE || "",
};

module.exports = env;
