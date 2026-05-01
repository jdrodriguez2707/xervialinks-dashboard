const { isAssignableSubdomain } = require("../src/application/services/sites.service");

describe("isAssignableSubdomain", () => {
  it("accepts subdomains with 3+ labels", () => {
    expect(isAssignableSubdomain("elvalerobux.barbacoadicto.com")).toBe(true);
    expect(isAssignableSubdomain("a.b.example.com")).toBe(true);
  });

  it("rejects apex/root domains", () => {
    expect(isAssignableSubdomain("barbacoadicto.com")).toBe(false);
    expect(isAssignableSubdomain("example.org")).toBe(false);
  });

  it("rejects invalid or empty values", () => {
    expect(isAssignableSubdomain("")).toBe(false);
    expect(isAssignableSubdomain("bad..domain.com")).toBe(false);
    expect(isAssignableSubdomain(null)).toBe(false);
  });
});
