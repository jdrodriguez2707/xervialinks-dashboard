const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/config/database");
const { getAdminToken } = require("./helpers/auth");
const {
  applyPercentage,
  todayISO,
  daysAgoISO,
  currentMonthStartISO,
  getTodayRevenue,
  getYesterdayRevenue,
  getLast7DaysRevenue,
  getCurrentMonthRevenue,
  getWorkerDashboardPeriods,
} = require("../src/services/revenue.service");

let adminToken;

beforeAll(async () => {
  resetDb();
  adminToken = await getAdminToken();
});
afterAll(() => closeDb());

// ─── Unit tests: date helpers ─────────────────────────────────────────────────

describe("date helpers", () => {
  it("todayISO returns a valid ISO date string", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayISO()).toBe(new Date().toISOString().slice(0, 10));
  });

  it("daysAgoISO(1) returns yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(daysAgoISO(1)).toBe(yesterday.toISOString().slice(0, 10));
  });

  it("currentMonthStartISO returns the 1st of the current month", () => {
    const result = currentMonthStartISO();
    expect(result).toMatch(/^\d{4}-\d{2}-01$/);
    const today = new Date();
    expect(result.startsWith(`${today.getFullYear()}-`)).toBe(true);
  });
});

// ─── Unit tests: applyPercentage ──────────────────────────────────────────────

describe("applyPercentage", () => {
  it("calculates 70% of 1000", () => {
    expect(applyPercentage(1000, 70)).toBe(700);
  });

  it("calculates 33.5% of 500", () => {
    expect(applyPercentage(500, 33.5)).toBe(167.5);
  });

  it("returns 0 when revenue is 0", () => {
    expect(applyPercentage(0, 70)).toBe(0);
  });

  it("returns full amount at 100%", () => {
    expect(applyPercentage(250.5, 100)).toBe(250.5);
  });

  it("rounds to 2 decimal places", () => {
    expect(applyPercentage(100, 33.333)).toBe(33.33);
  });
});

// ─── Unit tests: revenue aggregation (mock data) ─────────────────────────────

describe("getTodayRevenue", () => {
  it("returns revenue and impressions for today", async () => {
    const result = await getTodayRevenue();
    expect(typeof result.revenue).toBe("number");
    expect(typeof result.impressions).toBe("number");
    expect(result.revenue).toBeGreaterThan(0);
    expect(result.impressions).toBeGreaterThan(0);
  });

  it("filters by domains when provided", async () => {
    const all = await getTodayRevenue();
    const filtered = await getTodayRevenue(["elvalerobux.barbacoadicto.com"]);
    expect(filtered.revenue).toBeLessThan(all.revenue);
  });

  it("returns 0 for an unknown domain", async () => {
    const result = await getTodayRevenue(["unknown-domain.com"]);
    expect(result.revenue).toBe(0);
    expect(result.impressions).toBe(0);
  });
});

describe("getYesterdayRevenue", () => {
  it("returns positive revenue for yesterday", async () => {
    const result = await getYesterdayRevenue();
    expect(result.revenue).toBeGreaterThan(0);
  });
});

describe("getLast7DaysRevenue", () => {
  it("covers 7 complete days ending yesterday (today excluded)", async () => {
    const [today, yesterday, week] = await Promise.all([
      getTodayRevenue(),
      getYesterdayRevenue(),
      getLast7DaysRevenue(),
    ]);
    // week = 7 complete days (yesterday + 6 prior days) — today is intentionally excluded
    // so incomplete intra-day data doesn't skew the result
    expect(week.revenue).toBeGreaterThanOrEqual(yesterday.revenue);
    expect(week.revenue).not.toBe(today.revenue);
  });
});

describe("getCurrentMonthRevenue", () => {
  it("revenue >= last 7 days revenue", async () => {
    const [month, week] = await Promise.all([
      getCurrentMonthRevenue(),
      getLast7DaysRevenue(),
    ]);
    expect(month.revenue).toBeGreaterThanOrEqual(week.revenue);
  });
});

// ─── Integration: GET /api/worker/dashboard ───────────────────────────────────

describe("GET /api/worker/dashboard", () => {
  let workerToken;

  beforeAll(async () => {
    const workerRes = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Dashboard Worker",
        email: "dashworker@example.com",
        percentage: 70,
        password: "pass123",
      });
    const workerId = workerRes.body.data.id;

    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ type: "domain", value: "elvalerobux.barbacoadicto.com" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "dashworker@example.com", password: "pass123" });

    workerToken = loginRes.body.data.token;
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/worker/dashboard");
    expect(res.status).toBe(401);
  });

  it("returns 4 periods each with revenue, ecpm and impressions", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard")
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    const { data } = res.body;

    for (const period of ["today", "yesterday", "last7Days", "currentMonth"]) {
      expect(typeof data[period].revenue).toBe("number");
      expect(typeof data[period].ecpm).toBe("number");
      expect(typeof data[period].impressions).toBe("number");
    }
  });

  it("revenue has percentage applied (today: elvalerobux 279.42 × 70% = 195.59)", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard")
      .set("Authorization", `Bearer ${workerToken}`);

    const { data } = res.body;
    // gross today = 279.42 → net 70% = 195.594 ≈ 195.59
    expect(data.today.revenue).toBeCloseTo(195.59, 1);
    expect(data.today.revenue).toBeLessThan(279.42);
  });

  it("ecpm is gross (not affected by worker percentage)", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard")
      .set("Authorization", `Bearer ${workerToken}`);

    const { data } = res.body;
    // elvalerobux today: ecpm = (279.42 / 29714) * 1000 ≈ 9.40
    expect(data.today.ecpm).toBeGreaterThan(0);
    expect(data.today.ecpm).toBeCloseTo(9.40, 0);
  });

  it("currentMonth.revenue >= last7Days.revenue", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard")
      .set("Authorization", `Bearer ${workerToken}`);

    const { data } = res.body;
    expect(data.currentMonth.revenue).toBeGreaterThanOrEqual(data.last7Days.revenue);
    expect(data.currentMonth.impressions).toBeGreaterThanOrEqual(data.last7Days.impressions);
  });
});
