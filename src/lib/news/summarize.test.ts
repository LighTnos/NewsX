import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { summarizeArticle } from "./summarize";

describe("summarizeArticle", () => {
  const originalKey = process.env.GROQ_API_KEY;

  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
  });

  afterEach(() => {
    if (originalKey) process.env.GROQ_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("returns null without throwing when no API key is configured", async () => {
    // The caller (/api/article) always has the source's own description to
    // fall back to — summarization must never be a hard dependency.
    const result = await summarizeArticle("Some title", "Some article body.");
    expect(result).toBeNull();
  });
});
