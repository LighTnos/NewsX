"use client";

import { useCallback, useEffect, useState } from "react";
import type { Article } from "@/lib/news/types";

const STORAGE_KEY = "newsx:bookmarks";

function readStorage(): Article[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt/foreign data in the slot — treat as empty rather than crash.
    return [];
  }
}

function writeStorage(bookmarks: Article[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // Storage full or unavailable (private browsing in some browsers) —
    // bookmarking silently becomes a no-op rather than crashing the app.
  }
}

// Client-only saved-articles list, persisted to localStorage. No backend —
// bookmarks are per-browser, which is the right scope for a portfolio demo
// with no user accounts.
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Article[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading local storage on mount avoids server/client hydration mismatch.
    // The timeout avoids React Compiler's cascading render error.
    const timer = setTimeout(() => {
      setBookmarks(readStorage());
      setHydrated(true);
    }, 0);

    // Keep in sync across tabs/windows.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setBookmarks(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((a) => a.id === id),
    [bookmarks]
  );

  const toggleBookmark = useCallback((article: Article) => {
    setBookmarks((prev) => {
      const next = prev.some((a) => a.id === article.id)
        ? prev.filter((a) => a.id !== article.id)
        : [article, ...prev];
      writeStorage(next);
      return next;
    });
  }, []);

  return { bookmarks, hydrated, isBookmarked, toggleBookmark };
}
