const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/infrastructure/database/database");
const env = require("../src/infrastructure/config/env");

beforeAll(() => {
  resetDb();
});
afterAll(() => closeDb());

describe("POST /api/internal/sync-reports", () => {
  it("rejects requests without a valid cron secret", async () => {
    const res = await request(app).post("/api/internal/sync-reports");
    if (!env.CRON_SECRET || !String(env.CRON_SECRET).trim()) {
      expect(res.status).toBe(404);
    } else {
      expect(res.status).toBe(401);
    }
  });
});
