const request = require("supertest");
const app = require("../../src/app");

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123";

async function getAdminToken() {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res.body.data.token;
}

module.exports = { getAdminToken, ADMIN_EMAIL, ADMIN_PASSWORD };
