#!/usr/bin/env bash
# Release APK (JS bundled; signed with the debug key the Expo template sets up), arm64-v8a only to keep it small.
# Needs the Android SDK (ANDROID_HOME) with the platform, build-tools and NDK the Gradle files ask for, and JDK 17.
# For the Play Store, create an upload key and a signingConfig first (see the README).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK, e.g. ~/Library/Android/sdk (Android Studio → Settings → Android SDK)}"
[ -d android ] || npx expo prebuild --platform android --no-install
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a)
mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/savd-ads.apk
[ "${KEEP_BUILD:-0}" = "1" ] || (cd android && ./gradlew clean >/dev/null)
echo "Built dist/savd-ads.apk — install with: adb install dist/savd-ads.apk"
