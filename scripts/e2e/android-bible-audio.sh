#!/usr/bin/env bash
# End-to-end checks of Bible audio failover on an Android emulator.
#
# Runs against a booted emulator with the app already installed, and checks
# what only a real player shows: that a failed player is replaced, that the
# lock-screen foreground service survives the switch, and that audio recovers
# with the screen off. The failover logic itself has Jest scenarios in
# test/bible-audio-source-controller.test.ts.
#
# It checks that a book downloaded to listen offline (#556) plays with no
# connection, moving between its chapters with the media keys.
#
# It also checks that the reader marks and follows the verse being read
# (#561) and doesn't fight a listener who scrolls. The build must set
# EXPO_PUBLIC_AUDIO_E2E=1, so the reader logs what it decides
# (services/AudioE2eLog.ts): the screen keeps moving while audio plays, so
# uiautomator can't read it. Screenshots show whether the page moved.
#
# Environment:
#   ADB                   adb binary (default: adb)
#   ADB_ARGS              extra adb arguments, such as -e for the emulator
#   E2E_OUTPUT            directory for screenshots and logs (default: e2e-output)
#   E2E_PRIMARY_BLOCKED   1 when the church's audio host (assets.adventistconnect.org)
#                         can't be resolved, which the CI workflow arranges; adds the
#                         "primary host down" scenario
#   E2E_ONLY              space-separated scenario names to run (default: all)
#   E2E_PACKAGE           the app ID to test (default: org.nyccsda.app.preview, the
#                         debug-signed preview build's; org.nyccsda.app for a store build)
#   FFMPEG                ffmpeg binary for comparing screenshots (default: ffmpeg)
#
# Prints PASS or FAIL for each scenario, and exits non-zero if any failed.
set -uo pipefail
# Checks below use `grep ... >/dev/null`, not `grep -q`: with pipefail, grep -q
# exits at its first match and cuts off adb's output, which fails the pipe.

ADB_BIN="${ADB:-adb}"
read -r -a ADB_EXTRA <<< "${ADB_ARGS:-}"
OUT="${E2E_OUTPUT:-e2e-output}"
PKG="${E2E_PACKAGE:-org.nyccsda.app.preview}"
mkdir -p "$OUT"
failures=0

adb_() { "$ADB_BIN" "${ADB_EXTRA[@]}" "$@"; }
sh_() { adb_ shell "$@" | tr -d '\r'; }
log() { printf '[%s] %s\n' "$(date +%T)" "$*"; }
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=scripts/e2e/android-frames.sh
. "$REPO/scripts/e2e/android-frames.sh"

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
  # First-launch setup is three steps (#523): Next, Next, then Get Started.
  if point=$(ATTR=text TRIES=15 element_center 'Next'); then
    # shellcheck disable=SC2086
    sh_ input tap $point >/dev/null
    sleep 1
    if point=$(ATTR=text TRIES=5 element_center 'Next'); then
      # shellcheck disable=SC2086
      sh_ input tap $point >/dev/null
      sleep 1
    fi
    if point=$(ATTR=text TRIES=5 element_center 'Get Started'); then
      # shellcheck disable=SC2086
      sh_ input tap $point >/dev/null
      sleep 2
      log 'Finished first-launch setup.'
    fi
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

# Earbuds' previous and next (#543). Started in Leviticus 2: previous more
# than 3 seconds in restarts the chapter, as Android does; at its start, it goes
# back to Leviticus 1, a chapter before the one that started playing; and next
# returns to Leviticus 2, so the queue's numbering survived the chapters
# inserted ahead of it. Paused, so the position stays under 3 seconds.
media_key() { sh_ input keyevent "$1" >/dev/null; }
position_under() { [ "$(session_field position)" -lt "$1" ] 2>/dev/null; }
paused_with_title() { is_paused && title_has "$1"; }
scenario_previous_before_start() {
  open_chapter LEV 2
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  wait_until 60 'Leviticus 2 playing' playing_with_title ' 2 ' || return 1
  sleep 6
  title_has ' 2 ' || { echo "moved to $(session_field title) by itself"; return 1; }
  media_key KEYCODE_MEDIA_PREVIOUS
  media_key KEYCODE_MEDIA_PAUSE
  wait_until 20 'Leviticus 2 restarted and paused' paused_with_title ' 2 ' || return 1
  position_under 3000 || { echo "previous left Leviticus 2 at $(session_field position)ms"; return 1; }
  media_key KEYCODE_MEDIA_PREVIOUS
  wait_until 20 'Leviticus 1 after previous at the start' title_has ' 1 ' || return 1
  media_key KEYCODE_MEDIA_NEXT
  wait_until 20 'Leviticus 2 after next' title_has ' 2 ' || return 1
}

