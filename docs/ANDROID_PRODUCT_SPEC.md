# Scroll the Geeta — Android Product Specification

Status: Phase 0 baseline  
Target: Native Android first  
Distribution: Google Play Store + signed APK  
Product principles: gesture-first, offline-first, Scripture-first

## 1. Vision

Scroll the Geeta is a calm, modern way to read, understand, remember, and apply the Bhagavad Gita. The core experience is a full-screen, one-verse-at-a-time reader navigated by natural vertical gestures. It must feel like a purpose-built Android reading app, not a website inside an Android shell.

The Gita remains the centre of the product. The interface must not turn verses into disposable social posts or optimize for endless engagement. Every interaction should support contemplation, comprehension, recall, or practical application.

## 2. Product principles

1. Gesture-first: swipe vertically to move between verses. No visible Previous/Next buttons on the main reading surface.
2. One verse, clear context: show chapter, chapter name, verse reference, and progress without overwhelming Sanskrit and translation.
3. Meaning before mechanics: open verse study without losing the reader's place.
4. Respect the source: never silently rewrite Sanskrit, translations, verse ordering, editorial rankings, or daily selection rules.
5. All verses remain available: ranking influences prominence and daily selection, never access or deletion.
6. Offline by default: core scripture, selected translations, saved items, notes, and progress work without a network connection.
7. User-controlled habits: gentle reminders and streaks; no guilt, dark patterns, or forced notifications.
8. Accessible gestures: TalkBack actions and chapter/verse picker provide alternatives without adding Previous/Next buttons to the primary reader.

## 3. Information architecture

- Today: daily verse, short reflection, continue reading, current streak.
- Read: full-screen gesture reader, chapter/verse picker, language/translator selection.
- Explore: chapters, topics, ranked teachings, search.
- Saved: bookmarks, personal notes, collections.
- Journey: guided learning paths and progress.
- Settings: language, translation, typography, appearance, reminders, privacy, sync, offline storage, accessibility.

The reader is the primary surface. Navigation chrome should be minimal and may hide while reading.

## 4. Core reader interaction contract

- Swipe up / fling up: advance exactly one verse.
- Swipe down / fling down: go back exactly one verse.
- Tap verse body: open verse study detail.
- Long press verse: compact action sheet (save, add note, share, copy reference).
- Tap chapter/verse context: open chapter and verse picker.
- Android system Back / edge gesture: dismiss overlay or return to prior screen; never hijack system navigation.

There are no visible Previous or Next buttons on the main reader page. Chapter selection, search, and direct reference entry remain available for intentional jumps.

### Gesture behaviour

Use a native Compose vertical paging surface with one verse per page, not a WebView and not a simulated HTML scroll strip. A normal deliberate fling advances one verse only. A short drag below touch slop settles back. A long verse or expanded study content must remain readable: inner content consumes movement while it can scroll; the pager changes verse only at the relevant boundary and when the gesture clearly intends paging. Taps, text selection, copy, links, and accessibility actions must not be interpreted as paging gestures. Respect system animation preferences and restore the last stable verse after process death.

Long commentary belongs in study detail, not the main reading card. The default reader should fit the verse and selected translation comfortably on common phone screens while respecting font scaling.

### Reader states

- Loading: stable skeleton; no false content.
- Ready: Sanskrit, optional/collapsible transliteration, selected translation and attribution.
- Translation unavailable: retain Sanskrit and explain; allow retry or translator change.
- Verse unavailable: retain chapter/verse context and offer retry; never silently jump.
- Chapter transition: restrained chapter intro; continue by gesture or tap, not a tiny required button.
- End of book: completion state with restart or chapter selection.

## 5. Verse study detail

Show, when source data exists: Sanskrit, transliteration, verse reference, selected Hindi/English translation and attribution, word meanings, explanation/commentary with clear attribution, practical reflection labelled as editorial content, verified related topics/cross-references, save, note, share, copy reference, and translation selection.

Never invent missing commentary or present AI-generated interpretation as a sourced traditional commentary. Any future AI study must be opt-in, labelled, and separate from canonical text.

## 6. Scope

