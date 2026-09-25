# Android chapter continuation (#225)

Issue: https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/225

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
- Full Jest suite: 351 tests passed.
- The focused native queue suite covers 12 passing tests, including append-only
  replenishment and release-aware teardown.
- TypeScript diagnostics match unchanged HEAD; existing UI ref and layout
  typing errors still prevent a clean typecheck.

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
   reported mid-chapter pauses. These have not been reproduced or confirmed fixed.

The native playlist starts with 24 future chapters, then uses append-only rolling
replenishment as each active chapter becomes known. During normal playback this
does not pause after chapter 24. If the app is fully suspended before JavaScript
can append more tracks, the current native buffer can still be exhausted. The
playback-speed option was removed because this Expo 58 preview's playlist setter has
a native shared-object cast bug; audio stays at the stable 1× default.
Physical-device checks are also needed
for buffering, audio focus, and notification metadata timing in this preview SDK.
