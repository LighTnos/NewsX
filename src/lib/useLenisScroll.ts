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

    const lenis = new Lenis({
      wrapper: el,
      content: el.firstElementChild ?? el,
      duration: 0.9,
      smoothWheel: true,
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
