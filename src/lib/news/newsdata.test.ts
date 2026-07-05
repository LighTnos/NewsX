import { describe, expect, it } from "vitest";
import { isLocalSource } from "./newsdata";

describe("isLocalSource", () => {
  it("accepts a source tagged to a single country", () => {
    expect(isLocalSource(["india"])).toBe(true);
  });

  it("accepts a source tagged to two countries", () => {
    expect(isLocalSource(["india", "pakistan"])).toBe(true);
  });

  it("rejects a pan-regional source tagged to many countries", () => {
    // The real-world case this exists for: a Singapore-based broadcaster
    // tagged to ~27 countries, whose stories are frequently about a
    // *different* country in the region than the one the user selected.
    const manyCountries = Array.from({ length: 27 }, (_, i) => `country-${i}`);
    expect(isLocalSource(manyCountries)).toBe(false);
  });

  it("accepts a source with no country tags at all (matches original inline behavior)", () => {
    expect(isLocalSource(undefined)).toBe(true);
    expect(isLocalSource([])).toBe(true);
  });

  it("is inclusive at the boundary (exactly 2 passes, 3 fails)", () => {
    expect(isLocalSource(["a", "b"])).toBe(true);
    expect(isLocalSource(["a", "b", "c"])).toBe(false);
  });
});
