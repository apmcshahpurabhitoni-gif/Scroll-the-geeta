# ADR-0001: Build Scroll the Geeta as a native Android app

Status: Proposed  
Date: 2026-11-08

## Context

The current product is a Vite/vanilla-JavaScript web app. The intended final product is an installable Android application distributed through Google Play and as a signed APK. The primary reader interaction must be vertical gesture paging, not visible next/previous buttons and not a WebView wrapper.

The repository already contains 18 chapters / 701 verses, translation assets, ranking, topics, explanations, daily selection, streaks, bookmarks, progress, and optional Supabase-related modules. These are the migration baseline.

## Decision

Build a separate native Android client using Kotlin and Jetpack Compose. Use Compose Foundation VerticalPager for one-verse-at-a-time gesture navigation, with a defined nested-scroll policy for long content. Keep the current web app as a reference and parity source during migration.

Use Room for local structured data, DataStore for settings, and repository/use-case boundaries for content and persistence. Bundle canonical scripture assets for offline use. Defer cloud sync until the local-first MVP is stable and the existing Supabase schema/RLS/sync behaviour has been audited.

## Consequences

Positive:
- Native Android gestures, lifecycle, accessibility, and system navigation.
- Offline reading without a web runtime.
- Clear separation between canonical scripture, domain rules, and presentation.
- Emulator-first automated testing and reproducible APK/AAB builds.

Trade-offs:
- A new Android codebase and release pipeline must be maintained alongside the web reference during migration.
- Existing JavaScript domain logic must be ported and verified with golden parity tests.
- Translation/commentary distribution rights must be confirmed before public release.
- Gesture and nested-scroll behaviour needs emulator testing.

## Rejected alternatives

- WebView wrapper: rejected because it preserves web runtime and interaction constraints instead of delivering a native app.
- Immediate rewrite of the website into a cross-platform framework: rejected because Android is the selected first target and the web app is a useful stable reference.
- Kotlin Multiplatform / Compose Multiplatform: deferred; iOS is not in initial scope.
- React Native / Flutter: not selected; Kotlin + Compose is the preferred native Android path.

## Revisit when

iOS becomes an active target, shared UI/runtime becomes important, or offline data size, sync scale, or feature complexity materially changes.
