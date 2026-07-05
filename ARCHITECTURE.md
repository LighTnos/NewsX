# Architecture & Engineering Notes

This document explains how NewsX actually works and, more usefully, the non-obvious problems that shaped it. If you're reviewing this as a portfolio piece, the interesting parts are §2 (country precision) and §3 (getting full article text for free).

## 1. High-level flow

```
                         ┌──────────────────────────────┐
   User clicks a         │  GlobeExplorer (client)      │
   country on the   ───▶ │  owns: selected country,     │
   3D globe or via       │  speech engine, bookmarks,   │
   the ⌘K palette        │  open-article state          │
                         └───────────────┬──────────────┘
                                         │ country ISO code
                                         ▼
                         ┌──────────────────────────────┐
                         │  GET /api/news?country=XX     │
                         │  1. per-country cache (30m)    │
                         │  2. NewsData.io (precise)      │
                         │  3. RSS fallback if too thin   │
                         └───────────────┬──────────────┘
                                         │ normalized Article[]
                                         ▼
                         ┌──────────────────────────────┐
   User clicks an        │  NewsFeedPanel: list, search, │
   article          ───▶ │  category filter, listen,     │
                         │  bookmark                     │
                         └───────────────┬──────────────┘
                                         │ article URL + title
                                         ▼
                         ┌──────────────────────────────┐
                         │  GET /api/article?url=…       │
                         │  1. per-URL cache (1h)         │
                         │  2. fetch + Readability extract│
                         │  3. Groq summarize (cached)    │
                         └──────────────────────────────┘
```

Everything runs on free tiers: Next.js on Vercel Hobby, NewsData.io free plan, Groq free tier, and the browser's own Web Speech API for text-to-speech.

## 2. The country-precision problem (the interesting one)

**Goal:** select India, see *Indian* news — not "Asian" news.

**First attempt (wrong):** map each country to a regional RSS feed (BBC Asia, Al Jazeera, etc.). This fails badly: those feeds cover a whole continent, so selecting India surfaced stories about Pakistan, China, and Myanmar. RSS feeds fundamentally don't tag articles by country — there was no amount of filtering that could fix this at the source.

**The fix:** NewsData.io's API supports a real `country=` query parameter that scopes results to a country. But it introduced a *second*, subtler bug:

> NewsData.io tags each article with the countries its **source publication** covers — not what the story is *about*. A pan-regional broadcaster (e.g. a Singapore outlet) is tagged to ~27 countries and shows up in every one of their feeds, publishing stories that are often about a *different* country in the region.

So even with `country=in`, a Channel-News-Asia-style outlet tagged to all of Asia would leak in. And critically, **the `country` field holds full country names (`"brazil"`), not ISO codes (`"br"`)** — an early filter comparing the ISO code against that array silently matched nothing and dropped every result, which is why the app kept falling back to RSS. (That bug is now covered by a regression test.)

The heuristic that works, and is unit-tested in `src/lib/news/newsdata.ts` (`isLocalSource`): **keep only sources tagged to ≤2 countries.** Genuinely local/national outlets have one or two tags; pan-regional broadcasters have many. It's a proxy, not perfect, but it reliably distinguishes "The Times of India" from "a wire service covering all of Asia."

**Fallback, not merge:** when NewsData.io returns too few local results for a country, the app falls back to RSS *wholesale* — it never merges the two, because mixing precise per-country results with continent-scoped RSS would reintroduce the exact problem this exists to solve.

## 3. Full article text for free

News APIs give you a 1–3 sentence description, never the full article body (that's paywalled). To let users read the whole story in-app, `/api/article` fetches the article's actual page server-side and runs **Mozilla Readability** — the same engine behind Firefox's Reader View — to extract the clean article text and HTML.

Two things make this viable for free:

- **Bing News search RSS as the country feed.** Unlike Google News (which wraps every link in an opaque redirect), Bing's news-search RSS exposes the real publisher URL directly — which is exactly what Readability needs to fetch. `src/lib/news/rss.ts` builds a per-country Bing search query and prioritizes those results.
- **Graceful degradation.** Some sites bot-block (403) or are too JS-heavy to extract from a raw fetch. When extraction fails, the reader falls back to the short summary instead of showing an empty page. In testing, most mainstream outlets extract cleanly; a minority don't.

Once full text is extracted, it's summarized once via Groq (Llama 3.1 8B) and cached alongside the text, so a trending article viewed by hundreds of people triggers exactly one LLM call.

## 4. Caching & cost control

- **News:** per-country + category, 30-minute in-memory TTL. Keeps NewsData.io's free-tier daily quota safe under normal traffic.
- **Article text + AI summary:** per-URL, 1-hour TTL, computed once. Extraction and summarization are the expensive operations, so this matters most.
- **Rate limiting:** `src/lib/rateLimit.ts` — per-IP limits on `/api/article` (20/min, protects the scraping surface and our IP), `/api/translate` (10/min, protects the metered Groq quota), and `/api/news` (60/min). In-memory, unit-tested.

All caches are in-memory `Map`s today. See §7 for why, and the production upgrade path.

## 5. Text-to-speech & translation

- **Listen** uses the browser's native Web Speech API (`useSpeech`) — zero cost, no API. It handles the real-world quirks: Chrome silently truncating long utterances (fixed by sentence-chunking), the async voice-list race, and preferring higher-quality neural voices when the browser exposes them.
- **Translate** sends the extracted text to Groq (`/api/translate`) and swaps the article body for the English translation. This replaced an earlier version that scraped Google's undocumented `translate_a` endpoint — a real, keyed API is more durable than a surface that can be blocked without notice.

## 6. State ownership

The speech engine, bookmarks store, article reader, and bookmarks panel all live at the top level (`GlobeExplorer`), not inside the per-country `NewsFeedPanel`. `NewsFeedPanel` remounts on every country switch (`key={countryId}`) to reset its feed cleanly — so anything that must *survive* a country switch (active audio playback, the open article, saved articles) is deliberately hoisted above it. Bookmarks persist per-browser via `localStorage` (`useBookmarks`); there are no user accounts.

## 7. Known limitations & the production upgrade path

Honest about what's demo-grade:

- **In-memory caches and rate limits reset on every serverless cold start / redeploy.** For a portfolio demo this is fine. In production you'd move both to **Upstash Redis** (already a dependency, wired as a documented future step) so they survive restarts and work across multiple serverless instances. The route handlers are structured so this is a drop-in change to the get/set calls, not a rewrite.
- **Bing News search RSS and article scraping are unofficial surfaces** — no ToS or rate-limit guarantee. They work today and degrade gracefully, but they're the two dependencies most likely to need attention over time.
- **NewsData.io's free `/latest` endpoint runs several hours behind real-time**, and its true-live `timeframe` filter is paid-only. The tradeoff chosen here is precision (genuinely per-country) over minute-freshness.

## 8. Testing

`npm test` (Vitest) covers the pure business logic that would be easy to regress:

- `countryCentroid` — the largest-polygon selection that keeps multi-polygon countries (France, Russia) centered on their mainland instead of mid-ocean.
- `isLocalSource` — the ≤2-country filter, including the boundary and empty-array cases.
- `dedupeAndSort` — dedup by id, newest-first, and the deliberate Bing-News-first prioritization.
- `rateLimit` — under/over limit, per-IP isolation, window reset.
- `summarizeArticle` — the no-key-returns-null contract the reader depends on.
