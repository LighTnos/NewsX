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
    return [];
  }
}

function writeStorage(bookmarks: Article[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Article[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBookmarks(readStorage());
      setHydrated(true);
    }, 0);

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
