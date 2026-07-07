/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export default function CustomCursor({ active = true }: { active?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 500, damping: 38, mass: 0.3 });
  const springY = useSpring(mouseY, { stiffness: 500, damping: 38, mass: 0.3 });

  useEffect(() => {
    if (!active) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setEnabled(true);
    document.documentElement.classList.add("custom-cursor");
    return () => {
      setEnabled(false);
      document.documentElement.classList.remove("custom-cursor");
    };
  }, [active]);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: PointerEvent) => {
      setHasMoved(true);
      const target = e.target as HTMLElement;
      const interactive = target.closest(
        "a, button, [role='button'], input, select, [data-cursor], .interactive"
      );
      
      setIsHovering(!!interactive);

      if (interactive && interactive instanceof HTMLElement) {
        const rect = interactive.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        if (rect.width < 200 && rect.height < 60) {
          const pullX = e.clientX + (centerX - e.clientX) * 0.2;
          const pullY = e.clientY + (centerY - e.clientY) * 0.2;
          mouseX.set(pullX);
          mouseY.set(pullY);
          return;
        }
      }
      
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, mouseX, mouseY]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{ x: mouseX, y: mouseY, opacity: hasMoved ? 1 : 0 }}
      />
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9998] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40"
        style={{ x: springX, y: springY, opacity: hasMoved ? 1 : 0 }}
        animate={{
          scale: isHovering ? 1.6 : 1,
          backgroundColor: isHovering ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0)",
          borderColor: isHovering ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.4)"
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
    </>
  );
}
