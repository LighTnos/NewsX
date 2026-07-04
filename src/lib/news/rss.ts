import Parser from "rss-parser";
import { createHash } from "node:crypto";
import { feedsForCountry, type FeedSource } from "@/lib/rssSources";
import type { Article } from "./types";

const parser = new Parser({ timeout: 8000 });

function articleId(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Enough to read as a summary card without being the raw HTML-laden
// <description> some feeds ship (e.g. embedded <img> tags, extra whitespace).
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
      .map((item) => ({
        id: articleId(item.link!),
        title: stripHtml(item.title!),
        summary: toSummary(item),
        source: feed.name,
        url: item.link!,
        publishedAt: item.isoDate ?? item.pubDate ?? null,
        imageUrl: item.enclosure?.url ?? null,
      }));
  } catch {
    // One dead/slow feed shouldn't take down the whole country's results.
    return [];
  }
}

export async function fetchCountryNews(isoCode: string): Promise<Article[]> {
  const feeds = feedsForCountry(isoCode);
  const results = await Promise.all(feeds.map(fetchFeed));
  const articles = results.flat();

  // De-dupe (some feeds overlap on the same wire stories) and sort newest first.
  const seen = new Set<string>();
  const deduped = articles.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  deduped.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return deduped.slice(0, 30);
}
