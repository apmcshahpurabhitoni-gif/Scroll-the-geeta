# Android content contract

## Canonical source

The canonical generated source remains in the existing web repository:

- `src/data/verses.json`
- `src/data/translations/index.json` and the seven translator JSON files
- `src/data/ranking.json`
- `src/data/topics.json`
- `src/data/explanations.json`
- `DATA-SOURCES.md` for provenance and rights notes

Android must consume generated assets, not raw downloads in `data-src/`. Stable verse identity is `chapter.verse`; array positions are not durable identifiers.

## Export

Run `npm run export:android-content` from the repository root. The script copies source JSON bytes unchanged into:

`android/app/src/main/assets/scripture/`

It validates:
- exactly 18 chapters with the existing verse counts and 701 verses total;
- strict chapter/verse order, unique references, and non-empty Sanskrit/transliteration;
- 701 ranking scores, topic records, and explanation records;
- all seven translator manifest entries and 701 non-empty strings per translation;
- Sanskrit verification provenance arrays.

It then writes `manifest.json` with the source commit, counts, byte lengths, and SHA-256 checksums. The generated timestamp is informational; content checksums are the integrity signal.

The export does not edit or normalize canonical text. If validation fails, it exits before writing any output. Review generated asset diffs whenever canonical source data changes.

## Alignment contract

All verse-indexed arrays use the exact order of `verses.json`. For every index `i`, ranking score, topic tags, explanation and each translation string refer to `verses[i]`. The Android importer must map them to the stable `chapter.verse` reference immediately; it must not persist array index as the verse identity.

## Rights and release filtering

The source manifest is not proof that modern translations/commentaries are licensed for redistribution. Public release must use an explicit approved translator allow-list after rights review. This exporter currently mirrors the existing repository dataset for internal development; it does not grant distribution rights.
