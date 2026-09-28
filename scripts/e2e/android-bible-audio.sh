#!/usr/bin/env bash
# End-to-end checks of Bible audio failover on an Android emulator.
#
# Runs against a booted emulator with the app already installed, and checks
# what only a real player shows: that a failed player is replaced, that the
# lock-screen foreground service survives the switch, and that audio recovers
# with the screen off. The failover logic itself has Jest scenarios in
# test/bible-audio-source-controller.test.ts.
#
# Environment:
#   ADB                   adb binary (default: adb)
#   ADB_ARGS              extra adb arguments, such as -e for the emulator
#   E2E_OUTPUT            directory for screenshots and logs (default: e2e-output)
#   E2E_PRIMARY_BLOCKED   1 when the church's audio host (assets.adventistconnect.org)
#                         can't be resolved, which the CI workflow arranges; adds the
#                         "primary host down" scenario
#   E2E_ONLY              space-separated scenario names to run (default: all)
#
# Prints PASS or FAIL for each scenario, and exits non-zero if any failed.
set -uo pipefail
# Checks below use `grep ... >/dev/null`, not `grep -q`: with pipefail, grep -q
# exits at its first match and cuts off adb's output, which fails the pipe.

ADB_BIN="${ADB:-adb}"
read -r -a ADB_EXTRA <<< "${ADB_ARGS:-}"
OUT="${E2E_OUTPUT:-e2e-output}"
PKG=org.nyccsda.app
mkdir -p "$OUT"
failures=0

adb_() { "$ADB_BIN" "${ADB_EXTRA[@]}" "$@"; }
sh_() { adb_ shell "$@" | tr -d '\r'; }
log() { printf '[%s] %s\n' "$(date +%T)" "$*"; }

wake() {
  sh_ input keyevent KEYCODE_WAKEUP >/dev/null
  sh_ wm dismiss-keyguard >/dev/null
  sh_ svc power stayon true >/dev/null
}
screen_off() {
  sh_ svc power stayon false >/dev/null
  sh_ input keyevent KEYCODE_SLEEP >/dev/null
}
screen_is_off() { sh_ dumpsys power | grep -E 'mWakefulness=(Asleep|Dozing)' >/dev/null; }
network() { # on|off
  local state=enable
  [ "$1" = off ] && state=disable
  sh_ svc wifi "$state" >/dev/null
  sh_ svc data "$state" >/dev/null
}

# Opens a CUV chapter in a freshly started app, so each scenario starts clean.
# A deep link with the same parameters as the last one is ignored, and a cold
# start avoids that.
open_chapter() { # book chapter
  sh_ am force-stop "$PKG" >/dev/null
  adb_ logcat -c
  sh_ am start -W -a android.intent.action.VIEW \
    -d "'sdachurchapp://bible?bookId=$1&chapter=$2&translationId=cmn_cuv'" "$PKG" >/dev/null
}

# A fresh install shows the Welcome dialog over the first screen, and then
# opens the Bible in its default translation rather than a deep link's. Get
# past it once, before any scenario; its default choices are fine.
# (open_chapter is defined above.)
ANIMATION_SCALES=(window_animation_scale transition_animation_scale animator_duration_scale)
SAVED_SCALES=()
restore_animations() {
  local i
  for i in "${!SAVED_SCALES[@]}"; do
    sh_ settings put global "${ANIMATION_SCALES[$i]}" "${SAVED_SCALES[$i]}" >/dev/null
  done
}
prepare_app() {
  # Animations keep the screen from going idle, which uiautomator needs.
  # They're restored when the script exits.
  local scale value
  for scale in "${ANIMATION_SCALES[@]}"; do
    value=$(sh_ settings get global "$scale")
    [ "$value" = null ] && value=1
    SAVED_SCALES+=("$value")
    sh_ settings put global "$scale" 0 >/dev/null
  done
  trap restore_animations EXIT
  wake
  # Open a Bible chapter, not Home: Home's Sabbath countdown ticks every
  # second, so its screen never goes idle.
  open_chapter GEN 2
  local point
  if point=$(ATTR=text TRIES=15 element_center 'Get Started'); then
    # shellcheck disable=SC2086
    sh_ input tap $point >/dev/null
    sleep 2
    log 'Dismissed the Welcome dialog.'
  fi
  sh_ am force-stop "$PKG" >/dev/null
}

