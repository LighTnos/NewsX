"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import type { Article } from "@/lib/news/types";

interface BookmarksPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookmarks: Article[];
  onOpenArticle: (article: Article) => void;
  onRemove: (article: Article) => void;
}

// Saved-articles list, opened from the header. Bookmarks persist per-browser
// via localStorage (see useBookmarks) — no accounts, no backend.
export default function BookmarksPanel({
  open,
  onOpenChange,
  bookmarks,
  onOpenArticle,
  onRemove,
}: BookmarksPanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 280, damping: 30 }}
                className="glass-panel fixed inset-y-0 right-0 z-[71] flex w-full flex-col md:w-[420px]"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
                  <Dialog.Title className="font-mono text-[10px] tracking-[0.3em] text-muted uppercase">
                    Saved articles
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close saved articles"
                      className="rounded p-2 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
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

                <Dialog.Description className="sr-only">
                  Your bookmarked news articles, saved in this browser.
                </Dialog.Description>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {bookmarks.length === 0 ? (
                    <div className="mt-10 px-4 text-center">
                      <svg
                        aria-hidden
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mx-auto text-muted/50"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                      <p className="mt-4 text-sm text-muted">
                        No saved articles yet.
                      </p>
                      <p className="mt-1 text-xs text-muted/70">
                        Tap the bookmark icon on any story to save it here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bookmarks.map((article) => (
                        <div
                          key={article.id}
                          className="group rounded-lg border border-border bg-white/[0.02] p-3 transition-colors hover:border-accent/40 hover:bg-white/[0.045]"
                        >
                          <span className="font-mono text-[9px] tracking-[0.2em] text-accent uppercase">
                            {article.source}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenArticle(article)}
                            className="mt-1.5 block w-full text-left"
                          >
                            <h3 className="text-sm leading-snug font-medium text-foreground group-hover:text-accent">
                              {article.title}
                            </h3>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemove(article)}
                            className="mt-2.5 flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-muted uppercase transition-colors hover:border-red-400/50 hover:text-red-300"
                          >
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                            >
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
