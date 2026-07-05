import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { rateLimit } from "@/lib/rateLimit";
import { summarizeArticle } from "@/lib/news/summarize";

export const runtime = "nodejs";

const CACHE_TTL_MS = 60 * 60 * 1000; // extracted text doesn't change; cache an hour
interface CachedArticle {
  text: string;
  html: string;
  byline: string | null;
  excerpt: string | null;
  aiSummary: string | null;
  expiresAt: number;
}
const cache = new Map<string, CachedArticle>();

// Extracts the main readable text from a news article URL server-side,
// using the same Readability engine behind Firefox's Reader View. Free
// sources (RSS/NewsData.io) only ever give a 1-3 sentence description —
// this is how the app gets genuinely full article text without a paid API.
export async function GET(request: NextRequest) {
  // This route fetches arbitrary third-party URLs server-side (scraping,
  // not a licensed API) — an unbounded client could hammer both our server
  // and target news sites through it, risking our IP getting blocked.
  const limit = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many article requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  const url = request.nextUrl.searchParams.get("url");
  const title = request.nextUrl.searchParams.get("title") ?? "";
  if (!url) {
    return NextResponse.json(
      { error: "Missing `url` query param." },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({
      text: cached.text,
      html: cached.html,
      byline: cached.byline,
      excerpt: cached.excerpt,
      aiSummary: cached.aiSummary,
    });
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        // Some sites block requests with no browser-like UA at all.
        "User-Agent":
          "Mozilla/5.0 (compatible; NewsXBot/1.0; +https://github.com)",
      },
    });
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status}`);
    }
    const htmlContent = await res.text();

    const dom = new JSDOM(htmlContent, { url });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent?.trim();
    const articleHtml = article?.content?.trim();
    const byline = article?.byline?.trim() || null;
    const excerpt = article?.excerpt?.trim() || null;

    if (!text || text.length < 200 || !articleHtml) {
      // Readability succeeded but found little/nothing usable (paywall,
      // JS-rendered body, unusual layout) — let the client fall back to
      // the short summary rather than showing a near-empty reader view.
      return NextResponse.json(
        { error: "No readable article content found." },
        { status: 422 }
      );
    }

    // One Groq call per unique article, ever — cached alongside the
    // extracted text, so a trending story viewed by hundreds of visitors
    // still only triggers a single summarization request.
    const aiSummary = await summarizeArticle(title || excerpt || "", text);

    const payload = {
      text,
      html: articleHtml,
      byline,
      excerpt,
      aiSummary,
    };

    cache.set(url, { ...payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Could not fetch or parse this article." },
      { status: 502 }
    );
  }
}