# Bible audio downloaded to listen offline (#556): download 2 Thessalonians,
# three short chapters (1.2 MB in Mandarin), in Offline Bible Audio, which the
# audio settings popup's Listen offline row opens at the book's section, then
# play it with no connection, and move to the next chapter and back with the
# media keys. The popup's row says "Offline Bible Audio, 帖撒羅尼迦後書
# downloaded" once it's there; on the page, the book's row is "2 Thessalonians,
# Downloaded · 1.2 MB", and its button "Download 2 Thessalonians, 1.2 MB".
book_in_popup() { ui_dump | grep -E 'content-desc="Offline Bible Audio, 帖撒羅尼迦後書 downloaded' >/dev/null; }
book_on_page() { ui_dump | grep -E 'content-desc="2 Thessalonians, Downloaded' >/dev/null; }
scenario_downloaded_book_offline() {
  open_chapter 2TH 1
  local point
  point=$(element_center 'Audio settings[^"]*') || { echo 'no audio settings button'; return 1; }
  # shellcheck disable=SC2086
  sh_ input tap $point >/dev/null
  if book_in_popup; then
    # Already downloaded: the X, or back, closes the popup.
    sh_ input keyevent KEYCODE_BACK >/dev/null
  else
    point=$(element_center 'Offline Bible Audio, [^"]*') || { echo 'no Listen offline row'; return 1; }
    # shellcheck disable=SC2086
    sh_ input tap $point >/dev/null
    point=$(element_center 'Download 2 Thessalonians, [^"]*') || { echo 'no Download button for the book'; return 1; }
    # shellcheck disable=SC2086
    sh_ input tap $point >/dev/null
    # On mobile data, the app's popup asks first.
    if point=$(ATTR=text TRIES=3 element_center 'Use mobile data'); then
      # shellcheck disable=SC2086
      sh_ input tap $point >/dev/null
    fi
    wait_until 180 '2 Thessalonians downloaded' book_on_page || return 1
    # Back returns to the Bible.
    sh_ input keyevent KEYCODE_BACK >/dev/null
  fi
  network off
  sleep 2
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  wait_until 30 '2 Thessalonians 1 playing offline' playing_with_title ' 1 ' || return 1
  media_key KEYCODE_MEDIA_NEXT
  wait_until 20 '2 Thessalonians 2 playing offline' playing_with_title ' 2 ' || return 1
  # Previous goes back a chapter in a chapter's first seconds, and restarts it after.
  media_key KEYCODE_MEDIA_PREVIOUS
  sleep 1
  title_has ' 2 ' && media_key KEYCODE_MEDIA_PREVIOUS
  wait_until 20 '2 Thessalonians 1 playing offline again' playing_with_title ' 1 ' || return 1
}

# What the reader decided (#561), oldest first: one decision a line, such as
# "following verse 3" or "JHN 3:3 is being read at 28503 ms".
reader_log() {
  adb_ logcat -d -s ReactNativeJS:V | tr -d '\r' | sed -n 's/.*Bible reader: //p' | sed "s/'\$//"
}
reader_lines() { reader_log | wc -l; }
# The number of the first decision matching the extended regex $1 after line $2.
reader_line_after() { # regex [after-line]
  reader_log | awk -v after="${2:-0}" -v re="$1" 'NR > after && $0 ~ re { print NR; exit }'
}
reader_has_after() { [ -n "$(reader_line_after "$1" "${2:-0}")" ]; }

# The verse the bundled times say is being read at a position, with the
# reader's half-second lead (services/BibleAudioTimings.ts).
expected_verse() { # narrator book chapter ms
  node -e '
    const fs = require("fs");
    const [repo, narrator, book, chapter, ms] = process.argv.slice(1);
    const file = `${repo}/assets/bible/audio-timings/${narrator}/${book.toLowerCase()}.biblejson`;
    const times = JSON.parse(fs.readFileSync(file, "utf8")).chapters[Number(chapter)] || [];
    let verse = "";
    times.forEach((start, index) => { if (start !== null && start - 0.5 <= ms / 1000) verse = index + 1; });
    console.log(verse);' "$REPO" "$@"
}

