#!/usr/bin/env bash
# Installs Android SDK packages, trying up to three times. A download that
# arrives broken fails the install ("Error reading Zip content from a
# SeekableByteChannel" for the emulator's system image, October 2026), so each
# retry throws away the partial downloads and fetches them again. Every Android
# workflow installs its SDK packages through this.
#
#   scripts/sdkmanager-install.sh <package>...
#
# Needs sdkmanager on PATH, ANDROID_HOME, and the SDK licenses already accepted.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <package>..." >&2
  exit 1
fi

attempts=3
for attempt in $(seq 1 "$attempts"); do
  if sdkmanager "$@"; then
    exit 0
  fi
  if [ "$attempt" -lt "$attempts" ]; then
    echo "::warning::sdkmanager failed (attempt $attempt of $attempts); downloading again."
    rm -rf "$ANDROID_HOME/.temp" "$ANDROID_HOME/.downloadIntermediates"
    sleep $((attempt * ${SDKMANAGER_RETRY_DELAY:-15}))
  fi
done
echo "::error::sdkmanager failed $attempts times."
exit 1
