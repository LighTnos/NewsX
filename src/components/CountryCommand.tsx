"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import {
  countryId,
  countryName,
  type CountryFeature,
} from "@/lib/countries";

interface CountryCommandProps {
  countries: CountryFeature[];
  onSelect: (country: CountryFeature) => void;
}

// Frosted-glass command palette (Ctrl/⌘+K) — the keyboard and screen-reader
// path for country selection, replacing the globe's pointer-only interaction.
export default function CountryCommand({
  countries,
  onSelect,
}: CountryCommandProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="chrome-fade glass-panel flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      >
        <svg
          aria-hidden
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        Search country
        <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-muted">
          CTRL K
        </kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Search for a country"
      >
        <Command.Input placeholder="Type a country name…" />
        <Command.List>
          <Command.Empty>No country found.</Command.Empty>
          {countries.map((c) => (
            <Command.Item
              key={countryId(c)}
              value={countryName(c)}
              onSelect={() => {
                onSelect(c);
                setOpen(false);
              }}
            >
              {countryName(c)}
            </Command.Item>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