# Every verse the reader marked is the one the bundled times give for where
# the player was, and the verses it followed never go backwards.
reader_matches_times() {
  local line book chapter verse ms expected
  while read -r line; do
    read -r book chapter verse ms <<< "$(sed -E 's/^([1-3A-Z]+) ([0-9]+):([0-9]+) is being read at ([0-9]+) ms$/\1 \2 \3 \4/' <<< "$line")"
    expected=$(expected_verse cuv-mandarin "$book" "$chapter" "$ms")
    [ "$expected" = "$verse" ] ||
      { echo "marked $book $chapter:$verse at ${ms}ms; the bundled times say verse $expected"; return 1; }
  done < <(reader_log | grep -E '^[1-3A-Z]+ [0-9]+:[0-9]+ is being read at [0-9]+ ms$')
}

# The reader's text, below the header and above the audio controls, and right
# of the bar that marks the verse being read: it changes only when the page
# scrolls. A follow or a scroll by hand has finished when it stops changing.
REGION=(0.08 0.15 0.95 0.62)
page() { settled_region "$OUT/$1.png" "${REGION[@]}"; }

# Pauses with the earbuds' key, where the screen goes still, and finds the
# controls again: a scroll by hand shows or hides the tab bar, which moves them.
pause_and_locate() {
  media_key KEYCODE_MEDIA_PAUSE
  wait_until 30 'paused' is_paused || return 1
  locate_controls || { echo 'no play button after pausing'; return 1; }
}

# Drags the page down and holds it, so it shows earlier verses.
FINGER_X=540
hold_page_back() {
  sh_ input motionevent DOWN "$FINGER_X" 800 >/dev/null
  sh_ input motionevent MOVE "$FINGER_X" 1100 >/dev/null
  sh_ input motionevent MOVE "$FINGER_X" 1400 >/dev/null
  sh_ input motionevent MOVE "$FINGER_X" 1700 >/dev/null
}
let_go() { sh_ input motionevent UP "$FINGER_X" 1700 >/dev/null; }

# John 3 plays, and the reader marks and follows each verse as it's read, at
# the place the bundled times give. After a seek while paused, it marks and
# follows the verse at the new place.
scenario_verse_follows_audio() {
  open_chapter JHN 3
  locate_controls || { echo 'no play button'; return 1; }
  local top followed
  top=$(page follow-top) || { echo 'the chapter never settled'; return 1; }
  tap_play_pause
  wait_until 120 'John 3:3 followed' reader_has_after '^following verse 3$' || return 1
  local numbers
  numbers=$(reader_log | sed -n 's/^following verse //p' | tr '\n' ' ')
  awk '{ for (i = 2; i <= NF; i++) if ($i < $(i - 1)) exit 1 }' <<< "$numbers" ||
    { echo "followed verses out of order: $numbers"; return 1; }
  followed=$(page follow-verse-3) || { echo 'the page never settled'; return 1; }
  [ "$followed" != "$top" ] || { echo 'the page did not move to follow John 3:3'; return 1; }
  pause_and_locate || return 1
  local mark
  mark=$(reader_lines)
  seek_to_fraction 0.7 || { echo 'no seek bar'; return 1; }
  wait_until 30 'the verse at the new place marked' \
    reader_has_after 'is being read at' "$mark" || return 1
  local verse
  verse=$(reader_log | tail -n +"$((mark + 1))" | sed -nE 's/^JHN 3:([0-9]+) is being read.*/\1/p' | tail -1)
  [ "${verse:-0}" -gt 10 ] || { echo "after seeking to 70% the reader marked verse ${verse:-none}"; return 1; }
  wait_until 30 "John 3:$verse followed" reader_has_after "^following verse $verse\$" "$mark" || return 1
  [ "$(page follow-after-seek)" != "$followed" ] || { echo 'the page did not move after the seek'; return 1; }
  reader_matches_times
}

