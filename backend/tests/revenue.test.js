const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/infrastructure/database/database");
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
} = require("../src/application/services/revenue.service");

let adminToken;

beforeAll(async () => {
  resetDb();
  adminToken = await getAdminToken();
});
afterAll(() => closeDb());

// ─── Unit tests: date helpers ─────────────────────────────────────────────────

describe("date helpers", () => {
  const TZ = "America/Bogota";
  const bogotaToday = new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  it("todayISO returns a valid ISO date string", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("todayISO matches the current date in America/Bogota", () => {
    expect(todayISO()).toBe(bogotaToday);
  });

  it("daysAgoISO(1) returns yesterday in America/Bogota", () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const bogotaYesterday = d.toLocaleDateString("en-CA", { timeZone: TZ });
    expect(daysAgoISO(1)).toBe(bogotaYesterday);
  });

  it("currentMonthStartISO returns the 1st of the current month in America/Bogota", () => {
    const result = currentMonthStartISO();
    expect(result).toMatch(/^\d{4}-\d{2}-01$/);
    expect(result.startsWith(bogotaToday.slice(0, 7))).toBe(true);
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
  it("includes at least today's revenue", async () => {
    const [month, today] = await Promise.all([getCurrentMonthRevenue(), getTodayRevenue()]);
    expect(month.revenue).toBeGreaterThanOrEqual(today.revenue);
  });
});

// ─── Integration: GET /api/worker/context ───────────────────────────────────

describe("GET /api/worker/context", () => {
  let workerToken;

  beforeAll(async () => {
    const workerRes = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Context Worker",
        email: "contextworker@example.com",
        percentage: 50,
        password: "pass123",
      });
    const workerId = workerRes.body.data.id;

    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ type: "domain", value: "mundialautos.barbacoadicto.com" });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "contextworker@example.com", password: "pass123" });

    workerToken = loginRes.body.data.token;
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/worker/context");
    expect(res.status).toBe(401);
  });

  it("returns properties and paymentInfo without metrics", async () => {
    const res = await request(app)
      .get("/api/worker/context")
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.properties)).toBe(true);
    expect(res.body.data).toHaveProperty("paymentInfo");
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

  it("returns 400 when requesting an unassigned domain", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard?domain=not-assigned.example.com")
      .set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(400);
  });

  it("returns zeroed metrics when currentDate is in far future", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard?currentDate=2099-05-10")
      .set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    const { data } = res.body;
    for (const period of ["today", "yesterday", "last7Days", "currentMonth"]) {
      expect(data[period].revenue).toBe(0);
      expect(data[period].impressions).toBe(0);
      expect(data[period].ecpm).toBe(0);
    }
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

  it("revenue has percentage applied (net < gross)", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard")
      .set("Authorization", `Bearer ${workerToken}`);

    const { data } = res.body;
    // The mock always has data for "today" in America/Bogota.
    // Net revenue (70%) must be less than gross (279.42) and positive.
    expect(data.today.revenue).toBeGreaterThan(0);
    expect(data.today.revenue).toBeLessThan(279.42);
    // 70% of 279.42 = 195.594; allow ±1 for floating-point/rounding
    expect(data.today.revenue).toBeCloseTo(195.59, 0);
  });

  it("ecpm is gross (not affected by worker percentage)", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard")
      .set("Authorization", `Bearer ${workerToken}`);

    const { data } = res.body;
    // elvalerobux today: ecpm = (279.42 / 29714) * 1000 ≈ 9.40
    expect(data.today.ecpm).toBeGreaterThan(0);
    expect(data.today.ecpm).toBeCloseTo(9.4, 0);
  });

  it("currentMonth includes at least today's data", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard")
      .set("Authorization", `Bearer ${workerToken}`);

    const { data } = res.body;
    expect(data.currentMonth.revenue).toBeGreaterThanOrEqual(data.today.revenue);
    expect(data.currentMonth.impressions).toBeGreaterThanOrEqual(data.today.impressions);
  });
});

describe("GET /api/worker/payment-history", () => {
  let workerToken;
  let paymentHistoryWorkerId;

  beforeAll(async () => {
    const workerRes = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Payment History Worker",
        email: "payment.history.worker@example.com",
        percentage: 60,
        password: "pass123",
      });
    const workerId = workerRes.body.data.id;
    paymentHistoryWorkerId = workerId;

    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ type: "domain", value: "plez.barbacoadicto.com" });

    const paymentMonth = todayISO("America/Bogota").slice(0, 7);
    await request(app)
      .patch(`/api/workers/${workerId}/payment-status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Client-Timezone", "America/Bogota")
      .send({ status: "paid", paymentMonth });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "payment.history.worker@example.com", password: "pass123" });
    workerToken = loginRes.body.data.token;
  });

  it("returns monthly rows per assigned domain with payment status", async () => {
    const paymentMonth = todayISO("America/Bogota").slice(0, 7);
    const res = await request(app)
      .get(`/api/worker/payment-history?paymentMonth=${paymentMonth}`)
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.period).toBe(paymentMonth);
    expect(Array.isArray(res.body.data.rows)).toBe(true);
    expect(res.body.data.rows.length).toBeGreaterThan(0);
    expect(res.body.data.rows[0]).toHaveProperty("domain");
    expect(res.body.data.rows[0]).toHaveProperty("impressions");
    expect(res.body.data.rows[0]).toHaveProperty("payout");
    expect(res.body.data.rows[0]).toHaveProperty("paymentStatus");
  });

  it("mantiene montos del periodo tras paid → pending → cambio de porcentaje", async () => {
    const paymentMonth = todayISO("America/Bogota").slice(0, 7);
    const histBefore = await request(app)
      .get(`/api/worker/payment-history?paymentMonth=${paymentMonth}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .set("X-Client-Timezone", "America/Bogota");
    expect(histBefore.status).toBe(200);
    const totalBefore =
      histBefore.body.data.totalPayout != null
        ? Number(histBefore.body.data.totalPayout)
        : histBefore.body.data.rows.reduce((s, r) => s + Number(r.payout || 0), 0);
    expect(histBefore.body.data.paymentStatus).toBe("paid");

    await request(app)
      .patch(`/api/workers/${paymentHistoryWorkerId}/payment-status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Client-Timezone", "America/Bogota")
      .send({ status: "pending", paymentMonth });

    await request(app)
      .patch(`/api/workers/${paymentHistoryWorkerId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Payment History Worker",
        email: "payment.history.worker@example.com",
        percentage: 5,
        domains: ["plez.barbacoadicto.com"],
      });

    // Evitar misma marca temporal que session_invalidated_at (JWT iat en segundos).
    await new Promise((r) => setTimeout(r, 1100));

    const loginAgain = await request(app)
      .post("/api/auth/login")
      .send({ email: "payment.history.worker@example.com", password: "pass123" });
    expect(loginAgain.status).toBe(200);
    const freshWorkerToken = loginAgain.body.data.token;

    const histAfter = await request(app)
      .get(`/api/worker/payment-history?paymentMonth=${paymentMonth}`)
      .set("Authorization", `Bearer ${freshWorkerToken}`)
      .set("X-Client-Timezone", "America/Bogota");

    expect(histAfter.status).toBe(200);
    expect(histAfter.body.data.paymentStatus).toBe("pending");
    const totalAfter =
      histAfter.body.data.totalPayout != null
        ? Number(histAfter.body.data.totalPayout)
        : histAfter.body.data.rows.reduce((s, r) => s + Number(r.payout || 0), 0);
    expect(totalAfter).toBeCloseTo(totalBefore, 2);
  });
});