# The screen's elements. uiautomator can't dump while anything animates, and
# then leaves the previous file behind, so the old dump is removed first.
ui_dump() {
  sh_ rm -f /sdcard/e2e-ui.xml
  sh_ uiautomator dump /sdcard/e2e-ui.xml >/dev/null 2>&1
  sh_ cat /sdcard/e2e-ui.xml 2>/dev/null | sed 's/></>\n</g'
}

# Prints the center of the first element whose content-desc (or, with
# ATTR=text, text) matches the extended regex $1, retrying while the screen
# loads. $2 picks a point along the element's width instead of its center.
element_bounds() { # regex
  local attr="${ATTR:-content-desc}" bounds attempt
  for attempt in $(seq 1 "${TRIES:-20}"); do
    bounds=$(ui_dump | grep "package=\"$PKG\"" | grep -E "$attr=\"$1\"" | head -1 |
      sed -nE 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/p')
    if [ -n "$bounds" ]; then
      echo "$bounds"
      return 0
    fi
    sleep 1
  done
  return 1
}
point_in() { # "x1 y1 x2 y2" [x-fraction]
  awk -v f="${2:-0.5}" '{ printf "%d %d\n", $1 + ($3 - $1) * f, ($2 + $4) / 2 }' <<< "$1"
}
element_center() { # regex [x-fraction]
  local bounds
  bounds=$(element_bounds "$1") || return 1
  point_in "$bounds" "${2:-0.5}"
}

# While audio plays, the progress bar and time update constantly, so the
# screen never goes idle and uiautomator can't dump it. The controls don't
# move, so find them once, when the chapter opens, and reuse them.
# The play/pause button is "Bible audio"; the seek bar is "Bible audio, 0:00 / 1:23".
PLAY_BOUNDS=''
SEEK_BOUNDS=''
locate_controls() {
  PLAY_BOUNDS=$(element_bounds 'Bible audio') || return 1
  SEEK_BOUNDS=$(TRIES=3 element_bounds 'Bible audio, [^"]*') || SEEK_BOUNDS=''
}
tap_play_pause() {
  [ -n "$PLAY_BOUNDS" ] || return 1
  # shellcheck disable=SC2046
  sh_ input tap $(point_in "$PLAY_BOUNDS") >/dev/null
}
seek_to_fraction() {
  [ -n "$SEEK_BOUNDS" ] || return 1
  # shellcheck disable=SC2046
  sh_ input tap $(point_in "$SEEK_BOUNDS" "$1") >/dev/null
}

# This app's media session: its playback state, position in ms, and title.
session() {
  sh_ dumpsys media_session | awk '
    /package=/ { ours = ($0 ~ /package=org\.nyccsda\.app/) }
    ours && /state=PlaybackState/ {
      match($0, /\{state=[A-Z_]+/); state = substr($0, RSTART + 7, RLENGTH - 7)
      match($0, /position=[0-9]+/); position = substr($0, RSTART + 9, RLENGTH - 9)
      if (state != "NONE") { print "state=" state; print "position=" position }
    }
    ours && /description=/ { sub(/.*description=/, ""); print "title=" $0 }'
}
session_field() { session | sed -n "s/^$1=//p" | head -1; }

wait_until() { # timeout-seconds description command...
  local timeout="$1" what="$2" deadline
  shift 2
  deadline=$(( $(date +%s) + timeout ))
  until "$@"; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "timed out after ${timeout}s waiting for: $what"
      return 1
    fi
    sleep 2
  done
}
is_playing() { [ "$(session_field state)" = PLAYING ]; }
is_paused() { [ "$(session_field state)" = PAUSED ]; }
title_has() { session_field title | grep -- "$1" >/dev/null; }
playing_with_title() { is_playing && title_has "$1"; }
foreground_service() { sh_ dumpsys activity services "$PKG" | grep 'isForeground=true' >/dev/null; }
app_log_has() { adb_ logcat -d -s ReactNativeJS:V | tr -d '\r' | grep -- "$1" >/dev/null; }

run() { # name function
  local name="$1"
  if [ -n "${E2E_ONLY:-}" ] && ! grep -w -- "$name" <<< "$E2E_ONLY" >/dev/null; then return; fi
  log "START $name"
  wake
  network on
  local reason
  if reason=$("$2" 2>&1); then
    log "PASS $name"
  else
    failures=$((failures + 1))
    log "FAIL $name: $(tail -1 <<< "$reason")"
    printf '%s\n' "$reason" > "$OUT/$name.txt"
    wake
    adb_ exec-out screencap -p > "$OUT/$name.png" 2>/dev/null
    adb_ logcat -d -v time -s ReactNativeJS:V > "$OUT/$name-app.log" 2>/dev/null
    session > "$OUT/$name-session.txt"
  fi
  network on
  sh_ am force-stop "$PKG" >/dev/null
}

# The church's host can't be resolved, so Genesis 1 plays from the Internet
# Archive as soon as the player reports the failure.
scenario_primary_host_down() {
  open_chapter GEN 1
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  wait_until 90 'Genesis 1 playing from the Internet Archive' \
    playing_with_title '(Internet Archive)' || return 1
  app_log_has 'Bible audio source failed to load; trying the next configured source.' ||
    { echo 'no failover logged'; return 1; }
}

# With the screen off, the playlist moves from Psalm 117 (about 30 seconds) to
# Psalm 118 by itself. Playback continues, and the lock-screen foreground
# service stays up. When the primary host is blocked, Psalm 118 also fails
# over with the screen off.
scenario_next_chapter_screen_off() {
  open_chapter PSA 117
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  wait_until 60 'Psalm 117 playing' is_playing || return 1
  screen_off
  wait_until 150 'Psalm 118 playing with the screen off' playing_with_title ' 118 ' || return 1
  screen_is_off || { echo 'the screen turned on'; return 1; }
  foreground_service || { echo 'the media foreground service stopped'; return 1; }
}

# A dead zone: Play offline, lock the screen, and wait. When the connection
# comes back, audio starts without an unlock.
scenario_dead_zone_screen_off() {
  open_chapter JHN 3
  locate_controls || { echo 'no play button'; return 1; }
  network off
  sleep 2
  tap_play_pause
  sleep 3
  screen_off
  sleep 90
  is_playing && { echo 'playing while offline'; return 1; }
  network on
  wait_until 60 'John 3 playing after the connection returned' is_playing || return 1
  screen_is_off || { echo 'the screen turned on'; return 1; }
  foreground_service || { echo 'the media foreground service stopped'; return 1; }
}

# The connection drops mid-chapter: the same host reloads where it stopped,
# and playback resumes there once the connection returns.
scenario_mid_chapter_offline() {
  open_chapter PSA 78
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  wait_until 60 'Psalm 78 playing' is_playing || return 1
  network off
  sleep 1
  seek_to_fraction 0.75 || { echo 'no seek bar'; return 1; }
  wait_until 60 'the mid-chapter reload' \
    app_log_has 'Bible audio stopped mid-chapter; reloading the same source.' || return 1
  network on
  wait_until 90 'Psalm 78 playing again' is_playing || return 1
  local position
  position=$(session_field position)
  [ "${position:-0}" -ge 240000 ] ||
    { echo "resumed at ${position}ms instead of where it stopped"; return 1; }
}

# Pausing and resuming a playing chapter continues from the same place.
scenario_pause_and_resume() {
  open_chapter JHN 1
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  wait_until 60 'John 1 playing' is_playing || return 1
  sleep 5
  tap_play_pause
  wait_until 20 'John 1 paused' is_paused || return 1
  local paused_at
  paused_at=$(session_field position)
  tap_play_pause
  wait_until 30 'John 1 playing again' is_playing || return 1
  local resumed_at
  resumed_at=$(session_field position)
  [ "${resumed_at:-0}" -ge "${paused_at:-0}" ] && [ "${resumed_at:-0}" -gt 0 ] ||
    { echo "resumed at ${resumed_at}ms after pausing at ${paused_at}ms"; return 1; }
}

sh_ cmd media_session volume --stream 3 --set 0 >/dev/null 2>&1
prepare_app
if [ "${E2E_PRIMARY_BLOCKED:-0}" = 1 ]; then
  run primary-host-down scenario_primary_host_down
fi
run next-chapter-screen-off scenario_next_chapter_screen_off
run dead-zone-screen-off scenario_dead_zone_screen_off
run mid-chapter-offline scenario_mid_chapter_offline
run pause-and-resume scenario_pause_and_resume
wake

if [ "$failures" -gt 0 ]; then
  log "$failures scenario(s) failed; details are in $OUT"
  exit 1
fi
log 'All scenarios passed.'
