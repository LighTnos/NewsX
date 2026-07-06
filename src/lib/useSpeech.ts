"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechStatus = "idle" | "speaking" | "paused";

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
    window.speechSynthesis.addEventListener("voiceschanged", populateVoices);
    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        populateVoices
      );
      window.speechSynthesis.cancel();
    };
  }, []);

  const speakNextChunkRef = useRef<() => void>(null);

  const speakNextChunk = useCallback(() => {
    const text = queueRef.current[chunkIndexRef.current];
    if (text === undefined) {
      setStatus("idle");
      setActiveId(null);
      activeIdRef.current = null;
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    const voices = window.speechSynthesis.getVoices();
    const premium = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Premium") || v.name.includes("Enhanced") || v.name.includes("Siri"))
    );
    if (premium) utterance.voice = premium;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => {
      chunkIndexRef.current += 1;
      speakNextChunkRef.current?.();
    };
    utterance.onerror = () => {
      setStatus("idle");
      setActiveId(null);
      activeIdRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    speakNextChunkRef.current = speakNextChunk;
  }, [speakNextChunk]);

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
