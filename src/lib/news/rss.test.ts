import { describe, expect, it } from "vitest";
import { dedupeAndSort } from "./rss";
import type { Article } from "./types";

function article(overrides: Partial<Article>): Article {
  return {
    id: "id-1",
    title: "Title",
    summary: "Summary",
    source: "Some Outlet",
    url: "https://example.com/1",
    publishedAt: null,
    imageUrl: null,
    ...overrides,
  };
}

describe("dedupeAndSort", () => {
  it("removes duplicate articles by id, keeping the first occurrence", () => {
    const a = article({ id: "dup", title: "First seen" });
    const b = article({ id: "dup", title: "Duplicate" });
    const result = dedupeAndSort([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("First seen");
  });

  it("sorts newest first by publishedAt", () => {
    const older = article({ id: "1", publishedAt: "2026-01-01T00:00:00.000Z" });
    const newer = article({ id: "2", publishedAt: "2026-06-01T00:00:00.000Z" });
    const result = dedupeAndSort([older, newer]);
    expect(result.map((a) => a.id)).toEqual(["2", "1"]);
  });

  it("treats missing publishedAt as oldest (epoch 0)", () => {
    const noDate = article({ id: "1", publishedAt: null });
    const dated = article({ id: "2", publishedAt: "2026-01-01T00:00:00.000Z" });
    const result = dedupeAndSort([noDate, dated]);
    expect(result.map((a) => a.id)).toEqual(["2", "1"]);
  });

  it("prioritizes Bing News Local over other sources regardless of publish time", () => {
    // This is deliberate: Bing's hyper-local per-country search results
    // would otherwise get drowned out by high-volume feeds like Al Jazeera,
    // even when Al Jazeera's story happens to be more recent.
    const newerGlobal = article({
      id: "1",
      source: "Al Jazeera",
      publishedAt: "2026-06-01T00:00:00.000Z",
    });
    const olderLocal = article({
      id: "2",
      source: "Bing News Local",
      publishedAt: "2026-01-01T00:00:00.000Z",
    });
    const result = dedupeAndSort([newerGlobal, olderLocal]);
    expect(result[0].source).toBe("Bing News Local");
  });

  it("caps the result at 30 articles", () => {
    const many = Array.from({ length: 45 }, (_, i) =>
      article({ id: `id-${i}`, url: `https://example.com/${i}` })
    );
    expect(dedupeAndSort(many)).toHaveLength(30);
  });
});
