"use client";

import { useEffect, useState, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  animate,
  useTransform,
} from "motion/react";

interface PreloaderProps {
  isReady: boolean;
  onAlmostDone?: () => void;
}

export default function Preloader({ isReady, onAlmostDone }: PreloaderProps) {
  const [shouldUnmount, setShouldUnmount] = useState(false);
  const count = useMotionValue(0);
  const displayProgress = useTransform(count, (latest) =>
    `${Math.round(latest)}`
  );
  const widthProgress = useTransform(count, (latest) => `${latest}%`);

  const onAlmostDoneRef = useRef(onAlmostDone);
  useEffect(() => {
    onAlmostDoneRef.current = onAlmostDone;
  }, [onAlmostDone]);

  useEffect(() => {
    const controls = animate(count, 99, {
      duration: 1.2,
      ease: "easeOut",
      onComplete: () => {
        if (onAlmostDoneRef.current) onAlmostDoneRef.current();
      },
    });
    return controls.stop;
  }, [count]);

  useEffect(() => {
    if (isReady) {
      animate(count, 100, {
        duration: 0.3,
        onComplete: () => {
          setTimeout(() => setShouldUnmount(true), 250);
        },
      });
    }
  }, [isReady, count]);

  return (
    <AnimatePresence>
      {!shouldUnmount && (
        <motion.div
          exit={{
            opacity: 0,
            scale: 1.04,
            transition: { duration: 0.9, ease: [0.4, 0, 0.2, 1] },
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#000000]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_40%,rgba(28,42,78,0.28),transparent_72%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] bg-[radial-gradient(120%_100%_at_50%_118%,rgba(76,141,255,0.12),rgba(76,141,255,0.03)_48%,transparent_72%)]" />

          <div className="flex flex-col items-center">
            <motion.h1
              initial={{ opacity: 0, y: 18, filter: "blur(12px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[2.6rem] font-semibold leading-none tracking-[0.5em] pl-[0.5em]"
            >
              <motion.span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(110deg, #dde3ef 0%, #dde3ef 38%, #ffffff 48%, #96a1b8 54%, #dde3ef 62%, #dde3ef 100%)",
                  backgroundSize: "220% 100%",
                }}
                animate={{ backgroundPosition: ["120% 0%", "-120% 0%"] }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "linear",
                  delay: 0.6,
                }}
              >
                NEWS
              </motion.span>
              <span className="bg-gradient-to-b from-[#86b4ff] to-[#3d7ef0] bg-clip-text text-transparent">
                X
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 font-mono text-[9px] uppercase tracking-[0.52em] pl-[0.52em] text-[#8b93a7]/75"
            >
              The world in real time
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.7 }}
              className="mt-14 flex w-72 flex-col items-center gap-3"
            >
              <div className="relative h-px w-full overflow-hidden bg-white/[0.07]">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#3d7ef0]/40 via-[#4c8dff] to-[#bcd4ff]"
                  style={{ width: widthProgress }}
                />
              </div>
              <div className="flex w-full items-center justify-between font-mono text-[9px] tracking-[0.3em] text-white/30">
                <span>LOADING</span>
                <span className="flex items-baseline tabular-nums">
                  <motion.span>{displayProgress}</motion.span>
                  <span>%</span>
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
