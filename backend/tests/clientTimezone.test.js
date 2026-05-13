const {
  resolveClientTimeZone,
  isValidIanaTimeZone,
  todayISO,
  getDefaultPaymentMonthKey,
} = require("../src/application/services/clientTimezone");

describe("clientTimezone", () => {
  it("rejects invalid timezone strings", () => {
    expect(isValidIanaTimeZone("")).toBe(false);
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
    expect(isValidIanaTimeZone("'; DROP TABLE--")).toBe(false);
  });

  it("accepts America/Mexico_City", () => {
    expect(isValidIanaTimeZone("America/Mexico_City")).toBe(true);
  });

  it("resolveClientTimeZone falls back for invalid header", () => {
    const resolved = resolveClientTimeZone("Invalid/Zone");
    expect(isValidIanaTimeZone(resolved)).toBe(true);
  });

  it("resolveClientTimeZone uses header when valid", () => {
    expect(resolveClientTimeZone("  Europe/London  ")).toBe("Europe/London");
  });

  it("todayISO(Europe/London) is a YYYY-MM-DD string", () => {
    expect(todayISO("Europe/London")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  describe("getDefaultPaymentMonthKey (corte día 23)", () => {
    it("antes del día 24 devuelve el mes calendario anterior", () => {
      expect(getDefaultPaymentMonthKey("UTC", new Date("2026-05-12T12:00:00Z"))).toBe("2026-04");
    });

    it("el día 23 sigue en el mes anterior (liquidación de ese día)", () => {
      expect(getDefaultPaymentMonthKey("UTC", new Date("2026-05-23T12:00:00Z"))).toBe("2026-04");
    });

    it("del 24 en adelante devuelve el mes calendario en curso", () => {
      expect(getDefaultPaymentMonthKey("UTC", new Date("2026-05-24T12:00:00Z"))).toBe("2026-05");
    });

    it("cruza correctamente el cambio de año", () => {
      expect(getDefaultPaymentMonthKey("UTC", new Date("2026-01-10T12:00:00Z"))).toBe("2025-12");
      expect(getDefaultPaymentMonthKey("UTC", new Date("2026-01-24T12:00:00Z"))).toBe("2026-01");
    });
  });
});
