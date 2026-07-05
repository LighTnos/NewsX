# NewsX

An interactive 3D globe for exploring live world news. Rotate the Earth, select any country, and read or listen to real local headlines — extracted in full, right inside the app.

Built with Next.js 16, `react-globe.gl`/three.js, and a fully free-tier stack (NewsData.io, RSS, Groq, Web Speech API).

## Features

- **3D globe** — Natural Earth country boundaries rendered on a night-lights globe (`react-globe.gl` + three.js), click any country to fly the camera to it.
- **Country-precise news** — [NewsData.io](https://newsdata.io) as the primary source (genuinely scoped per country, not just region), with an RSS fallback (BBC, Al Jazeera, DW, France24, and a live Bing News country search) when a country has thin coverage.
- **Full article reader** — articles open in an in-app reader that fetches and extracts the real article text server-side via [Mozilla Readability](https://github.com/mozilla/readability) (the engine behind Firefox Reader View), not just a short snippet.
- **Listen** — text-to-speech via the browser's native Web Speech API, with sentence-chunking to avoid Chrome's utterance cutoff, and pause/resume/stop controls.
- **Translate** — one-tap translation of any article to English via Groq's free-tier LLM API.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in your API keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Where to get it |
|---|---|---|
| `NEWSDATA_API_KEY` | Yes, for precise per-country news | Free signup at [newsdata.io](https://newsdata.io) (no credit card) |
| `GROQ_API_KEY` | Yes, for the Translate feature | Free signup at [console.groq.com](https://console.groq.com) |

Without these keys the app still runs: news falls back to RSS-only, and the Translate button is disabled. See `.env.example`.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · `react-globe.gl` / three.js · GSAP + Lenis · Motion (Framer Motion) · Radix UI · `cmdk` · Groq SDK · `@mozilla/readability` + `jsdom`

See [ROADMAP.md](./ROADMAP.md) for the full architecture, data flow, and design rationale.

## Deploying

Deploys cleanly to [Vercel](https://vercel.com/new) — set `NEWSDATA_API_KEY` and `GROQ_API_KEY` as project environment variables before deploying.
