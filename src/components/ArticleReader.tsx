/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion, useScroll, useTransform } from "motion/react";
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
  | { status: "ready"; text: string; html: string; byline: string | null; excerpt: string | null };

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
// Sub-component to ensure bodyRef is always mounted when useScroll is called
function ArticleReaderContent({
  article,
  isSpeaking,
  speechStatus,
  supported,
  onPlay,
  onPause,
  onResume,
  onStop,
}: ArticleReaderProps & { article: Article }) {
  const playing = isSpeaking && speechStatus === "speaking";
  const paused = isSpeaking && speechStatus === "paused";
  const bodyRef = useRef<HTMLDivElement>(null);
  useLenisScroll(bodyRef);

  const { scrollY } = useScroll({ container: bodyRef });
  const imgY = useTransform(scrollY, [0, 800], [0, 250]);
  const headlineScale = useTransform(scrollY, [0, 300], [1, 0.8]);
  const headlineY = useTransform(scrollY, [0, 300], [0, 40]);
  const headlineOpacity = useTransform(scrollY, [0, 300], [1, 0.85]);

  const [fullText, setFullText] = useState<FullTextState>({
    status: "loading",
  });
  const [imageError, setImageError] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    setImageError(false);
    setTranslatedText(null);
    setShowTranslation(false);
    setIsTranslating(false);
  }, [article]);

  useEffect(() => {
    let cancelled = false;
    setFullText({ status: "loading" });

    fetch(`/api/article?url=${encodeURIComponent(article.url)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("extraction failed");
        return res.json() as Promise<{ text: string; html: string; byline: string | null; excerpt: string | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setFullText({
            status: "ready",
            text: data.text,
            html: data.html,
            byline: data.byline,
            excerpt: data.excerpt,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFullText({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [article]);

  const handleTranslate = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    
    if (translatedText) {
      setShowTranslation(true);
      return;
    }

    if (fullText.status !== "ready") return;

    setIsTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fullText.text })
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      setTranslatedText(data.translatedText);
      setShowTranslation(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  const readableText =
    fullText.status === "ready" ? fullText.text : (article.summary ?? "");

  return (
    <Dialog.Portal>
      <Dialog.Content asChild>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          className="fixed inset-0 z-[61] flex w-full flex-col bg-[#000000]/90 backdrop-blur-3xl"
        >
          <div className="flex items-center justify-between border-b border-border/20 px-6 md:px-12 py-4">
            <span className="font-mono text-[10px] tracking-[0.3em] text-muted uppercase">
              Article Reader
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close article"
                className="rounded text-muted transition-colors hover:text-foreground hover:bg-white/5 p-2"
              >
                <svg
                  aria-hidden
                  width="16"
                  height="16"
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
            <div className="p-6 md:p-12 pb-24 max-w-[70ch] mx-auto">
              <div className="flex items-center justify-between gap-2 mb-8">
                <span className="font-mono text-[11px] tracking-[0.25em] text-accent uppercase">
                  {article.source}
                </span>
                {article.publishedAt && (
                  <span className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">
                    {timeAgo(article.publishedAt)}
                  </span>
                )}
              </div>

              <Dialog.Title asChild>
                <motion.h2 
                  className="font-serif text-4xl leading-[1.1] font-medium tracking-normal md:text-6xl text-foreground origin-top-left"
                  style={{ scale: headlineScale, y: headlineY, opacity: headlineOpacity }}
                >
                  {article.title}
                </motion.h2>
              </Dialog.Title>

              <Dialog.Description className="sr-only">
                {article.summary || `Read full article from ${article.source}`}
              </Dialog.Description>

              {/* Article Image Banner - edge to edge */}
              {article.imageUrl && !imageError && (
                <div className="relative -mx-6 md:-mx-12 mt-10 mb-12 aspect-[21/9] border-y border-border/40 bg-black overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <motion.img
                    style={{ y: imgY, scale: 1.15 }}
                    src={article.imageUrl}
                    alt=""
                    className="object-cover w-full h-full opacity-90 origin-top"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-transparent to-transparent opacity-80" />
                </div>
              )}

              {!article.imageUrl && <div className="mt-10 mb-10 h-px bg-border/40" />}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12 pb-6 border-b border-border/40">
                <div>
                  {fullText.status === "ready" && fullText.byline && (
                    <p className="font-mono text-[12px] tracking-wider text-muted uppercase">
                      By <span className="text-foreground font-medium">{fullText.byline}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTranslate}
                    disabled={isTranslating}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] tracking-[0.15em] uppercase transition-all shadow-sm ${
                      showTranslation || isTranslating
                        ? "border-accent text-accent bg-accent/5"
                        : "border-border/60 bg-white/[0.02] text-muted hover:border-accent hover:text-accent hover:bg-accent/5"
                    }`}
                  >
                    {isTranslating ? (
                      <>
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Translating
                      </>
                    ) : showTranslation ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z" />
                        </svg>
                        Original
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
                        </svg>
                        Translate
                      </>
                    )}
                  </button>

                  {supported && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (playing) onPause();
                          else if (paused) onResume();
                          else onPlay(readableText);
                        }}
                        className="flex items-center gap-2 rounded-full border border-border/60 bg-white/[0.02] px-4 py-2 font-mono text-[11px] tracking-[0.15em] text-muted uppercase transition-all hover:border-accent hover:text-accent hover:bg-accent/5 shadow-sm"
                      >
                        {playing ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="5" y="4" width="5" height="16" rx="1" />
                              <rect x="14" y="4" width="5" height="16" rx="1" />
                            </svg>
                            Pause
                          </>
                        ) : paused ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 4l14 8-14 8V4z" />
                            </svg>
                            Resume
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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
                          className="rounded-full border border-border/60 bg-white/[0.02] p-2 text-muted transition-colors hover:border-red-400 hover:text-red-400"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="5" y="5" width="14" height="14" rx="1.5" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {fullText.status === "loading" && (
                <div className="space-y-4" aria-live="polite" aria-busy="true">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-4 animate-pulse rounded bg-white/[0.03]"
                      style={{ width: `${Math.max(60, 95 - i * 8)}%` }}
                    />
                  ))}
                </div>
              )}

              {fullText.status === "ready" && (
                <div className="animate-in fade-in duration-700">
                  {article.summary && (
                    <div className="mb-10 rounded-xl bg-accent/5 border border-accent/20 p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        <span className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase font-semibold">
                          AI Summary
                        </span>
                      </div>
                      <p className="text-base leading-relaxed text-foreground/90 font-medium">
                        {article.summary}
                      </p>
                    </div>
                  )}

                  {fullText.excerpt && !showTranslation && (
                    <p className="text-xl leading-relaxed text-muted/90 mb-10 font-serif italic border-l-2 border-accent pl-6">
                      {fullText.excerpt}
                    </p>
                  )}
                  {showTranslation && translatedText ? (
                    <div className="article-body text-foreground/90 font-serif text-lg leading-relaxed space-y-6">
                      {translatedText.split("\n").map((paragraph, i) => (
                        paragraph.trim() ? <p key={i}>{paragraph}</p> : null
                      ))}
                    </div>
                  ) : (
                    <div
                      className="article-body"
                      dangerouslySetInnerHTML={{ __html: fullText.html }}
                    />
                  )}
                </div>
              )}

              {fullText.status === "unavailable" && (
                <div className="rounded-xl border border-border/50 bg-white/[0.02] p-8 text-center mt-8">
                  <p className="font-mono text-[12px] tracking-[0.2em] text-muted uppercase mb-4">
                    Full text unavailable
                  </p>
                  {article.summary && (
                    <p className="text-base leading-relaxed text-muted/80 max-w-lg mx-auto mb-8">
                      {article.summary}
                    </p>
                  )}
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-6 py-3 font-mono text-[12px] tracking-[0.1em] text-accent uppercase transition-all hover:bg-accent hover:text-black shadow-[0_0_15px_rgba(255,212,0,0.15)] hover:shadow-[0_0_25px_rgba(255,212,0,0.3)]"
                  >
                    Read Full Article on Source
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export default function ArticleReader(props: ArticleReaderProps) {
  return (
    <Dialog.Root open={!!props.article} onOpenChange={props.onOpenChange}>
      {props.article && <ArticleReaderContent {...props} article={props.article} />}
    </Dialog.Root>
  );
}