# Psalm 119, whose verses are short. The listener drags the page back and
# holds it while the narrator moves on: the reader leaves the page alone. Let
# go, and a few seconds later it goes back to the verse being read.
scenario_scroll_by_hand() {
  open_chapter PSA 119
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  # By verse 8 the page has scrolled, so dragging it back moves it.
  wait_until 180 'Psalm 119:8 followed' reader_has_after '^following verse 8$' || return 1
  local mark held moved followed
  followed=$(page scroll-following) || { echo 'the page never settled'; return 1; }
  record_start scroll-by-hand 50
  mark=$(reader_lines)
  hold_page_back
  wait_until 30 'the reader to stop following' \
    reader_has_after '^stopped following: scrolled by hand$' "$mark" || { let_go; return 1; }
  held=$(page scroll-held) || { let_go; echo 'the held page never settled'; return 1; }
  [ "$held" != "$followed" ] || { let_go; echo 'dragging did not move the page'; return 1; }
  local held_at
  held_at=$(reader_lines)
  wait_until 60 'a verse read while the page is held' \
    reader_has_after 'is being read at' "$held_at" || { let_go; return 1; }
  screenshot "$OUT/scroll-held-later.png"
  local later
  later=$(region_hash "$OUT/scroll-held-later.png" "${REGION[@]}")
  let_go
  [ "$later" = "$held" ] || { echo 'the reader moved the page while the listener held it'; return 1; }
  wait_until 60 'following again after letting go' \
    reader_has_after '^following again after a scroll by hand$' "$mark" || return 1
  local resumed
  resumed=$(reader_line_after '^following again after a scroll by hand$' "$mark")
  reader_log | sed -n "$((mark + 1)),$((resumed - 1))p" | grep '^following verse' >/dev/null &&
    { echo 'the reader followed a verse before the listener let go and waited'; return 1; }
  wait_until 30 'the verse being read followed' reader_has_after '^following verse' "$resumed" || return 1
  moved=$(page scroll-resumed) || { echo 'the page never settled after following again'; return 1; }
  [ "$moved" != "$held" ] || { echo 'the page did not go back to the verse being read'; return 1; }
  if record_finish "$OUT/scroll-by-hand.mp4"; then
    filmstrip "$OUT/scroll-by-hand.mp4" "$OUT/scroll-by-hand-filmstrip.png" 50 1 10 ||
      log 'scroll-by-hand: no filmstrip'
  fi
  reader_matches_times
}

# Paused, the listener scrolls: the page stays where they put it, however long
# they read. Play takes it back to the verse being read.
scenario_scroll_while_paused() {
  open_chapter JHN 3
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  wait_until 120 'John 3:3 followed' reader_has_after '^following verse 3$' || return 1
  pause_and_locate || return 1
  local mark still played back
  mark=$(reader_lines)
  sh_ input swipe "$FINGER_X" 800 "$FINGER_X" 1700 300 >/dev/null
  wait_until 30 'the reader to stop following' \
    reader_has_after '^stopped following: scrolled by hand$' "$mark" || return 1
  wait_until 60 'the scroll timer to pass while paused' \
    reader_has_after '^paused; following again at play$' "$mark" || return 1
  still=$(page paused-scrolled) || { echo 'the page never settled'; return 1; }
  reader_has_after '^following verse' "$mark" && { echo 'the reader moved the page while paused'; return 1; }
  locate_controls || { echo 'no play button after scrolling'; return 1; }
  played=$(reader_lines)
  tap_play_pause
  wait_until 30 'play pressed' reader_has_after '^following again: play pressed$' "$played" || return 1
  wait_until 30 'the verse being read followed' reader_has_after '^following verse' "$played" || return 1
  back=$(page paused-played) || { echo 'the page never settled after play'; return 1; }
  [ "$back" != "$still" ] || { echo 'play did not take the page back to the verse being read'; return 1; }
}

# Psalm 117 plays into Psalm 118 with the screen off. When the screen comes
# back on, the reader shows Psalm 118 and follows the verse being read.
scenario_follow_after_screen_off() {
  open_chapter PSA 117
  locate_controls || { echo 'no play button'; return 1; }
  tap_play_pause
  wait_until 60 'Psalm 117 marked' reader_has_after '^PSA 117:[0-9]+ is being read' || return 1
  screen_off
  wait_until 150 'Psalm 118 playing with the screen off' playing_with_title ' 118 ' || return 1
  local mark
  mark=$(reader_lines)
  wake
  wait_until 60 'a verse of Psalm 118 marked after waking' \
    reader_has_after '^PSA 118:[0-9]+ is being read' "$mark" || return 1
  local marked verse
  marked=$(reader_line_after '^PSA 118:[0-9]+ is being read' "$mark")
  verse=$(reader_log | sed -n "${marked}p" | sed -E 's/^PSA 118:([0-9]+) .*/\1/')
  wait_until 30 "Psalm 118:$verse followed" reader_has_after "^following verse $verse\$" "$((marked - 1))" || return 1
  reader_matches_times
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
run previous-before-start scenario_previous_before_start
run downloaded-book-offline scenario_downloaded_book_offline
run verse-follows-audio scenario_verse_follows_audio
run scroll-by-hand scenario_scroll_by_hand
run scroll-while-paused scenario_scroll_while_paused
run follow-after-screen-off scenario_follow_after_screen_off
wake

if [ "$failures" -gt 0 ]; then
  log "$failures scenario(s) failed; details are in $OUT"
  exit 1
fi
log 'All scenarios passed.'
