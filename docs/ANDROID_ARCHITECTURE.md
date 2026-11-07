# Scroll the Geeta — Android Architecture

Status: Proposed baseline; Android implementation has not started.  
Architecture: native, modular-by-feature, offline-first Android app.  
UI: Kotlin + Jetpack Compose.

## 1. System context

The existing Vite/JavaScript app remains the content and behaviour reference during migration. Android is a separate native client. It must not embed the website in a WebView or depend on the website at runtime.

Conceptual flow:
Reader → Compose UI → ViewModels / StateFlow → domain use cases → repository interfaces → Room + DataStore + bundled scripture assets.
An optional sync adapter may connect to the existing Supabase backend only after schema, RLS, auth, and conflict behaviour are audited.
The existing web app supplies parity fixtures and the canonical generated content baseline.

## 2. Recommended stack

| Concern | Choice | Reason |
|---|---|---|
| Language | Kotlin | Native Android, type safety, coroutines |
| UI | Jetpack Compose + Material 3 | Native, accessible, adaptive UI |
| Navigation | Navigation Compose | Lifecycle-aware app navigation |
| Verse paging | Compose Foundation VerticalPager | Native one-verse-per-page gesture navigation |
| State | ViewModel + StateFlow | Lifecycle-aware and testable |
| Async | Kotlin coroutines | Structured concurrency |
| Local database | Room | Saved verses, notes, progress, daily picks |
| Preferences | DataStore | Language, translator, appearance, reminders |
| Background work | WorkManager | Deferrable reminders/sync only |
| DI | Constructor injection initially | Avoid premature complexity |
| Tests | JUnit, coroutine tests, Compose UI tests, AndroidX Test | Domain parity and gesture validation |
| Backend | Existing Supabase, optional | Reuse only after audit |
| Build | Gradle Kotlin DSL + version catalog | Reproducible dependency versions |

Do not add analytics, ads, crash-reporting SDKs, or AI SDKs in the first native alpha unless separately approved.

## 3. Proposed repository layout

android/
- settings.gradle.kts
- build.gradle.kts
- gradle/libs.versions.toml
- app/build.gradle.kts
- app/src/main/AndroidManifest.xml
- app/src/main/assets/scripture/ (manifest, verses, ranking, topics, explanations, translations)
- app/src/main/java/<package>/ (application, activity, core, feature, data)
- app/src/test/
- app/src/androidTest/

Within the Kotlin package:
- core/model: VerseRef, Verse, Translation, Chapter, DailyPick, ReadingProgress.
- core/database: Room entities, DAOs, migrations.
- core/datastore: preferences and settings.
- core/navigation: app routes and navigation state.
- core/ui: theme, typography, reusable accessible components.
- feature/reader, study, today, explore, search, saved, journey, settings.
- data/scripture: bundled JSON parser, content repository, reference index.
- data/progress: bookmarks, notes, streak, history, daily picks.
- data/sync: optional remote adapter.

Start with one Android Gradle app module and package-level feature boundaries. Split into Gradle modules only when build time or team size justifies it.

Dependency rule: Compose screens call ViewModels; ViewModels call use cases/repository interfaces; repositories coordinate Room, DataStore, and bundled assets. Screens never read JSON or call Supabase directly.

## 4. Canonical content contract

Stable verse identity is chapter.verse (for example 2.47), not an array index. Never persist an array index as a durable bookmark or progress identifier.

Current repository baseline:
- 18 chapters and 701 verses.
- Sanskrit and transliteration from src/data/verses.json.
- Ranking metadata from src/data/ranking.json.
- Topics from src/data/topics.json.
- Explanations/word meanings from src/data/explanations.json.
- Translation manifest and JSON under src/data/translations/.
- Provenance and known text verification notes from DATA-SOURCES.md.

### Import pipeline

1. Read committed generated assets, not raw external sources at Android runtime.
2. Add a deterministic export/validation script that copies canonical generated files into Android assets without reformatting text.
3. Emit a content manifest with schema version, source commit, record counts, and SHA-256 checksums.
4. Validate 18 chapter counts, 701 unique references, ordering, Sanskrit non-emptiness, and translation array alignment.
5. Preserve translator slug, author attribution, language, provenance, and rights metadata.
6. Add fixture-based parity tests comparing selected content records between web and Android.
7. Never edit canonical content by hand inside Android assets. Update source data, regenerate, review diff, then import.

### Translation rights gate

Modern translations/commentaries may have rights separate from their code/package licences. Public release must not ship a translation until distribution rights are confirmed. The content pipeline must support an explicit release allow-list. This is a release gate, not permission to silently change text.

## 5. Gesture-first reader architecture

### Paging

Use Compose Foundation VerticalPager, page size Fill, and a stable key based on VerseRef. Reader state owns current reference and page index. Direct reference navigation resolves through the repository index and moves to that page.

### Nested scroll

A vertical pager and long verse content share an axis. Implement and test a deliberate nested-scroll policy rather than competing raw pointer detectors:
- Inner content consumes movement while it can scroll.
- At top/bottom boundaries, a sufficiently intentional fling may transfer to pager.
- Short drags, text selection, links, sheet actions, and accessibility actions must not page.
- Keep the primary verse card compact; long commentary belongs in study detail.
- Prefer one-screen verse content, while respecting font scaling and allowing scroll when required.

