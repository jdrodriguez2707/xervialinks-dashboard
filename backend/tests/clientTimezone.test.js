const {
  resolveClientTimeZone,
  isValidIanaTimeZone,
  todayISO,
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
});
