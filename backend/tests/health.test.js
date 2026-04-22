const request = require("supertest");
const app = require("../src/app");

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("includes uptime and timestamp", async () => {
    const res = await request(app).get("/api/health");

    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });
});