Validate Compose pager/nested-scroll behaviour on emulators before inventing custom velocity logic. Gesture thresholds are implementation parameters, not fixed product promises.

### Reader state

ReaderUiState contains current VerseRef, index, total count, chapter, verse, selected translation, attribution, loading state, and typed error. ViewModel commands include openReference, onPageSettled, retry, and selectTranslation. Composables render state and emit intent; they do not implement content-selection rules.

Do not override Android's horizontal system Back gesture. Back dismisses overlays and returns from study/detail screens. Reader vertical gestures remain independent.

## 6. Local persistence

Suggested Room tables:
- saved_verses(ref primary key, saved_at, collection_id)
- verse_notes(id, ref, body, created_at, updated_at)
- reading_progress(profile_id, last_ref, updated_at)
- reading_events(id, ref, local_date, event_type), only if needed for streak semantics
- daily_picks(local_date primary key, ref, algorithm_version)
- collections(id, name, created_at, updated_at)

DataStore settings:
- selected language and translation slug per language.
- font scale, typography, theme.
- reminder enabled/time and permission status.
- sync opt-in status.
- last opened route if appropriate.

Use stable references and timestamps. Do not persist translated text redundantly in user data. Migrations must be tested. Local data remains available when signed out or sync is unavailable.

## 7. Daily selection and progress parity

Port the current JavaScript daily-pick algorithm into a pure Kotlin function without changing it. Preserve tier thresholds, weights, date-seeded hash/PRNG, overrides, repeat avoidance, and fallback. Create shared JSON golden fixtures from current JS and assert Kotlin returns identical references.

Streak/day-boundary behaviour must be specified and tested against existing JS before port. Display uses user's local calendar; UTC boundaries must not silently change today's verse.

## 8. Optional Supabase sync

Sync is not required for offline MVP. Before adding it:
- Audit existing tables, auth, RLS, unique keys, and current JavaScript conflict rules.
- Local database remains the immediate source of truth.
- Sync runs through repository adapters and WorkManager only when network is available.
- Use user-scoped rows and strict RLS; never trust client-supplied user IDs.
- Define updated-at/version conflict rules; preserve notes and bookmarks.
- No upload before explicit opt-in and privacy disclosure.
- Sign-out must not delete local-only content without confirmation.
- Do not migrate or modify existing Supabase schema during architecture phase.

## 9. Notifications

Ask notification permission only after the user enables reminders or sees the benefit. Daily reminder deep-links to daily verse. Core reading works if notifications are denied.

## 10. Build and distribution

- Android Studio stable channel and Gradle wrapper pinned in repository.
- Build debug APK for emulator and local sideload.
- Build release AAB for Play Console and signed APK for direct distribution.
- Keep signing keystore/password outside Git, protected CI secrets where applicable.
- Document reproducible build commands and versioning.
- Test Play internal track before production.
- Direct APK must be signed and include version/update guidance.
- Privacy policy and Data Safety declaration required before public Play release where applicable.
- Do not claim Play readiness until translation rights, privacy, signing, target SDK, and store assets are complete.

## 11. Test strategy

Unit tests:
- Verse reference parsing and bounds.
- Content manifest integrity.
- Translation resolution and attribution.
- Daily-pick parity against JS fixtures.
- Streak/day-boundary parity.
- Bookmark/note/progress repository behaviour.
- Sync conflicts when sync is added.

Compose/instrumentation:
- Swipe up/down changes exactly one verse.
- Small drag does not change verse.
- Tap/long-press does not accidentally page.
- Long content scrolls internally; boundary fling changes page only when intentional.
- Direct chapter/verse jump opens correct reference.
- Process recreation restores last verse.
- TalkBack actions navigate without swipe.
- System Back and edge gesture remain functional.

Emulator-first matrix:
1. Small phone profile.
2. Typical 6.1–6.5 inch phone.
3. Large font/display size.
4. Light and dark modes.
5. TalkBack smoke test.
6. Airplane mode after first install.
7. Mid-range performance profile.

No physical device is required to begin. Physical-device testing is a later release gate.

## 12. Implementation sequence

1. Confirm package ID, min SDK, default language/translator, and rights allow-list.
2. Add Android project skeleton and pinned Gradle/Compose toolchain.
3. Add content export, validation, and JS golden fixtures.
4. Build Room/DataStore and content repository.
5. Build Compose navigation/theme and Today screen.
6. Build gesture reader and nested-scroll tests.
7. Add study, search, saved, topics, journeys.
8. Port daily selection/streak logic with parity tests.
9. Add reminders and optional sync after audit.
10. Release hardening, accessibility, signing, Play internal track, APK distribution.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Translation rights unclear | Release allow-list and rights checklist |
| Kotlin/JS daily selection diverges | Golden fixtures and exact port |
| Long verses conflict with pager | Nested-scroll tests; separate study detail |
| Content changes during export | SHA-256 manifest and exact string parity |
| Sync overwrites local notes | Local-first model and explicit merge rules |
| Signing key lost/leaked | Secure backup outside Git |
| Web/Android drift | Web remains content/behaviour reference during migration |

## 14. Architecture exit criteria

Architecture is ready for implementation when product/gesture contract is approved, package name and minimum SDK are selected, content schema and rights allow-list are agreed, daily golden fixtures exist, emulator test matrix is defined, and no canonical scripture or selection logic has been changed.
