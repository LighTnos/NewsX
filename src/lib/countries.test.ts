import { describe, expect, it } from "vitest";
import { countryCentroid, countryId, countryName } from "./countries";
import type { CountryFeature } from "./countries";

function feature(props: Partial<CountryFeature["properties"]>, geometry: CountryFeature["geometry"]): CountryFeature {
  return {
    type: "Feature",
    properties: { ADMIN: "Testland", ISO_A2: "TL", ADM0_A3: "TLD", ...props },
    geometry,
  };
}

describe("countryId", () => {
  it("uses ISO_A2 when present and valid", () => {
    const f = feature({ ISO_A2: "IN" }, { type: "Point", coordinates: [0, 0] });
    expect(countryId(f)).toBe("IN");
  });

  it("falls back to ADM0_A3 when ISO_A2 is the Natural Earth placeholder '-99'", () => {
    // France, Norway, and a few others are marked ISO_A2 "-99" in the
    // Natural Earth dataset — the fallback keeps them selectable at all.
    const f = feature({ ISO_A2: "-99", ADM0_A3: "FRA" }, { type: "Point", coordinates: [0, 0] });
    expect(countryId(f)).toBe("FRA");
  });

  it("falls back to ADM0_A3 when ISO_A2 is missing entirely", () => {
    const f = feature({ ISO_A2: undefined as unknown as string, ADM0_A3: "XYZ" }, { type: "Point", coordinates: [0, 0] });
    expect(countryId(f)).toBe("XYZ");
  });
});

describe("countryName", () => {
  it("returns the ADMIN property", () => {
    const f = feature({ ADMIN: "France" }, { type: "Point", coordinates: [0, 0] });
    expect(countryName(f)).toBe("France");
  });
});

describe("countryCentroid", () => {
  it("returns the centroid of a simple Polygon", () => {
    const square: CountryFeature["geometry"] = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [0, 2],
          [2, 2],
          [2, 0],
          [0, 0],
        ],
      ],
    };
    const f = feature({}, square);
    const { lat, lng } = countryCentroid(f);
    expect(lng).toBeCloseTo(1, 0);
    expect(lat).toBeCloseTo(1, 0);
  });

  it("picks the largest polygon of a MultiPolygon, not a naive average", () => {
    // A large "mainland" square far from a tiny "island" square. The naive
    // geoCentroid of the whole MultiPolygon would land somewhere between
    // the two landmasses — often open ocean for real countries with
    // far-flung overseas territories (this is exactly the France/Russia
    // bug the largest-polygon logic fixes).
    const mainland: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
      [0, 0],
    ];
    const tinyDistantIsland: [number, number][] = [
      [100, 80],
      [100, 81],
      [101, 81],
      [101, 80],
      [100, 80],
    ];
    const multiPolygon: CountryFeature["geometry"] = {
      type: "MultiPolygon",
      coordinates: [[mainland], [tinyDistantIsland]],
    };
    const f = feature({}, multiPolygon);
    const { lat, lng } = countryCentroid(f);

    // Should land on the mainland (centered around 5,5), nowhere near the
    // distant tiny island around (100, 80).
    expect(lng).toBeGreaterThan(0);
    expect(lng).toBeLessThan(10);
    expect(lat).toBeGreaterThan(0);
    expect(lat).toBeLessThan(10);
  });
});
