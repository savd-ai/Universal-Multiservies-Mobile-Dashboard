#!/usr/bin/env bash
# Release build of the app for the iOS Simulator (JS bundled, no signing needed), arm64 only to keep it small.
# A device or App Store build needs a signing team: open ios/*.xcworkspace in Xcode and archive there.
# KEEP_BUILD=1 keeps the Xcode build folder for faster rebuilds; by default it is deleted to save disk space.
set -euo pipefail
cd "$(dirname "$0")/.."
export LANG="${LANG:-en_US.UTF-8}" LC_ALL="${LC_ALL:-en_US.UTF-8}"
[ -d ios ] || npx expo prebuild --platform ios --no-install
(cd ios && pod install)
WORKSPACE=$(ls -d ios/*.xcworkspace | head -1)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" -derivedDataPath build/ios \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO COMPILER_INDEX_STORE_ENABLE=NO -quiet
mkdir -p dist
rm -rf "dist/$SCHEME.app"
cp -R "build/ios/Build/Products/Release-iphonesimulator/$SCHEME.app" dist/
[ "${KEEP_BUILD:-0}" = "1" ] || rm -rf build/ios
echo "Built dist/$SCHEME.app — install on a booted simulator with: xcrun simctl install booted \"dist/$SCHEME.app\""
