# NewsX — Interactive 3D World News Globe

A resume-grade Next.js application: a cinematic, dark, Awwwards-caliber 3D globe where a visitor rotates the Earth, clicks a country, and gets a live, summarized news feed for that country — readable or **listenable** via text-to-speech. Visual language inspired by SpaceX.com and Apple.com product pages. Every single tool/service in this plan is **free forever**, with no paid tier assumed anywhere in the default path.

---

## 1. Vision & Core Interaction Loop

1. User lands on a full-bleed dark hero: a slowly auto-rotating 3D globe, subtle grain/starfield background, minimal typographic hero text (SpaceX/Apple style reveal-on-load).
2. User drags to rotate the globe, or types/selects a country in an accessible search box (keyboard/screen-reader parallel path).
3. Clicking/selecting a country: camera flies to that country (smooth eased `pointOfView` tween), the country highlights, and a side/bottom panel slides in with a live news feed for that country.
4. Each news item shows: headline, source, timestamp, an AI-or-source-provided **short summary** (not the full raw article dump), and a **Listen** button.
5. Listen plays the summary (or full article text) via the browser's built-in speech synthesis — no server cost, works offline, no API key.
6. Panel and globe stay in sync: closing a story returns focus to the globe; picking a new country cross-fades the feed.

This is deliberately scoped as a **data-journalism-style interactive globe** (in the lane of COVID dashboards / Bloomberg-style data globes), not a decorative dot-globe — research confirmed genuinely clickable country-polygon globes are a less saturated, more substantive lane on Awwwards than ambient dot globes, which is good differentiation for a resume piece.

---

## 2. Confirmed Free-Forever Tech Stack