### MVP alpha
- Native Android shell and onboarding.
- Today screen and gesture-first reader.
- All 18 chapters / 701 verses.
- Sanskrit and current default Hindi/English translations, subject to rights approval.
- Chapter/verse picker and direct reference navigation.
- Search across references and available text.
- Bookmark/save, reading progress, resume.
- Daily verse using the existing deterministic weighted repeat-avoidance algorithm.
- Offline core reading.
- Light/dark/system appearance, font sizing, TalkBack labels.
- Local reminders only after explicit opt-in.

### Next release
- Full translation catalogue after rights clearance.
- Existing word meanings and explanations.
- Topics and ranked teachings.
- Guided journeys.
- Personal notes and collections.
- Optional account/cloud sync after local-first behaviour is proven.
- Share cards with source/reference attribution.

### Later, validate first
Audio recitation, daily widgets, additional commentaries, and opt-in AI-assisted study.

## 7. Daily selection and habit rules

Port the current dailyPick logic exactly: date-seeded deterministic selection, ranking tier weights, editorial date overrides, repeat-avoidance window, fallback behaviour, and persisted date-to-verse choice. Create golden parity tests comparing JavaScript and Kotlin across fixed dates, overrides, empty history, repeat windows, and fallback cases. Do not tune weights or editorial rankings during migration.

Streaks must preserve existing local-calendar semantics. Define timezone and day-boundary behaviour in tests before cloud sync.

## 8. Content integrity and rights

The current generated verse and translation JSON is the content baseline. Preserve Sanskrit verification repairs, adopted-source annotations, stable chapter.verse references, translator slug, author attribution, language, provenance, and licensing metadata. Never normalize or rewrite canonical Sanskrit during import.

Before public Play Store release, obtain explicit reuse rights for every modern English/Hindi translation and commentary. The repository's code/data-package licence does not itself prove that underlying text is commercially reusable. The existing DATA-SOURCES.md records this caveat. If rights are not cleared, exclude affected text from public builds or replace it only through an approved, documented content decision. Never silently substitute translations.

## 9. Privacy

Reading must not require an account. Keep bookmarks, notes, settings, daily picks, and progress local by default. Sync is optional and must explain what is uploaded. Never upload reading history or personal notes before explicit opt-in. Audit the existing Supabase schema, RLS, auth lifecycle, and conflict rules before reuse. Never ship service-role keys, signing keys, or private credentials in the APK or Git.

## 10. Quality gates

- Gesture accuracy: no accidental page changes during taps, selection, or nested reading scroll.
- Content parity: 701 references match exactly; no missing or duplicate IDs.
- Daily parity: Kotlin and JavaScript outputs match golden fixtures.
- Offline: cold launch, read, bookmark, note, resume, daily verse in airplane mode after first install.
- Accessibility: TalkBack identifies verse, chapter, translation, actions, progress and accessible navigation.
- Performance: smooth paging on a mid-range Android device; no network dependency on reader critical path.
- Privacy: no forced account or permission prompts.
- Release: reproducible signed APK/AAB; signing material outside repository.

## 11. Non-goals

No WebView wrapper as final product. No visible Previous/Next buttons on main reader. No rewrite of scripture or ranking during migration. No forced login, subscription, ads, or notification permission in MVP. No cloning Scroll the Bible's brand or proprietary UI. No production rollout before emulator/device acceptance and rights review.

## 12. Open decisions

Final display name and application ID; initial language and translator; minimum Android SDK; translation/commentary rights and distribution scope; whether sync is deferred (recommended); final icon, splash, and visual identity.

## 13. Delivery phases

0. Architecture/specification.
1. Content contract, validation, and parity fixtures.
2. Native shell, Compose navigation/theme, offline persistence, emulator boot.
3. Gesture reader, nested-scroll policy, chapter transitions, accessibility.
4. Today, study detail, search, topics, saved, journey.
5. Daily selection/streak parity, reminders, optional sync.
6. Automated tests, rights review, signed APK/AAB, Play internal testing, public release checklist.

Phase 0 exit condition: product and architecture reviewed before native implementation starts.
