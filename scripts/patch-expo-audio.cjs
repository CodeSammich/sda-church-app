/**
 * Lets Android's media session hear what the Bible audio player does (#804).
 *
 * expo-audio 58 wraps the player it gives the lock-screen media session in
 * `MetadataInjectingPlayer`, so the session's title and narrator can change
 * without changing the track. The wrapper hands each session listener to
 * `MetadataForwardingListener`, a Kotlin `Player.Listener by listener`. Kotlin
 * doesn't delegate the Java interface's default methods, and every
 * `Player.Listener` method is one, so only the two it overrides reach the
 * session: `onMediaMetadataChanged` and `onEvents`. The session never hears
 * that the next chapter started, that a seek moved the position, or that
 * playback paused or resumed. Android draws the notification's progress bar
 * and play/pause button from what the session last heard.
 *
 * This adds the missing overrides, each passing the call straight on, to the
 * installed expo-audio. Every Android build runs it first
 * (scripts/build-android-native.mjs), and stops if it doesn't fit the
 * installed expo-audio; once applied, it changes nothing.
 * `test/expo-audio-patch.test.ts` fails if it no longer fits. When expo-audio
 * forwards these itself, delete this script.
 *
 *   node scripts/patch-expo-audio.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'Patched by scripts/patch-expo-audio.cjs';

const TARGET = path.join(
  'expo-audio',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'audio',
  'service',
  'MetadataInjectingPlayer.kt',
);

// The end of expo-audio 58's listener: its last override, then the class's
// closing brace. The forwarding methods go between them.
const ANCHOR = `    override fun onEvents(player: Player, events: Player.Events) {
      listener.onEvents(this@MetadataInjectingPlayer, events)
    }
  }`;

const CLASS_HEADER = `  private inner class MetadataForwardingListener(
    private val listener: Player.Listener
  ) : Player.Listener by listener {`;

// Every Player.Listener callback in Media3 1.9.1 other than the two expo-audio
// already overrides, as [signature, call]. Types are written in full, so the
// file needs no new imports; `Metadata` there is expo-audio's own class.
const FORWARDED = [
  ['onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int)', 'onTimelineChanged(timeline, reason)'],
  ['onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int)', 'onMediaItemTransition(mediaItem, reason)'],
  ['onTracksChanged(tracks: androidx.media3.common.Tracks)', 'onTracksChanged(tracks)'],
  ['onPlaylistMetadataChanged(mediaMetadata: MediaMetadata)', 'onPlaylistMetadataChanged(mediaMetadata)'],
  ['onIsLoadingChanged(isLoading: Boolean)', 'onIsLoadingChanged(isLoading)'],
  ['onLoadingChanged(isLoading: Boolean)', 'onLoadingChanged(isLoading)'],
  ['onAvailableCommandsChanged(availableCommands: Player.Commands)', 'onAvailableCommandsChanged(availableCommands)'],
  ['onTrackSelectionParametersChanged(parameters: androidx.media3.common.TrackSelectionParameters)', 'onTrackSelectionParametersChanged(parameters)'],
  ['onPlayerStateChanged(playWhenReady: Boolean, playbackState: Int)', 'onPlayerStateChanged(playWhenReady, playbackState)'],
  ['onPlaybackStateChanged(playbackState: Int)', 'onPlaybackStateChanged(playbackState)'],
  ['onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int)', 'onPlayWhenReadyChanged(playWhenReady, reason)'],
  ['onPlaybackSuppressionReasonChanged(playbackSuppressionReason: Int)', 'onPlaybackSuppressionReasonChanged(playbackSuppressionReason)'],
  ['onIsPlayingChanged(isPlaying: Boolean)', 'onIsPlayingChanged(isPlaying)'],
  ['onRepeatModeChanged(repeatMode: Int)', 'onRepeatModeChanged(repeatMode)'],
  ['onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean)', 'onShuffleModeEnabledChanged(shuffleModeEnabled)'],
  ['onPlayerError(error: androidx.media3.common.PlaybackException)', 'onPlayerError(error)'],
  ['onPlayerErrorChanged(error: androidx.media3.common.PlaybackException?)', 'onPlayerErrorChanged(error)'],
  ['onPositionDiscontinuity(reason: Int)', 'onPositionDiscontinuity(reason)'],
  ['onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int)', 'onPositionDiscontinuity(oldPosition, newPosition, reason)'],
  ['onPlaybackParametersChanged(playbackParameters: androidx.media3.common.PlaybackParameters)', 'onPlaybackParametersChanged(playbackParameters)'],
  ['onSeekBackIncrementChanged(seekBackIncrementMs: Long)', 'onSeekBackIncrementChanged(seekBackIncrementMs)'],
  ['onSeekForwardIncrementChanged(seekForwardIncrementMs: Long)', 'onSeekForwardIncrementChanged(seekForwardIncrementMs)'],
  ['onMaxSeekToPreviousPositionChanged(maxSeekToPreviousPositionMs: Long)', 'onMaxSeekToPreviousPositionChanged(maxSeekToPreviousPositionMs)'],
  ['onAudioSessionIdChanged(audioSessionId: Int)', 'onAudioSessionIdChanged(audioSessionId)'],
  ['onAudioAttributesChanged(audioAttributes: androidx.media3.common.AudioAttributes)', 'onAudioAttributesChanged(audioAttributes)'],
  ['onVolumeChanged(volume: Float)', 'onVolumeChanged(volume)'],
  ['onSkipSilenceEnabledChanged(skipSilenceEnabled: Boolean)', 'onSkipSilenceEnabledChanged(skipSilenceEnabled)'],
  ['onDeviceInfoChanged(deviceInfo: androidx.media3.common.DeviceInfo)', 'onDeviceInfoChanged(deviceInfo)'],
  ['onDeviceVolumeChanged(volume: Int, muted: Boolean)', 'onDeviceVolumeChanged(volume, muted)'],
  ['onVideoSizeChanged(videoSize: androidx.media3.common.VideoSize)', 'onVideoSizeChanged(videoSize)'],
  ['onSurfaceSizeChanged(width: Int, height: Int)', 'onSurfaceSizeChanged(width, height)'],
  ['onRenderedFirstFrame()', 'onRenderedFirstFrame()'],
  ['onCues(cues: List<androidx.media3.common.text.Cue>)', 'onCues(cues)'],
  ['onCues(cueGroup: androidx.media3.common.text.CueGroup)', 'onCues(cueGroup)'],
  ['onMetadata(metadata: androidx.media3.common.Metadata)', 'onMetadata(metadata)'],
];

const forwardingMethods = () => [
  '',
  `    // ${MARKER} (#804): Kotlin's \`by listener\` doesn't delegate`,
  "    // Player.Listener's default methods, so each one is passed on here.",
  ...FORWARDED.map(([signature, call]) => `    override fun ${signature} = listener.${call}`),
].join('\n');

/**
 * Returns `source` with the forwarding methods added, the same text if they
 * are already there, or null if it isn't the listener this patch knows.
 */
