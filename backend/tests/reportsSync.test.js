const env = require("../src/infrastructure/config/env");
const gamNetworksRepo = require("../src/domain/repositories/gamNetworks.repository");
const reportsRepo = require("../src/domain/repositories/reports.repository");
const { syncReportsBatch, previousMonthStartISO } = require("../src/application/services/reportsSync.service");

describe("manual network sync comparison history", () => {
  it("finds the start of the previous month, including across year boundaries", () => {
    expect(previousMonthStartISO("America/Bogota", "2026-11-08")).toBe("2026-10-01");
    expect(previousMonthStartISO("America/Bogota", "2026-01-08")).toBe("2025-12-01");
  });

  it("syncs a selected network from the previous month start through the requested date", async () => {
    const networkSpy = jest
      .spyOn(gamNetworksRepo, "listCodesWithAccessOk")
      .mockReturnValue(["network-1", "network-2"]);
    const upsertSpy = jest.spyOn(reportsRepo, "upsertMany").mockImplementation(() => {});

    try {
      const result = await syncReportsBatch({
        onlyNetworkCode: "network-1",
        includePreviousMonth: true,
        endDate: "2026-11-08",
      });

      expect(result).toEqual(
        expect.objectContaining({
          startDate: "2026-10-01",
          endDate: "2026-11-08",
          networks: ["network-1"],
        }),
      );
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(env.USE_REAL_GAM_API).toBe(false);
    } finally {
      networkSpy.mockRestore();
      upsertSpy.mockRestore();
    }
  });
});
