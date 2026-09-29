#!/usr/bin/env bash
# Adds signed binaries to this version's GitHub Release, creating the release if
# it doesn't exist yet. Native Android build (AAB and APK) and Native iOS build
# (IPA) both call it after a push to main, and either may finish first. It
# refuses to replace a file the release already has, so a published binary is
# never overwritten; publishing another build needs a new version.
#
#   scripts/publish-github-release.sh <tag> <file>...
#
# Needs GH_TOKEN with contents: write, GITHUB_REPOSITORY, and GITHUB_SHA.
set -euo pipefail

TAG="${1:-}"
shift || true
if [ -z "$TAG" ] || [ "$#" -eq 0 ]; then
  echo "Usage: $0 <tag> <file>..." >&2
  exit 1
fi

exists=false
names=''
if gh release view "$TAG" --repo "$GITHUB_REPOSITORY" >/dev/null 2>&1; then
  exists=true
  names="$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json assets --jq '.assets[].name')"
fi

for file in "$@"; do
  name="$(basename "$file")"
  if grep -qxF -- "$name" <<<"$names"; then
    echo "::error title=Already published::The $TAG release already has $name. Bump the version before publishing another build." >&2
    exit 1
  fi
done

if [ "$exists" = false ]; then
  if gh release create "$TAG" "$@" \
    --repo "$GITHUB_REPOSITORY" \
    --target "$GITHUB_SHA" \
    --title "Release $TAG" \
    --notes "Signed native binaries built from commit $GITHUB_SHA." \
    --latest; then
    exit 0
  fi
  # The other workflow created the release at the same moment.
  echo "The $TAG release appeared meanwhile; adding the files to it."
fi

# Without --clobber, this also fails rather than replace a file of the same name.
gh release upload "$TAG" "$@" --repo "$GITHUB_REPOSITORY"