| Layer | Choice | Why | Cost |
|---|---|---|---|
| Framework | **Next.js 15** (App Router) + React 19 | Server Components for static shell, Client Components only where interactive/animated — keeps shipped JS lean | Free |
| Hosting | **Vercel Hobby tier** | Zero-config Next.js deploys, generous free bandwidth/build minutes for a portfolio-traffic site | Free |
| 3D Globe | **react-globe.gl** (`react-globe.gl` → `globe.gl` → `three-globe` → `three`) | Only library with out-of-the-box GeoJSON country-polygon click/hover detection + camera fly-to, actively maintained | Free (MIT) |
| Country boundary data | **Natural Earth `ne_110m_admin_0_countries.geojson`** (vendored in `/public/data`, ~45KB gzipped) | The exact dataset react-globe.gl's own maintainer examples use; 110m resolution is the correct fidelity for globe-scale rendering | Free |
| News data | **NewsData.io free tier** (200 credits/day ≈ 2,000 articles/day, country-filterable) as primary, **RSS aggregation** (per-country major outlet feeds via `rss-parser`) as unlimited fallback/supplement | Only free tier among the three researched news APIs without an explicit "no production use" clause (see §4 caveat); RSS is uncapped and zero-cost as backstop | Free |
| Summarization | **Groq Cloud API** (Llama 3.1/3.3 8B or similar fast model on Groq's free tier) generates the short summary server-side, cached per-article; falls back to the source's own `description` snippet if the Groq call fails/quota is hit | Groq's free tier (generous per-minute/per-day token limits, no credit card required) covers this at demo-project volume; caching per-article means repeat viewers never re-trigger a call | Free |
| Text-to-Speech | **Web Speech API** (`window.speechSynthesis`), client-side | Zero cost at unlimited scale, ~95% global browser support, fully offline, no key/quota risk | Free |
| Scroll/cinematic animation | **GSAP + `@gsap/react`(`useGSAP`) + Lenis** | GSAP became 100% free (all former paid plugins: ScrollTrigger, SplitText, etc.) after the 2025 Webflow acquisition; GSAP+Lenis is the confirmed dominant pairing in current Awwwards Developer Award winners | Free (MIT-equivalent) |
| UI micro-interactions | **Motion** (`motion`, formerly Framer Motion) | Lightweight (2.6kb core), GPU-compositor-driven, ideal for component-level transitions, modals, shared elements — complements GSAP rather than duplicating it | Free (MIT) |
| Accessible primitives | **shadcn/ui** CLI-scaffolded (copied into repo) or `@radix-ui/react-*` directly, heavily restyled | Own the code, keep accessible dialog/dropdown/combobox behavior, discard all default "SaaS dashboard" visual styling | Free |
| Styling | **Tailwind CSS v4** (CSS-first `@theme` config) | Oxide engine: ~3.5–5x faster builds, native CSS variables theming, pairs cleanly with GSAP/Motion color interpolation | Free |
| Fonts | **Geist Sans / Geist Mono** via `next/font` (self-hosted, zero CLS) | Free, Vercel-native, Apple/SpaceX-adjacent premium grotesk; optional distinctive display face for hero only | Free |
| 3D/WebGL extras (optional) | `@react-three/fiber` + `@react-three/drei` | Only if adding ambient particle/shader accents beyond the globe itself | Free |

**No ElevenLabs, no OpenAI TTS/summarization, no NewsAPI.org paid tier, no GNews paid tier anywhere in the default build.** Groq's summarization use is on its own free tier (not a paid LLM API) — these paid alternatives are documented in §7 purely as an optional, explicitly-gated upgrade path — never required.

---

## 3. Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Client (Browser)                                            │
│  ┌───────────────┐   click/select country   ┌──────────────┐ │
│  │  GlobeCanvas   │ ───────────────────────▶ │ selectedCountry│
│  │ (react-globe.gl,│                          │  (state)      │ │
│  │  dynamic ssr:  │ ◀─────────────────────── └──────┬───────┘ │
│  │  false)        │   pointOfView() fly-to           │         │
│  └───────────────┘                                   │         │
│                                                        ▼         │
│  ┌────────────────────────────┐   fetch(`/api/news?country=xx`)│
│  │ Accessible country <select>│──────────────┐                 │
│  │ (keyboard/SR fallback,     │              ▼                 │
│  │  same state as globe)      │      ┌───────────────┐         │
│  └────────────────────────────┘      │ NewsFeedPanel │         │
│                                       │ (aria-live)   │         │
│  ┌────────────────────────────┐      └───────┬───────┘         │
│  │ Listen button → window.    │              │ speak(summary)  │
│  │ speechSynthesis.speak()    │◀─────────────┘                 │
│  └────────────────────────────┘                                │
└───────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Next.js Route Handler: /api/news                            │
│   1. Check Upstash Redis cache (per-country, ~30-60min TTL)    │
│   2. If stale: call NewsData.io (country param) —              │
│      falls back to RSS aggregator on quota/error                │
│   3. Normalize both sources to one Article shape                │
│   4. For each new/uncached article: call Groq for a summary,    │
│      cache the summary indefinitely keyed by article URL/ID     │
│      (falls back to source snippet if Groq fails)                │
│   5. Return summary-ready fields (title, summary, source, ts)    │
└─────────────────────────────────────────────────────────────┘
```

**Why cache server-side (two separate caches, two separate reasons)**:
- **News list cache** (~30–60 min TTL, per country): NewsData.io's free tier is 200 credits/day — caching each country's results means a portfolio-traffic site never comes close to exhausting the daily quota, and gives a graceful degrade path (serve last-cached data / switch to RSS) instead of a broken UI when the quota is hit.
- **AI summary cache** (indefinite/long TTL, per article): turns Groq usage from O(page views) into O(unique articles) — a trending story viewed by hundreds of visitors still only triggers one summarization call, which is the highest-leverage cost/quota optimization in the whole system.
- Both live in **Upstash Redis** (free tier: 500,000 commands/month, 256MB storage, up to 10 databases — accessed via the Vercel Marketplace, since the original "Vercel KV" product has been sunset and migrated to Upstash). Also used for a simple daily-request counter (`INCR` with 24h TTL) that short-circuits to cached/RSS data as the NewsData.io quota is approached, rather than erroring out.

---

## 4. News Data — Verified Findings & Decision

Researched every realistic candidate directly against official pricing/docs/terms pages:

| | NewsAPI.org | GNews | NewsData.io | Guardian | NYTimes | Mediastack | Currents |
|---|---|---|---|---|---|---|---|
| Free limit | 100 req/day | 100 req/day | 200 credits/day (~2,000 articles) | 500 req/day, 1/sec | 500/day, 5/min (varies by sub-API) | 100 calls/**month** | 1,000 req/day |
| Country filter | Yes (fixed codes) | Yes (37–80 fixed codes) | Yes (fixed alpha-2, up to 5/req free) | No (free-text/tag search only) | No (free-text `glocations` only) | Yes (~50+ countries, exact list unconfirmed) | Yes ("70+ countries," list unconfirmed) |
| Free tier production use | **Explicitly forbidden** by ToS | Implied forbidden (pricing copy) | No explicit prohibition found (unverified ToS — see caveat) | **Explicitly non-commercial only** (ToS §7a/§8c) | **Explicitly bans commercial purpose** (ToS, incl. AI/ML use) | Feature matrix shows "Commercial Use" gated to paid tiers only | Ambiguous — no explicit ban or permission found |
| Free data freshness | 24h delayed | 12h delayed | 12h delayed | Not split by tier | Not documented | Delayed (paid = live) | "Real-time" claimed, unconfirmed |
| Cheapest paid tier | $449/mo | €49.99/mo | $199.99/mo | Custom quote only | No self-serve paid tier | $24.99/mo | $69/mo |

Also checked and ruled out: **Bing/Azure News Search API — confirmed fully retired August 11, 2025** (all tiers, HTTP 410 now); **Webz.io** — free tier explicitly non-commercial/academic only, paid is sales-contact-only; **NewsCatcher** — free tier status is contradictory across their own pages, likely deprecated; **World News API** — usable-looking (50 free points/day, 60 req/min) but low daily ceiling and country-code list couldn't be verified; **Marketaux** — finance-news focused, not general news.

**Decision: NewsData.io as primary, RSS as fallback/supplement.**

- **NewsAPI.org, GNews, Guardian, and NYTimes are all disqualified for a publicly deployed site** — each has an explicit non-commercial/development-only restriction in its own ToS. Guardian and NYT in particular ban commercial use in language broad enough to cover a portfolio site with any ads/monetization, though a genuinely non-monetized resume demo is arguably fine under their "non-commercial" carve-out (attribution rules still apply if used).
- **Mediastack** technically has no explicit ToS ban, but its feature matrix gates "Commercial Use" to paid tiers, and free tier is HTTP-only (no HTTPS) — both make it a poor fit for a public HTTPS-deployed Vercel app regardless.
- **NewsData.io remains the best primary choice**: no confirmed production-use ban, 200 credits/day (~2,000 articles) comfortably covers a cached demo site. **Caveat unchanged**: NewsData.io's own `/pricing`, `/documentation`, and `/terms` pages are JS-rendered SPAs that resisted automated verification — manually open `newsdata.io/terms` in a browser before public deploy to double check. Treat as a pre-launch checklist item, not a build blocker.
- **RSS aggregation** as uncapped, zero-ToS-risk supplement/fallback. Concretely: pull from **`yavuz/news-feed-list-of-countries`** (190+ countries, auto-validated feed freshness — actively fights the dead-link-rot problem) cross-referenced with **`vandenbroucke/rss-news-list`** (clean flat JSON schema, 457 URLs/52 sources) for the country→feed-URL mapping, parsed server-side with `rss-parser`. Individually confirmed-live feeds to seed with: BBC World + regional editions, Al Jazeera, France24, DW, NPR, CNN World. **Reuters RSS is dead** (killed June 2020, now 401/bot-blocked) — don't attempt it. Note: RSS feeds return headline + short description only (no full article body), and are outlet/region-level, not article-level, country-tagged — acceptable for this project's "country news feed" granularity, but worth knowing going in.

**Summarization — Groq Cloud API**: Use Groq's free tier (`llama-3.1-8b-instant` or similar) to generate a consistent, uniform-tone summary from each article's title + snippet, server-side in the `/api/news` Route Handler. Groq's free tier has no perpetual-cost problem at this project's scale because:
  - Requests are cheap and fast (Groq's whole pitch is low-latency inference on LPU hardware), and free-tier rate limits (generous per-minute/per-day request and token caps, no credit card required) comfortably cover a portfolio-traffic app.
  - **Cache every generated summary indefinitely, keyed by article URL/ID** in Upstash Redis (see §3) — this turns cost/quota usage from O(page views) into O(unique articles), which is the single highest-leverage optimization here. A trending story viewed by 500 visitors still only costs one Groq call.
  - **Fallback chain**: if the Groq call fails or the free-tier quota is ever hit, fall back to the news source's own human-written `description`/snippet field (NewsData.io, RSS, etc. all provide one) — so the feature degrades gracefully instead of breaking.
  - Honest framing for the resume narrative: most free news sources already ship a decent human-written snippet, so the Groq layer's real value is normalizing tone/length across heterogeneous sources (NewsData.io + multiple RSS feeds) into one consistent voice, plus demonstrating LLM API integration — not "filling a content gap" that would otherwise leave users confused.

---

## 5. Globe Implementation Notes (react-globe.gl)

- **Client-only, dynamically imported**: `const Globe = dynamic(() => import('react-globe.gl'), { ssr: false })` — three.js requires `window`/WebGL, which doesn't exist during Next.js SSR.
- **Country click → highlight → fly-to** pattern (from the library's own maintainer examples):
  ```jsx
  const globeEl = useRef();
  const [hoverD, setHoverD] = useState();
  const [selectedCountry, setSelectedCountry] = useState();

  <Globe
    ref={globeEl}
    polygonsData={countries.features}
    polygonAltitude={d => d === hoverD ? 0.12 : 0.06}
    polygonCapColor={d => d === selectedCountry ? '#3b82f6' : d === hoverD ? '#60a5fa' : 'rgba(200,200,200,0.5)'}
    onPolygonHover={setHoverD}
    onPolygonClick={(polygon) => {
      setSelectedCountry(polygon);
      const [lng, lat] = d3.geoCentroid(polygon); // precomputed centroid, not raw click coords
      globeEl.current.pointOfView({ lat, lng, altitude: 1.5 }, 1000);
    }}
    onGlobeReady={() => globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0)}
  />
  ```
- **Accessibility fallback (non-negotiable, not an afterthought)**: none of react-globe.gl/three-globe ships any screen-reader semantics — a canvas is invisible to assistive tech. Build a real `<select>`/searchable combobox wired to the *same* `selectedCountry` state, so keyboard/screen-reader users get full functionality without touching the globe. This doubles as the WebGL-unsupported fallback (rare, but some locked-down corporate devices lack WebGL2).
- **Performance**: cap `devicePixelRatio` at 2, pause auto-rotation when the tab/globe isn't in view (thermal throttling on mobile is real — Stripe's own globe engineering blog found disabling antialiasing was a bigger performance win than expected), respect `prefers-reduced-motion` by skipping/shortening the fly-to tween.
- **Bundle size**: expect ~300–500KB gzipped for the globe chunk. It's fully code-split via `dynamic()`, so it doesn't block first paint — but defer mounting it until after the hero's initial reveal animation, or gate behind an `IntersectionObserver` if it's below the fold.
- **Stretch/differentiator noted for later**: Stripe's globe engineering post describes an "ID-color-texture" pixel-picking technique instead of per-country raycasting — worth citing as prior art if reimplementing the globe core in raw React Three Fiber later as a "v2, built from scratch" portfolio talking point.

---

## 6. UI/UX Design System — SpaceX / Apple / Awwwards Language

**Visual foundation**
- Deep space-black base (`#05060a`-ish), not pure black — layered with a subtle animated mesh-gradient (CSS `radial-gradient` layers, deep blues/purples) and a low-opacity SVG grain/noise overlay so dark surfaces don't look flat/banded.
- Glassmorphism for floating panels (news feed panel, country info card): dark-mode-tuned `backdrop-filter: blur()` with increased white-alpha per current 2026 guidance, layered with `mask-image` gradients for a "frosted, dimensional" feel over the globe scene.
- Subtle animated grid/dot background on non-globe sections (hero text area), slow parallax tied to scroll or mouse position.
- Geist Sans for UI/body text (variable font, zero CLS via `next/font`); optional distinctive display face for large hero headlines only.

