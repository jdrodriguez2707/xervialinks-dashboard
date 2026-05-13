const request = require("supertest");
const app = require("../src/app");
const { closeDb, resetDb } = require("../src/infrastructure/database/database");
const { getAdminToken } = require("./helpers/auth");
const {
  computePayout,
  getAssignedDomains,
  sumRevenue,
  deletedAtToBusinessCalendarISO,
} = require("../src/application/services/payouts.service");
const { todayISO, daysAgoISO } = require("../src/application/services/clientTimezone");

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
      { type: "other", value: "ignored" },
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

describe("deletedAtToBusinessCalendarISO", () => {
  it("maps SQLite UTC deletion instant to calendar date in America/Bogota", () => {
    expect(deletedAtToBusinessCalendarISO("2026-05-01 04:30:00", "America/Bogota")).toBe(
      "2026-04-30",
    );
    expect(deletedAtToBusinessCalendarISO("2026-05-01 18:00:00", "America/Bogota")).toBe(
      "2026-05-01",
    );
  });

  it("falls back for plain date strings", () => {
    expect(deletedAtToBusinessCalendarISO("2026-03-15", "America/Bogota")).toBe("2026-03-15");
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
      .send({ name: "Grace", email: "grace@example.com", percentage: 70, password: "pass123" });
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
    const res = await request(app).get("/api/payouts").set("Authorization", `Bearer ${token}`);
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
      .send({
        name: "Unassigned",
        email: "unassigned@example.com",
        percentage: 50,
        password: "pass123",
      });
    const unassignedId = workerRes.body.data.id;

    const res = await request(app).get("/api/payouts").set("Authorization", `Bearer ${token}`);
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
      .send({
        name: "Deleted Hist",
        email: "deletedhist@example.com",
        percentage: 60,
        password: "pass123",
      });
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

  it("admin can persist net revenue override and recalculated payout", async () => {
    const { getDb } = require("../src/infrastructure/database/database");
    const netRow = getDb()
      .prepare(
        "SELECT network_code AS c FROM gam_networks ORDER BY is_default DESC, id ASC LIMIT 1",
      )
      .get();
    const netCode = netRow?.c || "default";
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const put = await request(app)
      .put("/api/payouts/worker-net-revenue-override")
      .set("Authorization", `Bearer ${token}`)
      .send({
        workerId,
        gamNetworkCode: netCode,
        periodStart: today,
        periodEnd: today,
        netRevenue: 1000,
      });
    expect(put.status).toBe(200);

    const res = await request(app)
      .get(
        `/api/payouts?startDate=${today}&endDate=${today}&networkCode=${encodeURIComponent(netCode)}`,
      )
      .set("Authorization", `Bearer ${token}`);
    const grace = res.body.data.payouts.find((w) => w.workerId === workerId);
    expect(grace.assignedRevenue).toBe(1000);
    expect(grace.hasRevenueOverride).toBe(true);
    expect(grace.payout).toBe(700);
  });
});

describe("GET /api/payouts/history", () => {
  it("returns only paid records with computed payout amount", async () => {
    const workerRes = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "History Worker",
        email: "history.worker@example.com",
        percentage: 50,
        password: "pass123",
      });
    const workerId = workerRes.body.data.id;

    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "parceitorobux.barbacoadicto.com" });

    const today = todayISO("America/Bogota");
    const paymentMonth = today.slice(0, 7);

    const markPaid = await request(app)
      .patch(`/api/workers/${workerId}/payment-status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "paid", paymentMonth });
    expect(markPaid.status).toBe(200);

    const history = await request(app)
      .get("/api/payouts/history")
      .set("Authorization", `Bearer ${token}`);
    expect(history.status).toBe(200);
    const row = history.body.data.find(
      (entry) => entry.workerName === "History Worker" && entry.paymentMonth === paymentMonth,
    );
    expect(row).toBeDefined();
    expect(row.status).toBe("success");
    expect(row.statusLabel).toBe("Pago realizado");
    expect(row.amount).toBeGreaterThan(0);

    await request(app)
      .patch(`/api/workers/${workerId}/payment-status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "pending", paymentMonth });

    const historyAfterPending = await request(app)
      .get("/api/payouts/history")
      .set("Authorization", `Bearer ${token}`);
    const removed = historyAfterPending.body.data.find(
      (entry) => entry.workerName === "History Worker" && entry.paymentMonth === paymentMonth,
    );
    expect(removed).toBeUndefined();
  });

  it("keeps admin payment history amount after worker percentage changes (frozen at mark paid)", async () => {
    const workerRes = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Frozen Payout Worker",
        email: "frozen.payout@example.com",
        percentage: 50,
        password: "pass123",
      });
    const workerId = workerRes.body.data.id;

    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "frozen.pay.test.example.com" });

    const paymentMonth = todayISO("America/Bogota").slice(0, 7);

    const markPaid = await request(app)
      .patch(`/api/workers/${workerId}/payment-status`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Client-Timezone", "America/Bogota")
      .send({ status: "paid", paymentMonth });
    expect(markPaid.status).toBe(200);

    const historyBefore = await request(app)
      .get("/api/payouts/history")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Client-Timezone", "America/Bogota");
    const rowBefore = historyBefore.body.data.find(
      (e) => e.workerName === "Frozen Payout Worker" && e.paymentMonth === paymentMonth,
    );
    expect(rowBefore).toBeDefined();
    const amountBefore = rowBefore.amount;

    const patchPct = await request(app)
      .patch(`/api/workers/${workerId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Frozen Payout Worker",
        email: "frozen.payout@example.com",
        percentage: 60,
        domains: ["frozen.pay.test.example.com"],
      });
    expect(patchPct.status).toBe(200);

    const historyAfter = await request(app)
      .get("/api/payouts/history")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Client-Timezone", "America/Bogota");
    const rowAfter = historyAfter.body.data.find(
      (e) => e.workerName === "Frozen Payout Worker" && e.paymentMonth === paymentMonth,
    );
    expect(rowAfter).toBeDefined();
    expect(rowAfter.amount).toBe(amountBefore);
  });

  it("mantiene el mismo monto en historial admin tras paid → pending → % → paid otra vez", async () => {
    const workerRes = await request(app)
      .post("/api/workers")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Refreeze Worker",
        email: "refreeze.worker@example.com",
        percentage: 40,
        password: "pass123",
      });
    const workerId = workerRes.body.data.id;

    await request(app)
      .post(`/api/workers/${workerId}/properties`)
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "domain", value: "refreeze.pay.test.example.com" });

    const paymentMonth = todayISO("America/Bogota").slice(0, 7);

    await request(app)
      .patch(`/api/workers/${workerId}/payment-status`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Client-Timezone", "America/Bogota")
      .send({ status: "paid", paymentMonth });

    const h1 = await request(app)
      .get("/api/payouts/history")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Client-Timezone", "America/Bogota");
    const row1 = h1.body.data.find(
      (e) => e.workerName === "Refreeze Worker" && e.paymentMonth === paymentMonth,
    );
    expect(row1).toBeDefined();
    const amount1 = row1.amount;

    await request(app)
      .patch(`/api/workers/${workerId}/payment-status`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Client-Timezone", "America/Bogota")
      .send({ status: "pending", paymentMonth });

    await request(app)
      .patch(`/api/workers/${workerId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Refreeze Worker",
        email: "refreeze.worker@example.com",
        percentage: 90,
        domains: ["refreeze.pay.test.example.com"],
      });

    await request(app)
      .patch(`/api/workers/${workerId}/payment-status`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Client-Timezone", "America/Bogota")
      .send({ status: "paid", paymentMonth });

    const h2 = await request(app)
      .get("/api/payouts/history")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Client-Timezone", "America/Bogota");
    const row2 = h2.body.data.find(
      (e) => e.workerName === "Refreeze Worker" && e.paymentMonth === paymentMonth,
    );
    expect(row2).toBeDefined();
    expect(row2.amount).toBe(amount1);
  });
});
