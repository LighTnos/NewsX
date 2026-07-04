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
import Starfield from "@/components/Starfield";
import {
  countryCentroid,
  countryId,
  countryName,
  loadCountries,
  type CountryFeature,
} from "@/lib/countries";

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

const TICKER_PHRASES = [
  "Live orbital news network",
  "Press Ctrl K to acquire a target",
  "All regions monitored",
  "Signal nominal",
];

export default function GlobeExplorer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const preloaderRef = useRef<HTMLDivElement>(null);
  const globeWrapRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [selected, setSelected] = useState<CountryFeature | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);

  // Move focus into the panel when a country is selected so keyboard/screen
  // reader users land somewhere meaningful instead of only getting a
  // silent visual change (mirrors what a route change would do). Deferred a
  // frame so it reliably wins against the command palette's own
  // return-focus-to-trigger behavior on close.
  useEffect(() => {
    if (!selected) return;
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
          .to(preloaderRef.current, { autoAlpha: 0, duration: 0.5 })
          .to(
            globeWrapRef.current,
            { autoAlpha: 1, scale: 1, duration: 1.4, ease: "power2.out" },
            "-=0.1"
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
        gsap.set(preloaderRef.current, { autoAlpha: 0 });
        gsap.set([globeWrapRef.current, heroRef.current, ".chrome-fade"], {
          autoAlpha: 1,
          scale: 1,
        });
      });
    },
    { dependencies: [globeReady], scope: rootRef }
  );

  const coords = selected ? countryCentroid(selected) : null;

  return (
    <MotionConfig reducedMotion="user">
    <div ref={rootRef} className="relative h-dvh w-full overflow-hidden">
      <CustomCursor />
      <Starfield />

      {/* Faint seat glow keeping the globe from floating in a void */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 60% 48%, rgba(150,170,210,0.09), transparent 55%)",
        }}
      />

      {/* Oversized, offset globe — cropped like an editorial spread */}
      <div
        ref={globeWrapRef}
        className="absolute inset-0 opacity-0"
        style={{ transform: "scale(0.94)" }}
      >
        <div className="absolute top-1/2 left-1/2 h-[110vmin] w-[110vmin] -translate-x-1/2 -translate-y-1/2 md:top-[54%] md:left-[60%]">
          <GlobeCanvas
            countries={countries}
            selected={selected}
            onSelect={setSelected}
            onReady={handleGlobeReady}
          />
        </div>
      </div>

      <div className="grain-overlay" aria-hidden />
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
          NEWS<span className="text-accent">X</span>
        </span>
        <div className="pointer-events-auto">
          <CountryCommand countries={countries} onSelect={setSelected} />
        </div>
      </header>

      {/* Idle instruction — hides once a country is locked in */}
      <div
        ref={heroRef}
        className={`pointer-events-none absolute bottom-24 left-6 z-10 opacity-0 md:bottom-28 md:left-10 ${
          selected ? "hidden md:block" : ""
        }`}
      >
        <p
          ref={headlineRef}
          className="chrome-fade font-mono text-[11px] tracking-[0.3em] text-muted uppercase"
        >
          Rotate the globe or press{" "}
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] tracking-wider normal-case">
            Ctrl K
          </kbd>{" "}
          to select a country
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
        className="absolute inset-x-4 bottom-14 z-10 max-h-[78vh] md:inset-x-auto md:top-24 md:right-10 md:bottom-16 md:w-95"
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
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="glass-panel overflow-hidden rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
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
              <div className="p-5">
                <div className="h-0.5 w-10 bg-accent" />
                <h2
                  ref={panelHeadingRef}
                  tabIndex={-1}
                  className="font-display mt-4 text-3xl font-medium tracking-tight outline-none"
                >
                  {countryName(selected)}
                </h2>
                <div className="mt-3 flex gap-5 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
                  <span suppressHydrationWarning>
                    {coords ? formatCoords(coords.lat, coords.lng) : ""}
                  </span>
                  <span>ID {countryId(selected)}</span>
                </div>
                <div className="mt-5 h-px bg-border" />
                <NewsFeedPanel
                  countryCode={countryId(selected)}
                  countryName={countryName(selected)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>

      {/* Mission-control HUD bar with marquee */}
      <footer className="chrome-fade absolute inset-x-0 bottom-0 z-10 flex h-9 items-center gap-6 border-t border-border bg-background/40 px-4 font-mono text-[10px] tracking-[0.2em] text-muted uppercase backdrop-blur-md md:px-10">
        <UtcClock />
        <div
          aria-hidden
          className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
        >
          <div className="marquee-track gap-12">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 gap-12">
                {TICKER_PHRASES.map((phrase) => (
                  <span key={phrase} className="whitespace-nowrap">
                    {phrase} <span className="text-accent">//</span>
                  </span>
                ))}
                <span className="whitespace-nowrap">
                  {countries.length || "—"} regions tracked{" "}
                  <span className="text-accent">//</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <span suppressHydrationWarning className="whitespace-nowrap">
          {selected && coords
            ? `${countryName(selected)} · ${formatCoords(coords.lat, coords.lng)}`
            : "No target"}
        </span>
      </footer>

      {/* Preloader — lifts once the globe texture is ready */}
      <div
        ref={preloaderRef}
        className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-background"
      >
        <span className="font-display text-lg font-bold tracking-[0.45em]">
          NEWS<span className="text-accent">X</span>
        </span>
        <span className="preloader-blink font-mono text-[10px] tracking-[0.4em] text-muted uppercase">
          Initializing orbit
        </span>
      </div>
    </div>
    </MotionConfig>
  );
}
