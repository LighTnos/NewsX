import Parser from "rss-parser";
import { createHash } from "node:crypto";
import { feedsForCountry, type FeedSource } from "@/lib/rssSources";
import type { Article } from "./types";

const parser = new Parser({ 
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

function articleId(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSummary(item: Parser.Item): string {
  const raw = item.contentSnippet || item.summary || item.content || "";
  const text = stripHtml(raw);
  return text.length > 260 ? `${text.slice(0, 257)}…` : text;
}

async function fetchFeed(feed: FeedSource): Promise<Article[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    return parsed.items
      .filter((item) => item.link && item.title)
      .map((item) => {
        let finalUrl = item.link!;
        try {
          if (finalUrl.includes("bing.com/news/apiclick.aspx")) {
            const urlParam = new URL(finalUrl).searchParams.get("url");
            if (urlParam) finalUrl = urlParam;
          }
        } catch {
        }

        return {
          id: articleId(item.link!),
          title: stripHtml(item.title!),
          summary: toSummary(item),
          source: feed.name,
          url: finalUrl,
          publishedAt: item.isoDate ?? item.pubDate ?? null,
          imageUrl: item.enclosure?.url ?? null,
        };
      });
  } catch (err) {
    console.error('Failed to fetch feed:', feed.url, err);
    return [];
  }
}

export function dedupeAndSort(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const deduped = articles.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  return deduped
    .sort((a, b) => {
      const aIsLocal = a.source === "Bing News Local";
      const bIsLocal = b.source === "Bing News Local";

      if (aIsLocal && !bIsLocal) return -1;
      if (!aIsLocal && bIsLocal) return 1;

      const timeA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const timeB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return timeB - timeA;
    })
    .slice(0, 30);
}

export async function fetchCountryNews(isoCode: string, countryName: string, category: string = "top"): Promise<Article[]> {
  const baseFeeds = feedsForCountry(isoCode);
  
  const query = category === "top" ? countryName : `${countryName} ${category}`;
  const bingNewsFeed: FeedSource = {
    name: "Bing News Local",
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`
  };
  
  const allFeeds = category === "top" ? [bingNewsFeed, ...baseFeeds] : [bingNewsFeed];
  const results = await Promise.all(allFeeds.map(fetchFeed));
  const articles = results.flat();

  console.log(`[RSS] Fetched ${articles.length} total articles. Bing News count:`, articles.filter(a => a.source === "Bing News Local").length);

  return dedupeAndSort(articles);
}
