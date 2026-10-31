# Scroll the Gita

A bilingual (Sanskrit + English/Hindi) Bhagavad Gita reader: one verse per frame,
a daily verse, bookmarks, topics and a reading journey. Vanilla ES modules built
with Vite — no framework.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm test         # alias: npm run test:acceptance (needs a server on $BASE)
```

## URL scheme

Every verse is linkable and the hash is the source of truth.

| URL | Meaning |
| --- | --- |
| `#/ch2/v47` | Chapter 2, verse 47 — canonical form |
| `#/explore/2.47` | Legacy form, still accepted and rewritten to canonical |
| `#/ch9/v99` | Invalid ref → redirected to `#/ch1/v1` |
| _(empty hash)_ | Redirected to `#/ch1/v1` |
| `#/today`, `#/topics`, `#/saved`, `#/journey` | Tab routes |

Explicit navigation (arrows, rails, gestures, keyboard, reference search) writes
the hash with `history.pushState`, so browser Back and Forward step through
verses. Scrolling the feed updates the *same* entry with `history.replaceState`,
so free scrolling never floods the history stack.

## Gesture zones

The verse frame has two fixed rails; only the body between them scrolls.

```
┌────────────────────────────────────────────┐
│ progress bar                           2px │  ← chapter position
│ Chapter 2 · Sankhya Yoga   Verse 47 of 72  │  ← top rail (fixed)
│ [ reference search ] [Chapters] [Trans. ]   │
├──────────┬──────────────────────┬──────────┤
│  swipe   │                      │  swipe   │
│  = prev  │   body scrolls       │  = next  │  ← outer 15% strips
│  / next  │   (never navigates)  │  / prev  │
├──────────┴──────────────────────┴──────────┤
│  [Prev]        [home]        [Next]        │  ← bottom rail (fixed)
└────────────────────────────────────────────┘
```

- Swipe **up** = next verse, **down** = previous verse.
- A gesture only navigates when it travels **more than 80 px** or moves faster
  than **0.5 px/ms**, so taps on rail buttons still work. A swipe that does
  navigate swallows the synthetic click that follows it.
- Zones: the top rail, the bottom rail, and the left/right 15% edge strips of
  the body. Swiping in the middle of the body scrolls the verse natively and
  never changes verse.
- The rails have `touch-action: none` so the browser does not claim the drag.
  On touch devices the body keeps native vertical scrolling.

## Keyboard

| Key | Action |
| --- | --- |
| `ArrowDown`, `j` | Next verse |
| `ArrowUp`, `k` | Previous verse |
| `PageDown` / `PageUp` | Scroll the current verse when it is taller than the body, otherwise next/previous |
| `Home` | `#/ch1/v1` |
| `Tab` | Reaches the current verse frame (after the app-bar controls); the frame shows a 2px accent focus ring |
| `Escape` | Closes the transliteration disclosure, then the chapter card, then an open sheet |

## Chapter transitions

Moving forward from the last verse of a chapter to the first of the next shows a
full-bleed chapter card (Devanagari name, English name, verse count, **Begin
chapter**). Tapping anywhere on the card, the button, or pressing Escape
dismisses it.

## States

The rails stay mounted in every state inside the reader:

- **Empty** — verse text is not available yet: “This verse is still being
  prepared.”
- **Error** — rendering or translation loading failed: message plus **Try
  again**, which re-renders that verse in place.

Both keep the top and bottom rails, so navigation is never lost. (For manual
checks, `window.__STG__.explore.simulateFailure(index)` forces the error state
for a verse.)

## Route filtering

The reader renders **exactly one verse**: the routed one. `#/ch2/v47` puts a
single `.verse` in the frame — never the book — and every navigation replaces
it. There is no long scroll of 701 cards under a label that claims to be one
verse.

```
#/ch2/v47 → index of 2.47 → one verse card
```

Back/Forward move between routed verses because each explicit navigation is a
`pushState`. Free scrolling inside an overflowing verse does not touch history
or the hash.

## Data and preloading

`src/data/verses.json` ships all 701 verses in one bundle (≈155 kB, ≈78 kB
gzip), so neighbouring verses are already resident — there is no per-verse
network fetch to fail. `preloadAround()` keeps an explicit ±2 window
(`window.__STG__.explorePreloaded()` in dev) so the loader contract stays
visible if the dataset is ever split per chapter. Translations are separate
chunks loaded on demand by `src/lib/data.js`.

## Compliance notes

- **Touch targets**: every control on both rails is at least 44×44 px; rail
  rows use `min-height` and wrap, so they grow instead of overlapping when text
  scales.
- **Text scaling**: frame text is sized in `rem`, so a 200% root font size
  enlarges the verse and the rails grow around it; the body scrolls instead of
  clipping. Inputs are `1rem` (16 px floor) so iOS does not zoom on focus.
- **Safe areas**: `viewport-fit=cover` plus `env(safe-area-inset-*)` on the app
  bar, tab bar and frame edges.
- **Contrast**: Sanskrit and translation use full ink on `#faf8f3`; muted text
  is at 66% ink (~5:1).
- **Motion**: verse switches are a 120 ms opacity crossfade, nothing moves or
  scales; `prefers-reduced-motion: reduce` removes it entirely.
- **320 px**: no horizontal scroll; the chapter number drops out of the top
  rail below 360 px and the chapter name ellipsises.
