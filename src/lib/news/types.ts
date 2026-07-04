export interface Article {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string | null;
  imageUrl: string | null;
}

export interface NewsResponse {
  country: string;
  articles: Article[];
  source: "rss" | "newsdata";
  fetchedAt: string;
}
