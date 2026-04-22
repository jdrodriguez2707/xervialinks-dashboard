const request = require("supertest");
const app = require("../src/app");

describe("GET /api/reports", () => {
  it("returns 200 with reports array and summary", async () => {
    const res = await request(app).get("/api/reports");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(typeof res.body.summary).toBe("object");
  });

  it("each report has required fields", async () => {
    const res = await request(app).get("/api/reports");
    const report = res.body.reports[0];

    expect(report).toHaveProperty("date");
    expect(report).toHaveProperty("domain");
    expect(report).toHaveProperty("impressions");
    expect(report).toHaveProperty("revenue");
    expect(report).toHaveProperty("ecpm");
  });

  it("filters by domain", async () => {
    const res = await request(app).get(
      "/api/reports?domain=sports.example.com"
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.reports.length).toBeGreaterThan(0);
    res.body.reports.forEach((r) => {
      expect(r.domain).toBe("sports.example.com");
    });
  });

  it("summary totalRevenue equals sum of individual revenues", async () => {
    const res = await request(app).get("/api/reports");
    const { reports, summary } = res.body;

    const manualTotal = reports.reduce((sum, r) => sum + r.revenue, 0);

    expect(summary.totalRevenue).toBeCloseTo(manualTotal, 4);
  });

  it("summary ecpm is recalculated from totals (not average of averages)", async () => {
    const res = await request(app).get("/api/reports");
    const { summary } = res.body;

    const expectedEcpm = parseFloat(
      ((summary.totalRevenue / summary.totalImpressions) * 1000).toFixed(4)
    );

    expect(summary.ecpm).toBe(expectedEcpm);
  });
});
