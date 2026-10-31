# Data sources

The verse text and translations are assembled by `scripts/build-data.mjs` from
raw files downloaded into `data-src/` (re-download with the URLs below).

## Sources

1. **[gita/gita](https://github.com/gita/gita)** (repo dedicated to the Unlicense)
   - `data/verse.json` — Sanskrit (Devanagari) and transliteration for all 701 verses.
   - `data/translation.json` — English translations by five translators:
     Swami Sivananda, Swami Adidevananda, Swami Gambirananda, Dr. S. Sankaranarayana,
     Shri Purohit Swami.
   ```
   curl -L https://raw.githubusercontent.com/gita/gita/main/data/verse.json -o data-src/gita-verse.json
   curl -L https://raw.githubusercontent.com/gita/gita/main/data/translation.json -o data-src/gita-translation.json
   ```

2. **[AdiyogiArts/gita-json](https://github.com/AdiyogiArts/gita-json)** (MIT)
   - `base.json` — chapter names in Devanagari and English.
   ```
   curl -L https://raw.githubusercontent.com/AdiyogiArts/gita-json/main/base.json -o data-src/adiyogi-base.json
   curl -L https://raw.githubusercontent.com/AdiyogiArts/gita-json/main/en.json -o data-src/adiyogi-en.json
   ```

Both sources agree on verse counts for all 18 chapters (701 verses total).

## Sanskrit text verification (important)

Cross-checking the two sources surfaced a real defect in the primary one:

- **25 verses in `gita/gita` contain a malformed Devanagari codepoint order**
  (virama followed directly by an i-matra, consonant displaced), e.g.
  `भक्ितमान्मे` instead of `भक्तिमान्मे`. This renders as a visible glitch.
- `scripts/build-data.mjs` repairs each mechanically, verifies the repair
  against the independent AdiyogiArts text, and where the repaired text still
  disagrees adopts the second source's reading for that verse.
- Every affected reference is recorded in `src/data/verses.json` under
  `verification.repaired` / `verification.adoptedFromSecondSource`.
- AdiyogiArts is **not** usable as the primary text: it omits content in places
  (e.g. verse 1.21 drops the opening `हृषीकेशंतदावाक्यमिदमाहमहीपते` pāda), so it is
  only trusted where the primary source is demonstrably broken.
- Remaining differences between the sources are legitimate editorial/edition
  variants (`सङ्गम्य` vs `संगम्य`, `पुङ्गव` vs `पुंगव`, missing/added avagraha) and
  were left as they are in the primary source.


## Licensing caveat

The Sanskrit verses are ancient and in the public domain. **The English
translations are modern works**: their repository licenses (Unlicense / MIT)
apply to the code and data packaging, not necessarily to the translators' text.
If you publish or commercialize this app, confirm reuse rights for each
translation with its rights holder (e.g. Divine Life Society for Swami
Sivananda's translation). For a clearly public-domain English rendering, see
Edwin Arnold's 1900 *The Song Celestial* on Project Gutenberg.

The Hindi translations (Swami Ramsukhdas, Swami Tejomayananda) and the
explanations/word-meanings (AdiyogiArts) fall under the same caveat: source
is recorded, reuse rights should be confirmed before commercial publication.