const patchMetadataInjectingPlayer = (source) => {
  if (source.includes(MARKER)) return source;
  const header = source.indexOf(CLASS_HEADER);
  const anchor = source.indexOf(ANCHOR, header);
  if (header < 0 || anchor < 0) return null;
  const end = anchor + ANCHOR.length - '\n  }'.length;
  const suppress = '  @Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")\n';
  return (
    source.slice(0, header) +
    suppress +
    source.slice(header, end) +
    '\n' +
    forwardingMethods() +
    source.slice(end)
  );
};

/** Patches the installed expo-audio. Returns what it did. */
const patchInstalledExpoAudio = (nodeModules = path.join(__dirname, '..', 'node_modules')) => {
  const file = path.join(nodeModules, TARGET);
  if (!fs.existsSync(file)) return { status: 'missing', file };
  const source = fs.readFileSync(file, 'utf8');
  const patched = patchMetadataInjectingPlayer(source);
  if (patched === null) return { status: 'unknown', file };
  if (patched === source) return { status: 'already', file };
  fs.writeFileSync(file, patched);
  return { status: 'patched', file };
};

/** Patches the installed expo-audio, or throws if it can't. */
const ensureExpoAudioPatched = (nodeModules) => {
  const { status, file } = patchInstalledExpoAudio(nodeModules);
  if (status === 'patched') {
    console.log(`Patched expo-audio's media session listener: ${file}`);
  } else if (status !== 'already') {
    throw new Error(
      `scripts/patch-expo-audio.cjs doesn't fit the installed expo-audio (${status}: ${file}). ` +
        "Without it, Android's media notification doesn't follow chapter changes (#804). " +
        'See the script for what to check.',
    );
  }
};

if (require.main === module) {
  ensureExpoAudioPatched();
}

module.exports = {
  MARKER,
  FORWARDED,
  TARGET,
  patchMetadataInjectingPlayer,
  patchInstalledExpoAudio,
  ensureExpoAudioPatched,
};