**Motion language**
- **GSAP + `@gsap/react` (`useGSAP` hook) + Lenis** drive the cinematic layer: smooth momentum scroll (Lenis wraps native scroll rather than hijacking it — keeps `position: sticky` and accessibility intact), `ScrollTrigger`-pinned sections, `SplitText`-based character/line reveal for hero headlines (the ubiquitous Awwwards text-reveal effect), synced via `gsap.ticker` so Lenis and GSAP share one frame loop.
- **Motion** handles component-level interactions: news card hover/tap states, panel slide-in/out (`AnimatePresence`), shared-element transitions between a country's globe marker and its expanded card (`layoutId`), modal/dialog transitions.
- Respect `prefers-reduced-motion` everywhere: Motion has built-in `<MotionConfig reducedMotion="user">`; GSAP requires manually wiring `gsap.matchMedia()` for each ScrollTrigger sequence — budget explicit time for this, it's not automatic.
- Optional Apple-style technique for the landing hero: a canvas image-sequence scrub (pre-rendered frames blitted to `<canvas>`, advanced via scroll progress) as a cinematic intro before handing off to the live WebGL globe — a recognizable "Apple product page" signature if time allows.

**Component approach**
- Use shadcn/ui **only** to scaffold accessible-but-non-hero primitives (dropdowns, dialogs for article detail, tooltips on globe markers, command-palette-style country search) — strip all default styling immediately, restyle fully with Tailwind v4 `@theme` tokens matching the space palette. Do not use shadcn's default visual layer or block templates; they read as generic SaaS dashboard and fight the full-bleed cinematic layout this project needs.
- All hero/scroll-narrative/globe surfaces are fully custom — no component library adds value there.

