/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";

const CHARS = "!<>-_\\\\/[]{}—=+*^?#________";

interface ScrambleTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export default function ScrambleText({ text, className = "", delay = 0 }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    let frame = 0;
    let timeout: NodeJS.Timeout;
    const length = text.length;
    let cancelled = false;

    const start = () => {
      const run = () => {
        if (cancelled) return;
        let output = "";
        let complete = 0;

        for (let i = 0; i < length; i++) {
          if (frame >= i * 2) {
            output += text[i];
            complete++;
          } else {
            output += CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        }

        setDisplayText(output);

        if (complete === length) {
          return;
        }

        frame++;
        requestAnimationFrame(run);
      };

      run();
    };

    if (delay > 0) {
      const initialScramble = Array.from({ length })
        .map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
        .join("");
      setDisplayText(initialScramble);
      timeout = setTimeout(start, delay);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [text, delay]);

  return <span className={className}>{displayText}</span>;
}
