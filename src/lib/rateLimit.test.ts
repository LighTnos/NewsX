import { describe, expect, it, vi, afterEach } from "vitest";
import { rateLimit } from "./rateLimit";
import type { NextRequest } from "next/server";

function fakeRequest(ip: string): NextRequest {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
  } as unknown as NextRequest;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const req = fakeRequest("1.1.1.1");
    const result = rateLimit(req, { limit: 3, windowMs: 60_000 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks once the limit is reached within the window", () => {
    const req = fakeRequest("2.2.2.2");
    rateLimit(req, { limit: 2, windowMs: 60_000 });
    rateLimit(req, { limit: 2, windowMs: 60_000 });
    const third = rateLimit(req, { limit: 2, windowMs: 60_000 });
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("tracks separate IPs independently", () => {
    const reqA = fakeRequest("3.3.3.3");
    const reqB = fakeRequest("4.4.4.4");
    rateLimit(reqA, { limit: 1, windowMs: 60_000 });
    const blockedA = rateLimit(reqA, { limit: 1, windowMs: 60_000 });
    const allowedB = rateLimit(reqB, { limit: 1, windowMs: 60_000 });
    expect(blockedA.ok).toBe(false);
    expect(allowedB.ok).toBe(true);
  });

  it("resets the count after the window expires", () => {
    vi.useFakeTimers();
    const req = fakeRequest("5.5.5.5");
    rateLimit(req, { limit: 1, windowMs: 1000 });
    const blocked = rateLimit(req, { limit: 1, windowMs: 1000 });
    expect(blocked.ok).toBe(false);

    vi.advanceTimersByTime(1001);
    const afterReset = rateLimit(req, { limit: 1, windowMs: 1000 });
    expect(afterReset.ok).toBe(true);
  });

  it("falls back to a shared bucket when no x-forwarded-for header is present", () => {
    const req = { headers: new Headers() } as unknown as NextRequest;
    const result = rateLimit(req, { limit: 5, windowMs: 60_000 });
    expect(result.ok).toBe(true);
  });
});
