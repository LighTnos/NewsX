"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import ScrambleText from "./ScrambleText";

interface PreloaderProps {
  isReady: boolean;
}

export default function Preloader({ isReady }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const [shouldUnmount, setShouldUnmount] = useState(false);

  useEffect(() => {
    // Cinematic fast count up to 99%
    let start = 0;
    const duration = 1200; // ms
    const startTime = Date.now();
    
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const normalized = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const ease = normalized === 1 ? 1 : 1 - Math.pow(2, -10 * normalized);
      start = Math.floor(ease * 99);
      setProgress(start);
      if (normalized < 1) {
        requestAnimationFrame(tick);
      }
    };
    
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isReady && progress >= 99) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(100);
      setTimeout(() => setShouldUnmount(true), 400); // Hold at 100% for a beat
    } else if (isReady) {
      // If globe is ready before counter finishes, wait for it
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 99) {
            clearInterval(interval);
            setTimeout(() => setShouldUnmount(true), 400);
            return 100;
          }
          return p;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isReady, progress]);

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
                {progress === 100 ? "Orbit Established" : "Initializing Orbit"}
              </span>
              
              <div className="relative w-48 h-[1px] bg-white/10 overflow-hidden">
                <motion.div 
                  className="absolute top-0 left-0 bottom-0 bg-accent"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              </div>
              
              <span className="font-mono text-sm tracking-widest text-foreground font-medium">
                {progress.toString().padStart(3, "0")}%
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
