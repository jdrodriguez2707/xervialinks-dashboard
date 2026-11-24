const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/infrastructure/database/database");
const { getAdminToken } = require("./helpers/auth");
const {
  todayISO,
  daysAgoISO,
  currentMonthStartISO,
  getTodayRevenue,
  getYesterdayRevenue,
  getLast7DaysRevenue,
  getCurrentMonthRevenue,
  calculateChangePercent,
  getWorkerDashboardPeriods,
  getWorkerDailyStats,
} = require("../src/application/services/revenue.service");
const reportsRepo = require("../src/domain/repositories/reports.repository");

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

describe("calculateChangePercent", () => {
  it("calculates positive and negative changes to one decimal place", () => {
    expect(calculateChangePercent(125, 100)).toBe(25);
    expect(calculateChangePercent(80, 100)).toBe(-20);
  });

  it("returns null for equal values and a zero comparison baseline", () => {
    expect(calculateChangePercent(100, 100)).toBeNull();
    expect(calculateChangePercent(100, 0)).toBeNull();
  });

  it("returns null when the change rounds to zero", () => {
    expect(calculateChangePercent(100.04, 100)).toBeNull();
  });
});

describe("getWorkerDailyStats", () => {
  it("returns every complete day from month start through yesterday", () => {
    const reports = [
      { date: "2026-11-01", revenue: 5, impressions: 500 },
      { date: "2026-11-13", revenue: 10, impressions: 1000 },
      { date: "2026-11-14", revenue: 20, impressions: 2000 },
      { date: "2026-11-15", revenue: 30, impressions: 3000 },
      { date: "2026-11-16", revenue: 40, impressions: 4000 },
      { date: "2026-11-17", revenue: 50, impressions: 5000 },
      { date: "2026-11-18", revenue: 999, impressions: 99999 },
    ];

    const result = getWorkerDailyStats(
      reports,
      "America/Bogota",
      "2026-11-18",
    );

    expect(result).toHaveLength(17);
    expect(result[0].date).toBe("2026-11-01");
    expect(result[16].date).toBe("2026-11-17");
    expect(result[16].revenue).toBe(50);
    expect(result[16].impressions).toBe(5000);
    expect(result[16].ecpm).toBe(10);
  });
});

