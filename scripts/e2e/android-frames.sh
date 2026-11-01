# Screen frames for Android emulator checks: screenshots, whether part of the
# screen changed, short screen recordings, and filmstrips of them. Source it:
#
#   . scripts/e2e/android-frames.sh
#
# For checks on a screen that keeps moving, where uiautomator can't dump it,
# such as the Bible reader following audio (#561) or a launch animation (#538).
# Compare states, not timings: the CI emulator draws in software and is slow.
#
# Environment: ADB and ADB_ARGS as in android-bible-audio.sh, and FFMPEG
# (default: ffmpeg) for regions, recordings, and filmstrips.

FRAMES_ADB_BIN="${ADB:-adb}"
read -r -a FRAMES_ADB_EXTRA <<< "${ADB_ARGS:-}"
FRAMES_FFMPEG="${FFMPEG:-ffmpeg}"
frames_adb() { "$FRAMES_ADB_BIN" "${FRAMES_ADB_EXTRA[@]}" "$@"; }

screenshot() { # out.png
  frames_adb exec-out screencap -p > "$1"
}

# A fingerprint of a region of a screenshot, given as fractions of its width
# and height, so two screenshots can be compared without the status bar's
# clock or a progress bar that moves on its own.
region_hash() { # png x0 y0 x1 y1
  "$FRAMES_FFMPEG" -loglevel error -i "$1" \
    -vf "crop=w=iw*($4-$2):h=ih*($5-$3):x=iw*$2:y=ih*$3,format=rgb24" -f md5 - 2>/dev/null |
    sed 's/^MD5=//'
}

# Takes screenshots until two in a row match in the region, so a scroll or an
# animation has finished; prints the region's hash. TRIES screenshots at most.
settled_region() { # out.png x0 y0 x1 y1
  local out="$1" previous='' current attempt
  shift
  for attempt in $(seq 1 "${TRIES:-10}"); do
    screenshot "$out"
    current=$(region_hash "$out" "$@")
    if [ -n "$current" ] && [ "$current" = "$previous" ]; then
      echo "$current"
      return 0
    fi
    previous="$current"
    sleep 1
  done
  return 1
}

# Starts recording the screen on the device, in the background, for at most
# `seconds`; record_finish waits for it and copies the clip here. Emulators
# without a video encoder can't record; record_finish then returns non-zero,
# so treat a recording as a picture for people, not as a check.
FRAMES_RECORDING_PID=''
FRAMES_RECORDING_NAME=''
record_start() { # name seconds
  FRAMES_RECORDING_NAME="$1"
  frames_adb shell rm -f "/sdcard/$1.mp4" >/dev/null 2>&1
  frames_adb shell screenrecord --time-limit "$2" --size 540x1200 --bit-rate 2000000 \
    "/sdcard/$1.mp4" >/dev/null 2>&1 &
  FRAMES_RECORDING_PID=$!
}
record_finish() { # out.mp4
  [ -n "$FRAMES_RECORDING_PID" ] || return 1
  wait "$FRAMES_RECORDING_PID" 2>/dev/null
  FRAMES_RECORDING_PID=''
  frames_adb pull "/sdcard/$FRAMES_RECORDING_NAME.mp4" "$1" >/dev/null 2>&1 || return 1
  frames_adb shell rm -f "/sdcard/$FRAMES_RECORDING_NAME.mp4" >/dev/null 2>&1
  [ -s "$1" ]
}

# One picture of a clip: a frame every 1/fps seconds, in rows of `columns`,
# for a person to look at in a CI artifact.
filmstrip() { # in.mp4 out.png seconds [fps] [columns]
  local fps="${4:-1}" columns="${5:-6}" frames rows
  frames=$(awk -v s="$3" -v f="$fps" 'BEGIN { n = int(s * f + 0.999); print (n < 1 ? 1 : n) }')
  rows=$(( (frames + columns - 1) / columns ))
  "$FRAMES_FFMPEG" -loglevel error -y -i "$1" \
    -vf "fps=$fps,scale=240:-1,tile=${columns}x${rows}:padding=4:color=white" -frames:v 1 "$2"
}
