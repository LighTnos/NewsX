import { createHash } from "node:crypto";
import type { Article } from "./types";

// NewsData.io "latest" endpoint response shape (per newsdata.io/documentation).
interface NewsDataArticle {
  article_id?: string;
  title?: string;
  description?: string | null;
  link?: string;
  source_id?: string;
  source_name?: string;
  pubDate?: string | null;
  image_url?: string | null;
  // Countries the SOURCE publication covers/operates in — not necessarily
  // what the story is about. A local outlet has one entry; pan-regional
  // broadcasters (e.g. Channel News Asia) list a dozen+ countries.
  country?: string[];
}

interface NewsDataResponse {
  status: string;
  results?: NewsDataArticle[];
  message?: string;
  nextPage?: string | null;
}

function articleId(seed: string): string {
  return createHash("sha1").update(seed).digest("hex").slice(0, 16);
}

async function fetchPage(
  apiKey: string,
  isoCode: string,
  category: string,
  page: string | null
): Promise<NewsDataResponse> {
  const url = new URL("https://newsdata.io/api/1/latest");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("country", isoCode.toLowerCase());
  url.searchParams.set("language", "en");
  if (category && category !== "top") {
    url.searchParams.set("category", category);
  }
  url.searchParams.set("size", "10"); // NewsData.io free-tier max per request
  if (page) url.searchParams.set("page", page);

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error(`NewsData.io request failed: ${res.status}`);
  }
  return (await res.json()) as NewsDataResponse;
}

// NewsData.io's `country` filter genuinely scopes results to that country
// (unlike outlet RSS feeds, which cover a whole continent) — this is the
// only source in the pipeline that makes "select India, see India news"
// actually true rather than approximate.
//
// Pulls up to 3 pages (30 raw articles) since the free tier caps a single
// request at 10 and the local-source-only filter below discards a chunk of
// each page (pan-regional broadcasters) — fetching just one page often left
// too few articles to be a useful feed.
export async function fetchNewsDataCountry(
  isoCode: string,
  category: string = "top"
): Promise<Article[]> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return [];

  const MAX_PAGES = 3;
  const rawResults: NewsDataArticle[] = [];
  let page: string | null = null;

  for (let i = 0; i < MAX_PAGES; i++) {
    const data: NewsDataResponse = await fetchPage(apiKey, isoCode, category, page);
    if (data.status !== "success" || !data.results) {
      if (i === 0) {
        throw new Error(data.message ?? "NewsData.io returned an error status");
      }
      break; // later pages failing shouldn't discard what we already have
    }
    rawResults.push(...data.results);
    if (!data.nextPage) break;
    page = data.nextPage;
  }

  return rawResults
    .filter((item) => item.title && item.link)
    // The `country` query param already scopes every result to the
    // requested country. The remaining precision problem is pan-regional
    // broadcasters (e.g. a Singapore outlet tagged to 27 countries) whose
    // stories are frequently about a *different* country in their region.
    // Genuinely local/national outlets are tagged to only 1-2 countries —
    // exclude anything broader as a proxy for "not actually local coverage".
    // (NewsData.io's `country` array holds full names like "brazil", not
    // ISO codes, so we can't name-match here — length is the only signal.)
    .filter((item) => (item.country ?? []).length <= 2)
    .map((item) => ({
      id: articleId(item.article_id ?? item.link!),
      title: item.title!.trim(),
      summary: (item.description ?? "").trim(),
      source: item.source_name ?? item.source_id ?? "NewsData",
      url: item.link!,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      imageUrl: item.image_url ?? null,
    }))
    // Freshest first — pages come back in recency order already, but after
    // merging multiple pages it's worth re-asserting the sort explicitly.
    .sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    });
}
