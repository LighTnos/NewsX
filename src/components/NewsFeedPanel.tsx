"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Article, NewsResponse } from "@/lib/news/types";
import { useLenisScroll } from "@/lib/useLenisScroll";
import type { useSpeech } from "@/lib/useSpeech";

interface NewsFeedPanelProps {
  countryCode: string;
  countryName: string;
  setOpenArticle: (article: Article | null) => void;
  speech: ReturnType<typeof useSpeech>;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (article: Article) => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - Date.parse(iso);
  if (Number.isNaN(diffMs)) return "";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const CATEGORIES = ["top", "business", "technology", "sports", "entertainment", "health"];

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; articles: Article[] };

interface ListenButtonProps {
  article: Article;
  isActive: boolean;
  status: "idle" | "speaking" | "paused";
  supported: boolean;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function ListenButton({
  article,
  isActive,
  status,
  supported,
  onPlay,
  onPause,
  onResume,
  onStop,
}: ListenButtonProps) {
  if (!supported) return null;

  const playing = isActive && status === "speaking";
  const paused = isActive && status === "paused";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        data-cursor
        aria-label={
          playing
            ? `Pause listening to ${article.title}`
            : paused
              ? `Resume listening to ${article.title}`
              : `Listen to ${article.title}`
        }
        onClick={(e) => {
          e.preventDefault();
          if (playing) onPause();
          else if (paused) onResume();
          else onPlay();
        }}
        className="flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-muted uppercase transition-colors hover:border-accent/50 hover:text-foreground"
      >
        {playing ? (
          <>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="5" height="16" rx="1" />
              <rect x="14" y="4" width="5" height="16" rx="1" />
            </svg>
            Pause
          </>
        ) : paused ? (
          <>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
            Resume
          </>
        ) : (
          <>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l14 8-14 8V4z" />
            </svg>
            Listen
          </>
        )}
      </button>
      {isActive && status !== "idle" && (
        <button
          type="button"
          data-cursor
          aria-label="Stop listening"
          onClick={(e) => {
            e.preventDefault();
            onStop();
          }}
          className="rounded-full border border-border bg-white/[0.03] p-1 text-muted transition-colors hover:border-accent/50 hover:text-foreground"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="1.5" />
          </svg>
        </button>
      )}
    </div>
  );
}

