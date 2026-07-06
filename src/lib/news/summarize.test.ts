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
    const result = await summarizeArticle("Some title", "Some article body.");
    expect(result).toBeNull();
  });
});
