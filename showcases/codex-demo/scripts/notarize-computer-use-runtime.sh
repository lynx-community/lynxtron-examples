#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 '/path/to/Open Computer Use.app'" >&2
  exit 2
fi

helper_app="$1"
: "${CODEX_DEMO_HELPER_SIGNING_IDENTITY:?Set CODEX_DEMO_HELPER_SIGNING_IDENTITY}"
: "${APPLE_API_KEY_PATH:?Set APPLE_API_KEY_PATH}"
: "${APPLE_API_KEY_ID:?Set APPLE_API_KEY_ID}"
: "${APPLE_API_ISSUER:?Set APPLE_API_ISSUER}"

staging_dir=$(mktemp -d "${TMPDIR:-/tmp}/codex-demo-notary.XXXXXX")
trap 'rm -rf "$staging_dir"' EXIT INT TERM
submission_zip="$staging_dir/open-computer-use-notary.zip"

codesign \
  --force \
  --options runtime \
  --timestamp \
  --sign "$CODEX_DEMO_HELPER_SIGNING_IDENTITY" \
  "$helper_app"

codesign --verify --strict --verbose=2 "$helper_app"
ditto -c -k --sequesterRsrc --keepParent "$helper_app" "$submission_zip"

xcrun notarytool submit "$submission_zip" \
  --key "$APPLE_API_KEY_PATH" \
  --key-id "$APPLE_API_KEY_ID" \
  --issuer "$APPLE_API_ISSUER" \
  --wait

xcrun stapler staple "$helper_app"
xcrun stapler validate "$helper_app"
spctl --assess --type execute --verbose=4 "$helper_app"

echo "Notarized helper is ready: $helper_app"
