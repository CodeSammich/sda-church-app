#!/usr/bin/env bash
# Frees disk space on a GitHub-hosted Linux runner before an Android emulator
# starts. The emulator's userdata partition needs about 7.4 GB, and one runner
# had only 6.4 GB free, so its emulator failed with "Not enough space to create
# userdata partition" (#632). Every workflow that boots an emulator runs this
# first.
#
#   scripts/free-runner-disk.sh
#
# It removes only preinstalled tools these jobs never use: .NET, Haskell,
# Swift, Boost, PowerShell, CodeQL's bundles, and Docker images. Never the
# Android SDK, Java, Node, or Python, which they do use. It prints the free
# space before and after. A folder that's missing, or can't be removed, is
# skipped: the emulator's own check says if there still isn't room.
set -euo pipefail

# Where this runner image keeps the tools above. FREE_DISK_ROOT is for the
# tests, which point it at a scratch folder and leave Docker alone.
root="${FREE_DISK_ROOT:-}"
unused=(
  /usr/share/dotnet
  /opt/ghc
  /usr/local/.ghcup
  /usr/share/swift
  /usr/local/share/boost
  /usr/local/share/powershell
  /opt/microsoft/powershell
  /opt/hostedtoolcache/CodeQL
)

echo 'Free disk space before:'
df -h "${root:-/}"

# Each folder is tens of thousands of files, so they're removed side by side.
for dir in "${unused[@]}"; do
  if [ -d "$root$dir" ]; then
    echo "Removing $dir"
    sudo rm -rf "$root$dir" &
  fi
done
if [ -z "$root" ] && command -v docker >/dev/null 2>&1; then
  docker image prune --all --force >/dev/null 2>&1 &
fi
wait

echo 'Free disk space after:'
df -h "${root:-/}"
