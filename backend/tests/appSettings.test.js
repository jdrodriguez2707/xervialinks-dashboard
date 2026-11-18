const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/infrastructure/database/database");
const { getAdminToken } = require("./helpers/auth");

let adminToken;
let workerToken;

beforeAll(async () => {
  resetDb();
  adminToken = await getAdminToken();
  const workerCreated = await request(app)
    .post("/api/workers")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Settings Worker",
      email: "settings-worker@example.com",
      percentage: 50,
      password: "pass123",
    });
  expect(workerCreated.status).toBe(201);
  const workerLogin = await request(app)
    .post("/api/auth/login")
    .send({ email: "settings-worker@example.com", password: "pass123" });
  expect(workerLogin.status).toBe(200);
  workerToken = workerLogin.body.data.token;
});

afterAll(() => closeDb());

describe("worker daily stats visibility setting", () => {
  it("defaults to disabled and requires authentication to read", async () => {
    const unauthenticated = await request(app).get("/api/settings/worker-daily-stats");
    const response = await request(app)
      .get("/api/settings/worker-daily-stats")
      .set("Authorization", `Bearer ${workerToken}`);
    const workerContext = await request(app)
      .get("/api/worker/context")
      .set("Authorization", `Bearer ${workerToken}`);

    expect(unauthenticated.status).toBe(401);
    expect(response.status).toBe(200);
    expect(response.body.data.enabled).toBe(false);
    expect(workerContext.body.data.dailyStatsEnabled).toBe(false);
  });

  it("allows only admins to update the setting and validates the value", async () => {
    const forbidden = await request(app)
      .put("/api/settings/worker-daily-stats")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ enabled: false });
    const invalid = await request(app)
      .put("/api/settings/worker-daily-stats")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ enabled: "false" });
    const updated = await request(app)
      .put("/api/settings/worker-daily-stats")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ enabled: false });
    const workerRead = await request(app)
      .get("/api/settings/worker-daily-stats")
      .set("Authorization", `Bearer ${workerToken}`);
    const workerContext = await request(app)
      .get("/api/worker/context")
      .set("Authorization", `Bearer ${workerToken}`);

    expect(forbidden.status).toBe(403);
    expect(invalid.status).toBe(400);
    expect(updated.status).toBe(200);
    expect(updated.body.data.enabled).toBe(false);
    expect(workerRead.body.data.enabled).toBe(false);
    expect(workerContext.body.data.dailyStatsEnabled).toBe(false);
  });
});
