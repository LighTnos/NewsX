"use client";

import { useEffect, type RefObject } from "react";
import Lenis from "lenis";

// Applies Lenis momentum-scroll to a specific scrollable container (the news
// feed list, the article modal body) rather than the window — this app has
// no page scroll of its own, so Lenis only makes sense scoped to these
// internal panels.
export function useLenisScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Never use JS-based scrolling on mobile! It causes severe lag and touch conflicts.
    // Native mobile scrolling (iOS momentum, Android scroll) is hardware accelerated
    // and infinitely smoother than any JavaScript scroll engine.
    if (window.innerWidth < 768) {
      return;
    }

    const lenis = new Lenis({
      wrapper: el,
      content: el.firstElementChild ?? el,
      lerp: 0.06, // Provides a very fluid, "liquid" momentum feel
      smoothWheel: true,
      wheelMultiplier: 1.1,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [ref]);
}
