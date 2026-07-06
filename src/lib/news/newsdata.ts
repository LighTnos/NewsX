import { createHash } from "node:crypto";
import type { Article } from "./types";

interface NewsDataArticle {
  article_id?: string;
  title?: string;
  description?: string | null;
  link?: string;
  source_id?: string;
  source_name?: string;
  pubDate?: string | null;
  image_url?: string | null;
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

export function isLocalSource(countryTags: string[] | undefined): boolean {
  return (countryTags ?? []).length <= 2;
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
  url.searchParams.set("size", "10");
  if (page) url.searchParams.set("page", page);

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error(`NewsData.io request failed: ${res.status}`);
  }
  return (await res.json()) as NewsDataResponse;
}

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
      break;
    }
    rawResults.push(...data.results);
    if (!data.nextPage) break;
    page = data.nextPage;
  }

  return rawResults
    .filter((item) => item.title && item.link)
    .filter((item) => isLocalSource(item.country))
    .map((item) => ({
      id: articleId(item.article_id ?? item.link!),
      title: item.title!.trim(),
      summary: (item.description ?? "").trim(),
      source: item.source_name ?? item.source_id ?? "NewsData",
      url: item.link!,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      imageUrl: item.image_url ?? null,
    }))
    .sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    });
}
