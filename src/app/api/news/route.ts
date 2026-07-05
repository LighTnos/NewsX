import { NextRequest, NextResponse } from "next/server";
import { fetchCountryNews } from "@/lib/news/rss";
import { fetchNewsDataCountry } from "@/lib/news/newsdata";
import type { NewsResponse } from "@/lib/news/types";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min, matches ROADMAP §3 caching plan

// In-memory per-country cache. Swap for Upstash Redis when it's provisioned
// (see ROADMAP.md §3) without changing this route's request/response shape —
// this Map is a drop-in placeholder for that same get/set contract.
const cache = new Map<string, { data: NewsResponse; expiresAt: number }>();

export async function GET(request: NextRequest) {
  // Cache absorbs most repeat load, but a client cycling through many
  // country/category combos could still burn NewsData.io's daily quota —
  // cap per-IP requests as a second line of defense.
  const limit = rateLimit(request, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  const country = request.nextUrl.searchParams.get("country");
  const name = request.nextUrl.searchParams.get("name") || country;
  const category = (request.nextUrl.searchParams.get("category") || "top").toLowerCase();

  if (!country || !/^[A-Za-z]{2,3}$/.test(country)) {
    return NextResponse.json(
      { error: "Missing or invalid `country` query param (ISO code)." },
      { status: 400 }
    );
  }

  const iso = country.toUpperCase();
  const cacheKey = `${iso}-${category}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  // NewsData.io genuinely filters by country (this is the whole point —
  // outlet RSS feeds are continent/world-scoped and cannot do this). RSS is
  // only used as a whole-list fallback when NewsData.io comes back too thin
  // to be a useful feed — the two are never merged, since mixing precise
  // per-country results with continent-scoped RSS would reintroduce the
  // same "other countries' news mixed in" problem this exists to fix.
  const MIN_USEFUL_RESULTS = 4;
  let articles: Awaited<ReturnType<typeof fetchCountryNews>> = [];
  let source: NewsResponse["source"] = "rss";

  try {
    articles = await fetchNewsDataCountry(iso, category);
    if (articles.length >= MIN_USEFUL_RESULTS) source = "newsdata";
  } catch (err) {
    console.error(`[news] NewsData.io failed for ${iso}:`, err);
    articles = [];
  }

  if (articles.length < MIN_USEFUL_RESULTS) {
    try {
      const rssArticles = await fetchCountryNews(iso, name as string, category);
      if (rssArticles.length > articles.length) {
        articles = rssArticles;
        source = "rss";
      }
    } catch {
      // Keep whatever NewsData.io returned rather than failing outright —
      // a thin-but-real feed beats an error page.
      if (articles.length === 0) {
        return NextResponse.json(
          { error: "Failed to fetch news for this country." },
          { status: 502 }
        );
      }
    }
  }

  const sourceCounts: Record<string, number> = {};
  articles.forEach(a => {
    sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
  });

  const payload = {
    country: iso,
    articles,
    source,
    fetchedAt: new Date().toISOString(),
    debug: sourceCounts
  };
  cache.set(cacheKey, { data: payload as NewsResponse, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(payload);
}