function BookmarkButton({
  article,
  isBookmarked,
  onToggle,
}: {
  article: Article;
  isBookmarked: boolean;
  onToggle: (article: Article) => void;
}) {
  return (
    <button
      type="button"
      data-cursor
      aria-pressed={isBookmarked}
      aria-label={
        isBookmarked
          ? `Remove ${article.title} from bookmarks`
          : `Bookmark ${article.title}`
      }
      onClick={(e) => {
        e.preventDefault();
        onToggle(article);
      }}
      className={`shrink-0 rounded-full border p-1.5 transition-colors ${
        isBookmarked
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-border bg-white/[0.03] text-muted hover:border-accent/50 hover:text-foreground"
      }`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill={isBookmarked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

export default function NewsFeedPanel({
  countryCode,
  countryName,
  setOpenArticle,
  speech,
  isBookmarked,
  onToggleBookmark,
}: NewsFeedPanelProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [category, setCategory] = useState("top");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useLenisScroll(listRef);

  // Filters the already-loaded feed client-side — no extra API calls, no
  // quota risk. A genuinely global cross-country search would need
  // NewsData.io's separate /news search endpoint, which is a bigger, riskier
  // change (different quota, different response shape) left for later.
  const filteredArticles = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.articles;
    return state.articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q)
    );
  }, [state, query]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
    speech.stop();

    fetch(`/api/news?country=${countryCode}&name=${encodeURIComponent(countryName)}&category=${category}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
        return res.json() as Promise<NewsResponse>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", articles: data.articles });
      })
      .catch((err: Error) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err.message || "Could not load news.",
          });
      });

    return () => {
      cancelled = true;
    };
    // speech.stop is stable (see useSpeech); only countryCode and category should
    // re-trigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, category]);

  return (
    <div className="mt-2 flex flex-col min-h-0 flex-1">
      <div className="flex shrink-0 items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.3em] text-muted uppercase">
          Live feed
        </p>
        {state.status === "ready" && (
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
            {query.trim()
              ? `${filteredArticles.length} of ${state.articles.length}`
              : `${state.articles.length} stories`}
          </span>
        )}
      </div>

      {state.status === "ready" && state.articles.length > 0 && (
        <div className="mt-2 flex gap-2 shrink-0 z-20 relative">
          <div className="relative flex-1">
            <svg
              aria-hidden
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${countryName}…`}
              aria-label={`Search ${countryName}'s headlines`}
              className="w-full h-[34px] rounded-lg border border-border bg-white/[0.02] pr-3 pl-8 text-sm text-foreground placeholder:text-muted focus-visible:border-accent/50 outline-none transition-colors"
            />
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              aria-label="Filter by category"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className={`flex h-[34px] items-center justify-center gap-1.5 rounded-lg border px-3 transition-colors ${
                category !== "top" 
                  ? "border-accent/50 bg-accent/10 text-accent" 
                  : "border-border bg-white/[0.02] text-muted hover:border-accent/40 hover:text-foreground"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {category !== "top" && (
                <span className="font-mono text-[9px] tracking-[0.1em] uppercase font-medium">{category}</span>
              )}
            </button>
            
            <AnimatePresence>
              {isCategoryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-1.5 w-[160px] overflow-hidden rounded-lg border border-border bg-[#0a0c10]/95 shadow-xl backdrop-blur-xl"
                >
                  <div className="flex flex-col py-1">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setCategory(cat);
                          setIsCategoryOpen(false);
                        }}
                        className={`flex items-center px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.15em] uppercase transition-colors ${
                          category === cat
                            ? "bg-accent/10 text-accent font-medium border-l-2 border-accent"
                            : "text-muted hover:bg-white/[0.04] hover:text-foreground border-l-2 border-transparent"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <div ref={listRef} className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="space-y-3">
        {state.status === "loading" && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton-glass h-[90px] w-full"
              />
            ))}
          </div>
        )}

        {state.status === "error" && (
          <p className="rounded-lg border border-border bg-white/[0.02] p-3 text-sm text-muted">
            {state.message} — try another country or check back shortly.
          </p>
        )}

        {state.status === "ready" && state.articles.length === 0 && (
          <p className="rounded-lg border border-border bg-white/[0.02] p-3 text-sm text-muted">
            No live coverage found for {countryName} right now.
          </p>
        )}

        {state.status === "ready" &&
          state.articles.length > 0 &&
          filteredArticles.length === 0 && (
            <p className="rounded-lg border border-border bg-white/[0.02] p-3 text-sm text-muted">
              No headlines match &ldquo;{query}&rdquo;.
            </p>
          )}

        {state.status === "ready" && (
          <AnimatePresence initial={false}>
            {filteredArticles.map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35 }}
                className="group rounded-lg border border-border bg-white/[0.02] p-3 transition-colors hover:border-accent/40 hover:bg-white/[0.045]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-accent uppercase">
                    {article.source}
                  </span>
                  {article.publishedAt && (
                    <span className="font-mono text-[9px] tracking-[0.15em] text-muted uppercase">
                      {timeAgo(article.publishedAt)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenArticle(article)}
                  className="block w-full text-left"
                >
                  <h3 className="mt-1.5 text-base leading-snug font-medium text-foreground group-hover:text-accent">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted">
                      {article.summary}
                    </p>
                  )}
                </button>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <ListenButton
                    article={article}
                    isActive={speech.activeId === article.id}
                    status={speech.status}
                    supported={speech.supported}
                    onPlay={() =>
                      speech.speak(
                        article.id,
                        `${article.title}. ${article.summary}`
                      )
                    }
                    onPause={speech.pause}
                    onResume={speech.resume}
                    onStop={speech.stop}
                  />
                  <BookmarkButton
                    article={article}
                    isBookmarked={isBookmarked(article.id)}
                    onToggle={onToggleBookmark}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        </div>
      </div>
    </div>
  );
}
