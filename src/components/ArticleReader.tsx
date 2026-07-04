"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Article } from "@/lib/news/types";
import { useLenisScroll } from "@/lib/useLenisScroll";
import type { SpeechStatus } from "@/lib/useSpeech";

interface ArticleReaderProps {
  article: Article | null;
  onOpenChange: (open: boolean) => void;
  isSpeaking: boolean;
  speechStatus: SpeechStatus;
  supported: boolean;
  onPlay: (text: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

type FullTextState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; text: string };

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

// In-app reader for an article: fetches and shows the full extracted
// article text (via /api/article, server-side Readability extraction) so
// reading happens entirely on NewsX — no link out to the source. Falls back
// to the short summary when extraction fails (paywalls, JS-heavy sites).
export default function ArticleReader({
  article,
  onOpenChange,
  isSpeaking,
  speechStatus,
  supported,
  onPlay,
  onPause,
  onResume,
  onStop,
}: ArticleReaderProps) {
  const playing = isSpeaking && speechStatus === "speaking";
  const paused = isSpeaking && speechStatus === "paused";
  const bodyRef = useRef<HTMLDivElement>(null);
  useLenisScroll(bodyRef);

  const [fullText, setFullText] = useState<FullTextState>({
    status: "loading",
  });

  useEffect(() => {
    if (!article) return;
    let cancelled = false;
    setFullText({ status: "loading" });

    fetch(`/api/article?url=${encodeURIComponent(article.url)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("extraction failed");
        return res.json() as Promise<{ text: string }>;
      })
      .then((data) => {
        if (!cancelled) setFullText({ status: "ready", text: data.text });
      })
      .catch(() => {
        if (!cancelled) setFullText({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [article]);

  const readableText =
    fullText.status === "ready" ? fullText.text : (article?.summary ?? "");

  return (
    <Dialog.Root open={!!article} onOpenChange={onOpenChange}>
      {article && (
        <Dialog.Portal>
          <Dialog.Overlay asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
          </Dialog.Overlay>
          <Dialog.Content asChild>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              className="glass-panel fixed inset-y-0 right-0 z-[61] flex w-full flex-col md:w-[min(560px,45vw)]"
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <span className="font-mono text-[10px] tracking-[0.3em] text-muted uppercase">
                  Article
                </span>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close article"
                    className="rounded text-muted transition-colors hover:text-foreground"
                  >
                    <svg
                      aria-hidden
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </Dialog.Close>
              </div>

              <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="p-6 md:p-8">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">
                      {article.source}
                    </span>
                    {article.publishedAt && (
                      <span className="font-mono text-[10px] tracking-[0.15em] text-muted uppercase">
                        {timeAgo(article.publishedAt)}
                      </span>
                    )}
                  </div>

                  <Dialog.Title className="font-display mt-3 text-2xl leading-tight font-medium tracking-tight md:text-3xl">
                    {article.title}
                  </Dialog.Title>

                  {supported && (
                    <div className="mt-6 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (playing) onPause();
                          else if (paused) onResume();
                          else onPlay(readableText);
                        }}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] text-muted uppercase transition-colors hover:border-accent/50 hover:text-foreground"
                      >
                        {playing ? (
                          <>
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <rect x="5" y="4" width="5" height="16" rx="1" />
                              <rect x="14" y="4" width="5" height="16" rx="1" />
                            </svg>
                            Pause
                          </>
                        ) : paused ? (
                          <>
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M6 4l14 8-14 8V4z" />
                            </svg>
                            Resume
                          </>
                        ) : (
                          <>
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M6 4l14 8-14 8V4z" />
                            </svg>
                            Listen
                          </>
                        )}
                      </button>
                      {isSpeaking && speechStatus !== "idle" && (
                        <button
                          type="button"
                          aria-label="Stop listening"
                          onClick={onStop}
                          className="rounded-full border border-border bg-white/[0.03] p-1.5 text-muted transition-colors hover:border-accent/50 hover:text-foreground"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <rect x="5" y="5" width="14" height="14" rx="1.5" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-6 h-px bg-border" />

                  {fullText.status === "loading" && (
                    <div
                      className="mt-6 space-y-3"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-4 animate-pulse rounded bg-white/[0.05]"
                          style={{ width: `${85 - i * 12}%` }}
                        />
                      ))}
                    </div>
                  )}

                  {fullText.status === "ready" && (
                    <Dialog.Description className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/90">
                      {fullText.text.split(/\n+/).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </Dialog.Description>
                  )}

                  {fullText.status === "unavailable" && (
                    <div className="mt-6">
                      <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
                        Full text unavailable
                      </p>
                      {article.summary && (
                        <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted">
                          {article.summary}
                        </Dialog.Description>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
