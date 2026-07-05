"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechStatus = "idle" | "speaking" | "paused";

// Chrome silently cuts off long utterances (~200-250 chars / ~15s). Splitting
// on sentence boundaries and queuing each as its own utterance sidesteps
// that limit and gives natural pause points for free.
function splitIntoChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > 200 && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Wraps window.speechSynthesis for one "track" (a single article's text) at
// a time. Handles: SSR guard, the getVoices() async-populate race, Chrome's
// long-utterance cutoff (via chunking), and tab-visibility throttling.
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [activeId, setActiveId] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const queueRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true);

    const populateVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    populateVoices();
    // Some browsers populate voices synchronously, others fire this event
    // asynchronously later — cover both.
    window.speechSynthesis.addEventListener("voiceschanged", populateVoices);
    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        populateVoices
      );
      window.speechSynthesis.cancel();
    };
  }, []);

  const speakNextChunk = useCallback(() => {
    const text = queueRef.current[chunkIndexRef.current];
    if (text === undefined) {
      setStatus("idle");
      setActiveId(null);
      activeIdRef.current = null;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    // Prioritize high-quality Neural/Premium voices if the browser provides them
    const englishVoices = voicesRef.current.filter((v) => v.lang.startsWith("en"));
    const bestVoice = 
      englishVoices.find(v => v.name.includes("Natural") && v.name.includes("United Kingdom")) || // Edge Azure Neural UK
      englishVoices.find(v => v.name.includes("Natural")) || // Edge Azure Neural US
      englishVoices.find(v => v.name.includes("Google UK English Female")) || // Chrome High-Quality
      englishVoices.find(v => v.name.includes("Google US English")) || // Chrome High-Quality
      englishVoices.find(v => v.name.includes("Premium")) || // Apple Premium
      englishVoices.find(v => v.name.includes("Siri")) || // Apple Siri
      englishVoices[0]; // Fallback to first available English voice (Microsoft David/Zira, etc)
      
    if (bestVoice) utterance.voice = bestVoice;
    utterance.rate = 1;

    utterance.onend = () => {
      chunkIndexRef.current += 1;
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      speakNextChunk();
    };
    utterance.onerror = () => {
      setStatus("idle");
      setActiveId(null);
      activeIdRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `id` identifies the article/track so the UI can show which one is
  // playing. Must be called directly from a user gesture (click handler) —
  // iOS Safari silently drops speak() calls made outside that call stack.
  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      queueRef.current = splitIntoChunks(text);
      chunkIndexRef.current = 0;
      activeIdRef.current = id;
      setActiveId(id);
      setStatus("speaking");
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      speakNextChunk();
    },
    [supported, speakNextChunk]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setStatus("speaking");
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setActiveId(null);
    activeIdRef.current = null;
  }, [supported]);

  // Resume playback if the tab regains focus mid-utterance after the
  // browser throttled/paused synthesis while backgrounded.
  useEffect(() => {
    if (!supported) return;
    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        activeIdRef.current &&
        window.speechSynthesis.paused &&
        status === "speaking"
      ) {
        window.speechSynthesis.resume();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [supported, status]);

  return { supported, status, activeId, speak, pause, resume, stop };
}
