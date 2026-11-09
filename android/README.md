# Native Android app

This is the native Android application, separate from the existing Vite website.

## Current baseline

- Kotlin + Jetpack Compose.
- Compose vertical paging is the planned reader interaction.
- Minimum Android API: 26 (provisional).
- Compile SDK: 37; target SDK: 36.
- Provisional application ID: `com.scrollthegeeta.app`. Confirm uniqueness and ownership before publishing; changing it after Play release creates a different app.
- Canonical scripture assets are generated from the existing web source by running `npm run export:android-content` at the repository root.

## Open in Android Studio

Open the `android/` directory as the project in Android Studio. The checked-in Gradle wrapper pins Gradle 9.9.0; Android Studio should prompt to install missing SDK platforms/build tools. Start with a Pixel emulator (API 36), then add small-screen and large-font profiles.

## Current state

The Compose application shell is in place. The scripture reader is intentionally not populated with placeholder verses. Content import validation and the Android reader are the next implementation steps.

No signing credentials belong in this directory or Git.