---

## 7. Optional Paid Upgrade Path (explicitly NOT required, off by default)

Documented for completeness only — the app must work fully and look complete without any of these:

- **Premium "AI Voice" toggle**: ElevenLabs Flash v2.5 or OpenAI `tts-1`, gated behind a hard server-side monthly character budget + per-session rate limit, silently falling back to Web Speech API once exhausted. At the free tier alone (ElevenLabs 10k credits/mo, no OpenAI free tier), this cannot be the default — flagged in research as capable of generating a surprise $99–299/mo bill on ElevenLabs if exposed unmetered.
- **Higher-volume news**: NewsData.io Basic ($199.99/mo) or GNews Essential (€49.99/mo) if the project ever needs real-time (non-12h-delayed) data at higher request volume.
- **Higher-quality summarization**: swap Groq's free-tier model for a larger Groq model or a paid Claude/OpenAI call for particularly high-traffic articles — not needed at baseline, since Groq's free tier already covers the core feature end-to-end.

---

## 8. Phased Build Plan

**Phase 0 — Project scaffolding**
- `create-next-app` (App Router, TypeScript, Tailwind v4)
- Install core deps: `react-globe.gl`, `d3-geo`, `gsap`, `@gsap/react`, `lenis`, `motion`, `geist`, `rss-parser`, `@upstash/redis`, `groq-sdk`
- Vendor `ne_110m_admin_0_countries.geojson` into `/public/data`
- Set up Tailwind v4 `@theme` tokens (dark palette, fonts) and base layout with Geist fonts via `next/font`
- Provision Upstash Redis (via Vercel Marketplace, free tier) and a Groq Cloud API key (free, no card required)

