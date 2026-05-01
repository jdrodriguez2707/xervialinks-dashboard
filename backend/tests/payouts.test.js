const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/infrastructure/database/database");
const { getAdminToken, ADMIN_EMAIL } = require("./helpers/auth");
const {
  computePayout,
  getAssignedDomains,
  sumRevenue,
} = require("../src/application/services/payouts.service");
const {
  todayISO,
  daysAgoISO,
} = require("../src/application/services/clientTimezone");

let token;

beforeAll(async () => {
  resetDb();
  token = await getAdminToken();
});
afterAll(() => closeDb());

// ─── Unit tests: pure calculation helpers ────────────────────────────────────

describe("computePayout", () => {
  it("calculates 70% of 1000 correctly", () => {
    expect(computePayout(1000, 70)).toBe(700);
  });

  it("calculates 33.5% of 500 correctly", () => {
    expect(computePayout(500, 33.5)).toBe(167.5);
  });

  it("returns 0 when revenue is 0", () => {
    expect(computePayout(0, 70)).toBe(0);
  });

  it("returns full revenue at 100%", () => {
    expect(computePayout(250.5, 100)).toBe(250.5);
  });

  it("rounds to 6 decimal places", () => {
    expect(computePayout(100, 33.333)).toBe(33.333);
  });
});

describe("getAssignedDomains", () => {
  it("returns values for domain-type properties only", () => {
    const properties = [
      { type: "domain", value: "elvalerobux.barbacoadicto.com" },
      { type: "other",  value: "ignored" },
      { type: "domain", value: "parceitorobux.barbacoadicto.com" },
    ];
    expect(getAssignedDomains(properties)).toEqual([
      "elvalerobux.barbacoadicto.com",
      "parceitorobux.barbacoadicto.com",
    ]);
  });

  it("returns empty array when no domain-type properties exist", () => {
    expect(getAssignedDomains([{ type: "other", value: "foo" }])).toEqual([]);
  });

  it("returns empty array for empty properties", () => {
    expect(getAssignedDomains([])).toEqual([]);
  });
});

describe("sumRevenue", () => {
  it("sums revenues correctly", () => {
    const reports = [
      { revenue: 100.5, impressions: 1000 },
      { revenue: 200.25, impressions: 2000 },
    ];
    expect(sumRevenue(reports)).toBe(300.75);
  });

  it("returns 0 for empty array", () => {
    expect(sumRevenue([])).toBe(0);
  });
});

// ─── Integration tests: GET /api/payouts ─────────────────────────────────────

describe("GET /api/payouts", () => {
  let workerId;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Grace", email: "grace@example.com", percentage: 70 });
    workerId = res.body.data.id;

    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "elvalerobux.barbacoadicto.com" });
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/payouts");
    expect(res.status).toBe(401);
  });

  it("returns payouts for all workers (admin)", async () => {
    const res = await request(app)
      .get("/api/payouts")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("payouts");
    expect(res.body.data).toHaveProperty("totalPayout");
    expect(Array.isArray(res.body.data.payouts)).toBe(true);
  });

  it("calculates the correct payout for a worker with a domain property", async () => {
    const startDate = daysAgoISO(7, "America/Bogota");
    const endDate = todayISO("America/Bogota");
    const res = await request(app)
      .get(`/api/payouts?startDate=${startDate}&endDate=${endDate}`)
      .set("Authorization", `Bearer ${token}`);
    const grace = res.body.data.payouts.find((w) => w.workerId === workerId);

    expect(grace).toBeDefined();
    expect(grace.assignedDomains).toContain("elvalerobux.barbacoadicto.com");
    // mock: elvalerobux today + yesterday + 3-days-ago = 279.42 + 265.80 + 248.60 = 793.82
    expect(grace.assignedRevenue).toBe(793.82);
    expect(grace.payout).toBe(555.674);
  });

  it("returns 0 payout for a worker with no assigned properties", async () => {
    const workerRes = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Unassigned", email: "unassigned@example.com", percentage: 50 });
    const unassignedId = workerRes.body.data.id;

    const res = await request(app)
      .get("/api/payouts")
      .set("Authorization", `Bearer ${token}`);
    const unassigned = res.body.data.payouts.find((w) => w.workerId === unassignedId);

    expect(unassigned.assignedRevenue).toBe(0);
    expect(unassigned.payout).toBe(0);
  });

  it("respects date filters (today only)", async () => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const res = await request(app)
      .get(`/api/payouts?startDate=${today}&endDate=${today}`)
      .set("Authorization", `Bearer ${token}`);
    const grace = res.body.data.payouts.find((w) => w.workerId === workerId);
    // mock: elvalerobux today only = 279.42, 70% = 195.594
    expect(grace.assignedRevenue).toBe(279.42);
    expect(grace.payout).toBe(195.594);
  });

  it("keeps deleted worker in historical ranges but not in future-only range", async () => {
    const res = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Deleted Hist", email: "deletedhist@example.com", percentage: 60 });
    const deletedWorkerId = res.body.data.id;

    await request(app)
      .post(`/api/workers/${deletedWorkerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "plez.barbacoadicto.com" });

    await request(app)
      .delete(`/api/workers/${deletedWorkerId}`)
      .set("Authorization", `Bearer ${token}`);

    const histStart = daysAgoISO(7, "America/Bogota");
    const histEnd = todayISO("America/Bogota");
    const hist = await request(app)
      .get(`/api/payouts?startDate=${histStart}&endDate=${histEnd}`)
      .set("Authorization", `Bearer ${token}`);
    const stillShown = hist.body.data.payouts.find((w) => w.workerId === deletedWorkerId);
    expect(stillShown).toBeDefined();
    expect(stillShown.deletedAt).toBeTruthy();

    const future = await request(app)
      .get("/api/payouts?startDate=9999-12-30&endDate=9999-12-31")
      .set("Authorization", `Bearer ${token}`);
    const hidden = future.body.data.payouts.find((w) => w.workerId === deletedWorkerId);
    expect(hidden).toBeUndefined();
  });
});