describe("getWorkerDashboardPeriods comparisons", () => {
  it("compares yesterday, previous 7 days, and equivalent month-to-date metrics", async () => {
    const reports = [];
    for (
      let date = new Date("2026-02-01T00:00:00.000Z");
      date <= new Date("2026-03-10T00:00:00.000Z");
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      const dateISO = date.toISOString().slice(0, 10);
      let revenue = dateISO.startsWith("2026-02-") ? 10 : 20;
      if (dateISO === "2026-03-02") revenue = 40;
      if (dateISO === "2026-03-08") revenue = 40;
      reports.push({
        date: dateISO,
        domain: "worker.example.com",
        networkCode: "network-1",
        revenue,
        impressions: revenue * 10,
      });
    }
    reports.push(
      {
        date: "2026-03-09",
        domain: "other.example.com",
        networkCode: "network-1",
        revenue: 10000,
        impressions: 100000,
      },
      {
        date: "2026-03-09",
        domain: "worker.example.com",
        networkCode: "another-network",
        revenue: 10000,
        impressions: 100000,
      },
    );

    const findAllSpy = jest.spyOn(reportsRepo, "findAll").mockResolvedValue(reports);
    try {
      const result = await getWorkerDashboardPeriods(
        {
          properties: [
            {
              type: "domain",
              value: "worker.example.com",
              gamNetworkCode: "network-1",
            },
          ],
        },
        "America/Bogota",
        { referenceDate: "2026-03-10" },
      );

      expect(findAllSpy).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: "2026-02-01", endDate: "2026-03-10" }),
      );
      expect(result.today).not.toHaveProperty("comparison");
      expect(result.yesterday.comparison).toEqual({
        revenue: -50,
        impressions: -50,
      });
      expect(result.last7Days.comparison).toEqual({
        revenue: 45.5,
        impressions: 45.5,
      });
      expect(result.currentMonth.comparison).toEqual({
        revenue: 144.4,
        impressions: 144.4,
      });
    } finally {
      findAllSpy.mockRestore();
    }
  });

  it("clamps the comparable month end when the previous month is shorter", async () => {
    const reports = [
      {
        date: "2026-02-28",
        domain: "worker.example.com",
        networkCode: "network-1",
        revenue: 10,
        impressions: 100,
      },
      {
        date: "2026-03-30",
        domain: "worker.example.com",
        networkCode: "network-1",
        revenue: 30,
        impressions: 300,
      },
      {
        date: "2026-03-31",
        domain: "worker.example.com",
        networkCode: "network-1",
        revenue: 50,
        impressions: 500,
      },
    ];
    const findAllSpy = jest.spyOn(reportsRepo, "findAll").mockResolvedValue(reports);
    try {
      const result = await getWorkerDashboardPeriods(
        {
          properties: [
            {
              type: "domain",
              value: "worker.example.com",
              gamNetworkCode: "network-1",
            },
          ],
        },
        "America/Bogota",
        { referenceDate: "2026-03-31" },
      );

      expect(result.currentMonth.comparison).toEqual({
        revenue: 200,
        impressions: 200,
      });
      expect(result.currentMonth.revenue).toBe(80);
      expect(findAllSpy).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: "2026-02-01", endDate: "2026-03-31" }),
      );
    } finally {
      findAllSpy.mockRestore();
    }
  });

  it("shows no monthly comparison on the first day before any full current-month day exists", async () => {
    const reports = [
      {
        date: "2026-02-01",
        domain: "worker.example.com",
        networkCode: "network-1",
        revenue: 10,
        impressions: 100,
      },
      {
        date: "2026-03-01",
        domain: "worker.example.com",
        networkCode: "network-1",
        revenue: 50,
        impressions: 500,
      },
    ];
    const findAllSpy = jest.spyOn(reportsRepo, "findAll").mockResolvedValue(reports);
    try {
      const result = await getWorkerDashboardPeriods(
        {
          properties: [
            {
              type: "domain",
              value: "worker.example.com",
              gamNetworkCode: "network-1",
            },
          ],
        },
        "America/Bogota",
        { referenceDate: "2026-03-01" },
      );

      expect(result.currentMonth.revenue).toBe(50);
      expect(result.currentMonth.comparison).toEqual({
        revenue: null,
        impressions: null,
      });
    } finally {
      findAllSpy.mockRestore();
    }
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

  it("returns properties without percentage or payment data", async () => {
    const res = await request(app)
      .get("/api/worker/context")
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.properties)).toBe(true);
    expect(res.body.data).toHaveProperty("dailyStatsEnabled");
    expect(res.body.data).not.toHaveProperty("percentage");
    expect(res.body.data).not.toHaveProperty("paymentInfo");
    expect(res.body.data).not.toHaveProperty("paymentStatus");
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
    expect(data.today).not.toHaveProperty("comparison");
    for (const period of ["yesterday", "last7Days", "currentMonth"]) {
      for (const metric of ["revenue", "impressions"]) {
        expect(data[period].comparison).toHaveProperty(metric);
        expect(
          data[period].comparison[metric] === null ||
            typeof data[period].comparison[metric] === "number",
        ).toBe(true);
      }
    }
  });

  it("revenue is the full estimated revenue of the assigned subdomain", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard")
      .set("Authorization", `Bearer ${workerToken}`);

    const { data } = res.body;
    // The mock always has data for "today" in America/Bogota: elvalerobux = 279.42.
    expect(data.today.revenue).toBeCloseTo(279.42, 1);
    expect(data.today).not.toHaveProperty("grossRevenue");
  });

  it("ecpm is computed from revenue and impressions", async () => {
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

  it("returns all month-to-date rows without including today", async () => {
    const res = await request(app)
      .get("/api/worker/dashboard?currentDate=2026-11-18")
      .set("Authorization", `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.dailyStats).toHaveLength(17);
    expect(res.body.data.dailyStats[0].date).toBe("2026-11-01");
    expect(res.body.data.dailyStats[16].date).toBe("2026-11-17");
    for (const row of res.body.data.dailyStats) {
      expect(typeof row.revenue).toBe("number");
      expect(typeof row.impressions).toBe("number");
      expect(typeof row.ecpm).toBe("number");
    }
  });
});
