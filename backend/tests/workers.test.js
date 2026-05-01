const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/infrastructure/database/database");
const { getAdminToken } = require("./helpers/auth");

let token;

beforeAll(async () => {
  resetDb();
  token = await getAdminToken();
});
afterAll(() => closeDb());

describe("POST /api/workers", () => {
  it("creates a worker and returns 201", async () => {
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Alice", email: "alice@example.com", percentage: 70 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Alice",
      email: "alice@example.com",
      percentage: 70,
      properties: [],
    });
    expect(res.body.data.id).toBeDefined();
  });

  it("returns 401 without token", async () => {
    const res = await request(app)
      .post("/api/workers")
      .send({ name: "X", email: "x@example.com", percentage: 10 });
    expect(res.status).toBe(401);
  });

  it("returns 409 when email is duplicated", async () => {
    await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bob", email: "bob@example.com", percentage: 50 });
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bob2", email: "bob@example.com", percentage: 30 });
    expect(res.status).toBe(409);
  });

  it("returns 400 when percentage is invalid", async () => {
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Charlie", email: "charlie@example.com", percentage: 0 });
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Dan" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/workers", () => {
  it("returns list with at least the previously created workers", async () => {
    const res = await request(app)
      .get("/api/workers")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/workers/:id", () => {
  let workerId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Eve", email: "eve@example.com", percentage: 60 });
    workerId = res.body.data.id;
  });

  it("returns the worker by id", async () => {
    const res = await request(app)
      .get(`/api/workers/${workerId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("eve@example.com");
  });

  it("returns 404 for non-existing id", async () => {
    const res = await request(app)
      .get("/api/workers/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/workers/:id/properties", () => {
  let workerId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Frank", email: "frank@example.com", percentage: 40 });
    workerId = res.body.data.id;
  });

  it("assigns a domain property to a worker", async () => {
    const res = await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "sports.example.com" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      worker_id: workerId,
      type: "domain",
      value: "sports.example.com",
    });
  });

  it("returns 409 on duplicate property", async () => {
    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "news.example.com" });
    const res = await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "news.example.com" });
    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid type", async () => {
    const res = await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "invalid_type", value: "something.com" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when worker does not exist", async () => {
    const res = await request(app)
      .post("/api/workers/99999/properties")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "test.com" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when assigning an apex/root domain", async () => {
    const res = await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "barbacoadicto.com" });
    expect(res.status).toBe(400);
  });

  it("returns 409 when domain is already assigned to another worker", async () => {
    const workerRes = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "George", email: "george@example.com", percentage: 35 });
    const secondWorkerId = workerRes.body.data.id;

    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "exclusive.example.com" });

    const res = await request(app)
      .post(`/api/workers/${secondWorkerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "exclusive.example.com" });

    expect(res.status).toBe(409);
  });
});