**Phase 1 — Globe MVP**
- `GlobeCanvas` client component, dynamically imported, `ssr: false`
- Render country polygons, hover highlight, click → select + fly-to camera
- Accessible parallel `<select>`/combobox wired to the same selection state
- Basic dark starfield/gradient background behind the canvas

**Phase 2 — News integration**
- `/api/news` Route Handler: NewsData.io client + RSS fallback (`rss-parser`), normalized `Article` type, Upstash Redis cache with TTL + daily-quota counter
- Groq summarization call per new/uncached article, cached indefinitely by article ID, with source-snippet fallback on failure
- `NewsFeedPanel` client component: slides in on country selection, `aria-live="polite"`, lists headline/source/timestamp/summary
- Loading/empty/error states (including graceful "quota exhausted, showing cached/RSS results" messaging)

**Phase 3 — Listen (TTS) feature**
- Web Speech API integration: guard all access behind `typeof window !== 'undefined'` / client components
- Handle `voiceschanged` for both sync- and async-populating browsers
- Chunk text into sentence-length utterances (avoids the ~200–250 char Chrome cutoff), with play/pause/stop controls
- Ensure the Listen click itself is the user gesture that calls `speak()` (required for iOS Safari)

**Phase 4 — Cinematic polish pass**
- GSAP + Lenis smooth scroll setup, `ScrollTrigger`-pinned hero section, `SplitText` headline reveal
- Motion-driven card/panel micro-interactions, shared-element transitions
- Grain/noise overlay, mesh-gradient background, glass panel styling
- `prefers-reduced-motion` handling across both GSAP and Motion layers

**Phase 5 — Performance & accessibility hardening**
- Cap pixel ratio, pause auto-rotation off-viewport, verify mobile frame rate
- Lighthouse pass: CLS/INP budget, code-split below-fold sections, verify globe chunk doesn't block first paint
- Full keyboard-only and screen-reader pass through the country-select → news → listen flow
- Manually verify NewsData.io ToS in-browser before public deploy (flagged caveat from research)

**Phase 6 — Deploy**
- Vercel Hobby deploy, environment variables for NewsData.io key, Groq API key, Upstash Redis credentials
- Final cross-browser TTS check (Chrome/Firefox/Safari desktop + iOS Safari/Android Chrome)

---

## 9. Stretch Goals

- Rebuild the globe core in raw React Three Fiber (Stripe-style ID-color-texture picking instead of per-country raycasting) as a "v2, built from scratch" writeup demonstrating deeper three.js skill.
- Arc/route overlays between countries for cross-border story linking (react-globe.gl supports this natively).
- "Trending now" mode: auto-rotate + auto-focus through top global stories on idle.
- Multi-language RSS sources for genuinely local (non-English-translated) headlines per country.
- PWA/offline shell for the UI chrome (news content still requires network).
