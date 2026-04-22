const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/config/database");
const { getAdminToken, ADMIN_EMAIL } = require("./helpers/auth");
const {
  computePayout,
  getAssignedDomains,
  sumRevenue,
} = require("../src/services/payouts.service");

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
  it("returns only domain-type properties", () => {
    const properties = [
      { type: "domain", value: "sports.example.com" },
      { type: "ad_unit", value: "/12345/homepage" },
      { type: "domain", value: "tech.example.com" },
    ];
    expect(getAssignedDomains(properties)).toEqual([
      "sports.example.com",
      "tech.example.com",
    ]);
  });

  it("returns empty array when no domain properties", () => {
    expect(getAssignedDomains([{ type: "ad_unit", value: "/unit/1" }])).toEqual([]);
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
      .send({ type: "domain", value: "sports.example.com" });
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
    const res = await request(app)
      .get("/api/payouts")
      .set("Authorization", `Bearer ${token}`);
    const grace = res.body.data.payouts.find((w) => w.workerId === workerId);

    expect(grace).toBeDefined();
    expect(grace.assignedDomains).toContain("sports.example.com");
    // sports.example.com: 210.45 + 234.00 + 187.00 = 631.45 → payout = 631.45 * 70/100
    expect(grace.assignedRevenue).toBe(631.45);
    expect(grace.payout).toBe(442.015);
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

  it("respects date filters", async () => {
    const res = await request(app)
      .get("/api/payouts?startDate=2024-04-01&endDate=2024-04-01")
      .set("Authorization", `Bearer ${token}`);
    const grace = res.body.data.payouts.find((w) => w.workerId === workerId);
    expect(grace.assignedRevenue).toBe(210.45);
    expect(grace.payout).toBe(147.315);
  });
});
