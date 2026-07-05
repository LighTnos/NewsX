"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import GlobeCanvas from "@/components/GlobeCanvas";
import CountryCommand from "@/components/CountryCommand";
import CustomCursor from "@/components/CustomCursor";
import NewsFeedPanel from "@/components/NewsFeedPanel";
import ArticleReader from "@/components/ArticleReader";
import BookmarksPanel from "@/components/BookmarksPanel";
import Starfield from "@/components/Starfield";
import ScrambleText from "@/components/ScrambleText";
import Preloader from "@/components/Preloader";
import {
  countryCentroid,
  countryId,
  countryName,
  loadCountries,
  type CountryFeature,
} from "@/lib/countries";
import type { Article } from "@/lib/news/types";
import { useSpeech } from "@/lib/useSpeech";
import { useBookmarks } from "@/lib/useBookmarks";

gsap.registerPlugin(useGSAP, SplitText);

function formatCoords(lat: number, lng: number): string {
  const la = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const lo = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
  return `${la} ${lo}`;
}

function UtcClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span suppressHydrationWarning>UTC {time ?? "--:--:--"}</span>;
}



export default function GlobeExplorer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const globeWrapRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [allowGlobeMount, setAllowGlobeMount] = useState(false);

  // One speech engine and one bookmark store for the whole app, so playback
  // and the article reader survive country switches (NewsFeedPanel remounts
  // per country) and bookmarks are reachable even with no country selected.
  const speech = useSpeech();
  const { bookmarks, isBookmarked, toggleBookmark } = useBookmarks();

  // Move focus into the panel when a country is selected so keyboard/screen
  // reader users land somewhere meaningful instead of only getting a
  // silent visual change (mirrors what a route change would do). Deferred a
  // frame so it reliably wins against the command palette's own
  // return-focus-to-trigger behavior on close.
  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenArticle(null);
    const raf = requestAnimationFrame(() => panelHeadingRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  useEffect(() => {
    loadCountries()
      .then(setCountries)
      .catch(() => setError("Could not load country data."));
  }, []);

  const handleGlobeReady = useCallback(() => setGlobeReady(true), []);

  // Entrance: preloader lifts, globe scales/fades in, headline reveals word
  // by word, then UI chrome fades up. Reduced motion snaps to final state.
  useGSAP(
    () => {
      if (!globeReady) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(headlineRef.current, {
          type: "words",
          mask: "words",
        });
        gsap
          .timeline()
          .to(
            globeWrapRef.current,
            { autoAlpha: 1, scale: 1, duration: 1.4, ease: "power2.out", delay: 0.8 }
          )
          .set(heroRef.current, { autoAlpha: 1 }, "-=0.9")
          .from(
            split.words,
            {
              yPercent: 110,
              autoAlpha: 0,
              stagger: 0.07,
              duration: 0.7,
              ease: "power3.out",
            },
            "-=0.9"
          )
          .to(
            ".chrome-fade",
            { autoAlpha: 1, duration: 0.6, stagger: 0.06 },
            "-=0.35"
          );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([globeWrapRef.current, heroRef.current, ".chrome-fade"], {
          autoAlpha: 1,
          scale: 1,
        });
      });
    },
    { dependencies: [globeReady], scope: rootRef }
  );

  useEffect(() => {
    if (!globeReady || !heroRef.current) return;
    if (selected) {
      gsap.to(heroRef.current, { autoAlpha: 0, duration: 0.4 });
    } else {
      gsap.to(heroRef.current, { autoAlpha: 1, duration: 0.6, delay: 0.2 });
    }
  }, [selected, globeReady]);

  const coords = selected ? countryCentroid(selected) : null;

  return (
    <MotionConfig reducedMotion="user">
    <div ref={rootRef} className="relative h-dvh w-full overflow-hidden select-none">
      <CustomCursor />
      <Starfield />

      {/* Subtle, static ambient glow to prevent GPU layout trashing */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(76,141,255,0.05), transparent 70%)"
        }}
      />

      {/* Oversized, offset globe — cropped like an editorial spread */}
      <div
        ref={globeWrapRef}
        className="absolute inset-0 opacity-0 transition-all duration-1000 ease-in-out"
        style={{ transform: "scale(0.94)" }}
      >
        <div className={`absolute top-1/2 left-1/2 h-[100vh] w-[100vw] -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out ${
          selected
            ? "md:top-[54%] md:left-[35%]"
            : "md:top-[54%] md:left-[60%]"
        }`}>
          {allowGlobeMount && (
            <GlobeCanvas
              countries={countries}
              selected={selected}
              onSelect={setSelected}
              onReady={handleGlobeReady}
            />
          )}
        </div>
      </div>

      <div className="vignette-overlay" aria-hidden />

      {/* Frame details */}
      <span className="chrome-fade pointer-events-none absolute top-[76px] left-6 z-10 hidden font-mono text-xs text-muted/40 md:block">
        +
      </span>
      <span className="chrome-fade pointer-events-none absolute top-[76px] right-6 z-10 hidden font-mono text-xs text-muted/40 md:block">
        +
      </span>
      <span className="chrome-fade pointer-events-none absolute bottom-12 left-6 z-10 hidden font-mono text-xs text-muted/40 md:block">
        +
      </span>
      <span className="chrome-fade pointer-events-none absolute right-6 bottom-12 z-10 hidden font-mono text-xs text-muted/40 md:block">
        +
      </span>
      <div className="chrome-fade pointer-events-none absolute top-1/2 right-4 z-10 hidden -translate-y-1/2 lg:block">
        <span className="font-mono text-[10px] tracking-[0.45em] text-muted/60 uppercase [writing-mode:vertical-rl]">
          Live orbital feed — 24/7
        </span>
      </div>

      {/* Header: wordmark / nav / search */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-6 md:px-10 md:py-6">
        <span className="chrome-fade font-display pointer-events-auto text-sm font-bold tracking-[0.35em]">
          <ScrambleText text="NEWS" delay={600} /><span className="text-accent">X</span>
        </span>
        <div className="chrome-fade pointer-events-auto flex items-center gap-2">
          <CountryCommand countries={countries} onSelect={setSelected} />
          <button
            type="button"
            onClick={() => setBookmarksOpen(true)}
            aria-label={`Saved articles (${bookmarks.length})`}
            className="glass-panel relative flex items-center gap-2 rounded-lg px-3 py-2 text-muted transition-colors hover:text-foreground"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {bookmarks.length > 0 && (
              <span className="font-mono text-[11px] tracking-wider">
                {bookmarks.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Idle instruction — hides once a country is locked in */}
      <div
        ref={heroRef}
        className="pointer-events-none absolute bottom-24 left-6 z-10 opacity-0 md:bottom-28 md:left-10"
      >
        <p
          ref={headlineRef}
          className="chrome-fade font-mono text-[11px] tracking-[0.3em] text-muted uppercase"
        >
          Tap a country or search to begin
        </p>
      </div>

      {/* Concise screen-reader announcement, separate from the visual panel
          so assistive tech isn't forced to read the full chrome/HUD markup
          every time the selection changes. */}
      <p className="sr-only" aria-live="polite">
        {selected ? `Now showing news for ${countryName(selected)}.` : ""}
      </p>

      {/* Selected country — structured target panel */}
      <aside
        aria-label="Selected country details"
        className="pointer-events-none absolute inset-x-0 top-24 bottom-9 z-10 md:inset-x-auto md:top-20 md:right-12 md:bottom-10 md:w-[480px]"
      >
        {error && (
          <div className="glass-panel rounded-xl p-4 text-sm text-red-300">
            {error}
          </div>
        )}
        <AnimatePresence mode="wait">
          {selected && !error && (
            <motion.div
              key={countryId(selected)}
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ 
                opacity: openArticle ? 0 : 1, 
                y: openArticle ? 12 : 0, 
                scale: openArticle ? 0.98 : 1,
              }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className={`pointer-events-auto glass-panel flex h-full flex-col overflow-hidden rounded-t-3xl md:rounded-2xl ${openArticle ? "!pointer-events-none" : ""}`}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3 md:px-4 md:py-2.5">
                <span className="font-mono text-[10px] tracking-[0.3em] text-muted uppercase">
                  Target lock
                </span>
                <button
                  type="button"
                  aria-label="Clear selection"
                  onClick={() => setSelected(null)}
                  className="rounded text-muted transition-colors hover:text-foreground"
                >
                  <svg
                    aria-hidden
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-5 py-5 md:px-5 md:py-4">
                <div className="h-0.5 w-10 shrink-0 bg-accent" />
                <h2
                  ref={panelHeadingRef}
                  tabIndex={-1}
                  className="font-display mt-3 shrink-0 text-3xl font-medium tracking-tight outline-none"
                >
                  <ScrambleText text={countryName(selected)} />
                </h2>
                <div className="mt-2 flex shrink-0 gap-5 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
                  <span suppressHydrationWarning>
                    {coords ? <ScrambleText text={formatCoords(coords.lat, coords.lng)} /> : ""}
                  </span>
                  <span>ID {countryId(selected)}</span>
                </div>
                <div className="mt-4 h-px shrink-0 bg-border" />
                <NewsFeedPanel
                  key={countryId(selected)}
                  countryCode={countryId(selected)}
                  countryName={countryName(selected)}
                  setOpenArticle={setOpenArticle}
                  speech={speech}
                  isBookmarked={isBookmarked}
                  onToggleBookmark={toggleBookmark}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* Mission-control HUD bar */}
      <footer className="chrome-fade absolute inset-x-0 bottom-0 z-10 flex justify-between h-9 items-center gap-6 border-t border-border bg-background/40 px-4 font-mono text-[10px] tracking-[0.2em] text-muted uppercase backdrop-blur-md md:px-10">
        <UtcClock />
        <span suppressHydrationWarning className="whitespace-nowrap">
          {selected && coords
            ? `${countryName(selected)} · ${formatCoords(coords.lat, coords.lng)}`
            : "No target"}
        </span>
      </footer>

      {/* Article reader — one instance at the top level so it works whether
          opened from a country's feed or from saved articles, and survives
          country switches (the feed panel remounts per country). */}
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

      <BookmarksPanel
        open={bookmarksOpen}
        onOpenChange={setBookmarksOpen}
        bookmarks={bookmarks}
        onOpenArticle={(article) => {
          setBookmarksOpen(false);
          setOpenArticle(article);
        }}
        onRemove={toggleBookmark}
      />

      <Preloader 
        isReady={globeReady} 
        onAlmostDone={() => setAllowGlobeMount(true)} 
      />
    </div>
    </MotionConfig>
  );
}
