"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import ArticleReader from "@/components/ArticleReader";
import type { Article, NewsResponse } from "@/lib/news/types";
import { useLenisScroll } from "@/lib/useLenisScroll";
import { useSpeech } from "@/lib/useSpeech";

interface NewsFeedPanelProps {
  countryCode: string;
  countryName: string;
  openArticle: Article | null;
  setOpenArticle: (article: Article | null) => void;
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

export default function NewsFeedPanel({
  countryCode,
  countryName,
  openArticle,
  setOpenArticle,
}: NewsFeedPanelProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [category, setCategory] = useState("top");
  const speech = useSpeech();
  const listRef = useRef<HTMLDivElement>(null);
  useLenisScroll(listRef);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" });
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
    <div className="mt-5 flex flex-col min-h-0 flex-1">
      <div className="flex shrink-0 items-center justify-between mt-2">
        <p className="font-mono text-[10px] tracking-[0.3em] text-muted uppercase">
          Live feed
        </p>
        {state.status === "ready" && (
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
            {state.articles.length} stories
          </span>
        )}
      </div>

      <div className="mt-4 mb-2 flex flex-wrap gap-2 pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-[9px] tracking-[0.15em] uppercase transition-colors border ${
              category === cat
                ? "bg-accent/20 border-accent text-accent"
                : "bg-white/[0.02] border-border text-muted hover:text-foreground hover:border-accent/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div ref={listRef} className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="space-y-3">
        {state.status === "loading" && (
          <div className="space-y-3" aria-live="polite" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-lg border border-border bg-white/[0.03]"
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

        {state.status === "ready" && (
          <AnimatePresence initial={false}>
            {state.articles.map((article, i) => (
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
                  <h3 className="mt-1.5 text-sm leading-snug font-medium text-foreground group-hover:text-accent">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                      {article.summary}
                    </p>
                  )}
                </button>
                <div className="mt-2.5">
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
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        </div>
      </div>

      <ArticleReader
        article={openArticle}
        onOpenChange={(open) => {
          if (!open) setOpenArticle(null);
        }}
        isSpeaking={!!openArticle && speech.activeId === openArticle.id}
        speechStatus={speech.status}
        supported={speech.supported}
        onPlay={(text) => openArticle && speech.speak(openArticle.id, text)}
        onPause={speech.pause}
        onResume={speech.resume}
        onStop={speech.stop}
      />
    </div>
  );
}
