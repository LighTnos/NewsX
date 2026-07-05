"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, animate, useTransform } from "motion/react";
import ScrambleText from "./ScrambleText";

interface PreloaderProps {
  isReady: boolean;
  onAlmostDone?: () => void;
}

export default function Preloader({ isReady, onAlmostDone }: PreloaderProps) {
  const [shouldUnmount, setShouldUnmount] = useState(false);
  const count = useMotionValue(0);
  const displayProgress = useTransform(count, (latest) =>
    Math.round(latest).toString().padStart(3, "0") + "%"
  );
  const widthProgress = useTransform(count, (latest) => `${latest}%`);
  const [phase, setPhase] = useState<"initializing" | "ready">("initializing");

  const onAlmostDoneRef = useRef(onAlmostDone);
  useEffect(() => {
    onAlmostDoneRef.current = onAlmostDone;
  }, [onAlmostDone]);

  useEffect(() => {
    // Animate to 99% quickly
    const controls = animate(count, 99, {
      duration: 1.2,
      ease: "easeOut",
      onComplete: () => {
        if (onAlmostDoneRef.current) onAlmostDoneRef.current();
      }
    });
    return controls.stop;
  }, [count]);

  useEffect(() => {
    if (isReady) {
      animate(count, 100, {
        duration: 0.3,
        onComplete: () => {
          setPhase("ready");
          setTimeout(() => setShouldUnmount(true), 400);
        }
      });
    }
  }, [isReady, count]);

  return (
    <AnimatePresence>
      {!shouldUnmount && (
        <motion.div
          initial={{ y: 0 }}
          exit={{ 
            y: "-100%", 
            transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } 
          }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#000000]"
        >
          <div className="flex flex-col items-center gap-8">
            <span className="font-display text-2xl font-bold tracking-[0.5em]">
              <ScrambleText text="NEWS" delay={200} /><span className="text-accent">X</span>
            </span>
            
            <div className="flex flex-col items-center gap-4">
              <span className="font-mono text-[10px] tracking-[0.4em] text-muted uppercase">
                {phase === "ready" ? "Orbit Established" : "Initializing Orbit"}
              </span>
              
              <div className="relative w-48 h-[1px] bg-white/10 overflow-hidden">
                <motion.div 
                  className="absolute top-0 left-0 bottom-0 bg-accent"
                  style={{ width: widthProgress }}
                />
              </div>
              
              <motion.span className="font-mono text-sm tracking-widest text-foreground font-medium">
                {displayProgress}
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
