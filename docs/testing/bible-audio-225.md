# Android chapter continuation (#225)

Issue: https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/225

This is a test record from the 0.38.x release, which merged on September 25, 2026. The
test counts, typecheck result, and device status below are as of then. For what runs
automatically now, see [Automated now](#automated-now).

The previous Android path finished a recording, changed the reader route, waited
for chapter text, then replaced and started the player in a React effect. A
suspended or failed text request could therefore stop narration too. Text
recovery on foreground previously subscribed only to browser visibility events.

Android now uses Expo 58's native `AudioPlaylist`. On Play, the app supplies the
current recording and up to 24 following chapter descriptors. Native playback
owns transitions and notification next/previous controls. Text follows the
active track independently; Android starts with a bounded queue and leaves it
untouched while ExoPlayer changes tracks. As each native track becomes active,
the app appends newly discovered future chapters without removing active or
queued native tracks. On
foreground, `AppState` retries missing or unfinished text without issuing Play.
The `doNotMixPersistent` audio mode is unchanged. iOS retains its single player;
the web retains its existing media queue.

The first device test reported `Cannot use shared object that was already
released` on Play, followed by a delayed crash. The Android adapter now creates
its playlist in its own committed effect, invalidates access before destruction,
and creates a new native object after cleanup/setup replay. It no longer holds a
playlist managed by Expo's automatic-release hook. Reader source-load timers are
cancelled on pause/unload and reject stale attempts before reading native status.
Native-call errors include the operation and preserve the original cause. The
Android bridge's wrapped `AudioPlaylist`/`Integer` cast error is treated as a
released-handle race, so it cannot escape from a React status effect or timer.

## Automated checks

- Native queue tests cover advancement without rendering/text, append-only queue
  updates during a transition, returning to the initial chapter, and discarding
  stale tracks after a new selection. Release-aware mocks also cover delayed
  calls after teardown, queued events from a destroyed playlist, and
  cleanup/setup replay with a fresh native instance.
- Full Jest suite: 351 tests passed at the time.
- The focused native queue suite covered 12 passing tests, including append-only
  replenishment and release-aware teardown. (`test/bible-audio-native-queue.test.ts`
  has 18 tests now; the newer ones cover replacing a failed playlist without stopping
  the lock-screen service.)
- TypeScript diagnostics matched the unchanged code; existing UI ref and layout
  typing errors then prevented a clean typecheck. (`npm run typecheck` passes now.)

## Device verification still required

No device was connected during implementation. Use a newly bundled Android build:

1. Play BSB and Chinese CUV audio separately. Lock the phone near the end of a
   chapter, then allow several chapters to complete. Verify continuous audio and
   notification controls. Unlock and verify text matches the active chapter.
2. Use notification Next and Previous, including returning to the first track
   and crossing a book boundary. Paused playback should remain paused.
3. Interrupt Bible audio with YouTube Music mid-chapter and during buffering.
   Bible audio must remain paused after unlocking; explicit Bible Play should
   interrupt YouTube Music.
4. Interrupt networking during a transition, then reconnect and unlock. Missing
   text should reload without Next/Previous navigation. Check both translations.
5. Check end-of-chapter and end-of-book timers, manual chapter/translation/source
   changes, and seeking.
6. Leave playback locked for at least 15 minutes to investigate the separately
   reported mid-chapter pauses. At the time, these had not been reproduced or
   confirmed fixed.

The native playlist starts with 24 future chapters, then uses append-only rolling
replenishment as each active chapter becomes known. During normal playback this
does not pause after chapter 24. If the app is fully suspended before JavaScript
can append more tracks, the current native buffer can still be exhausted. The
playback-speed option was removed because the Expo 58 preview's playlist setter had
a native shared-object cast bug; audio stays at the stable 1× default, and the option
hasn't returned. Physical-device checks were also needed
for buffering, audio focus, and notification metadata timing in that preview SDK.

## Automated now

**Android audio e2e** (`.github/workflows/android-audio-e2e.yml`), added in the 0.39.0
release, runs `scripts/e2e/android-bible-audio.sh` on an Android emulator for every
release pull request into `main`, where it's a required check. It uses the debug APK and
plays real Chinese CUV recordings. Its scenarios, and what to do when it fails, are in
the admin runbook's
[Bible audio emulator test](../operations/admin-runbook.md#bible-audio-emulator-test).
To run it on your own emulator, see
[Bible audio on an Android emulator](../README.md#bible-audio-on-an-android-emulator).

It checks the media session's state and title, not the screen's text, so it doesn't
cover whether the reader's text matches the active chapter. Of the steps above, it
covers part of step 1 (one chapter change with the screen off, in CUV only), part of
step 4 (audio, not text, recovering after a connection loss), part of step 5
(seeking), and automatic source failover. The rest of steps 1 to 6 stays manual on a
physical phone, and is in the admin runbook's
[Device checks before release](../operations/admin-runbook.md#device-checks-before-release).
