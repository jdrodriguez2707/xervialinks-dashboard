const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/config/database");
const { getAdminToken, ADMIN_EMAIL, ADMIN_PASSWORD } = require("./helpers/auth");

let adminToken;

beforeAll(async () => {
  resetDb();
  adminToken = await getAdminToken();
});
afterAll(() => closeDb());

describe("POST /api/auth/login", () => {
  it("returns token and user on valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe("admin");
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ADMIN_EMAIL, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("returns 401 on unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ADMIN_EMAIL });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/register", () => {
  it("admin can create a worker account", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Worker One", email: "worker1@example.com", password: "pass123", role: "worker" });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe("worker");
    expect(res.body.data.email).toBe("worker1@example.com");
  });

  it("returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "X", email: "x@example.com", password: "pass123" });
    expect(res.status).toBe(401);
  });

  it("returns 409 on duplicate email", async () => {
    await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Dup", email: "dup@example.com", password: "pass123" });

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Dup2", email: "dup@example.com", password: "pass123" });
    expect(res.status).toBe(409);
  });
});

describe("GET /api/auth/me", () => {
  it("returns current user info", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(ADMIN_EMAIL);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
