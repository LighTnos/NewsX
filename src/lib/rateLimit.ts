import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

// Per-IP sliding-window-ish rate limiter, in-memory. Resets on redeploy/cold
// start — that's an accepted tradeoff for a portfolio project (see
// ROADMAP.md's "future upgrades" section for the Upstash Redis version that
// would survive restarts and work across multiple server instances).
const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so this Map can't grow unbounded over a
// long-lived server process.
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();
function sweep() {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientIp(request: NextRequest): string {
  // Vercel/most proxies set x-forwarded-for; fall back to a constant so
  // local dev (no proxy) still gets a single shared bucket rather than
  // throwing.
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/** Returns { ok: false } once `limit` requests have been made by this IP within `windowMs`. */
export function rateLimit(
  request: NextRequest,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  sweep();
  const key = `${clientIp(request)}:${windowMs}:${limit}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}
