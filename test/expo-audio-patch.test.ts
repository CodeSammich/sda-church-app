import fs from 'node:fs';
import path from 'node:path';

const {
  FORWARDED,
  MARKER,
  TARGET,
  patchMetadataInjectingPlayer,
} = require('../scripts/patch-expo-audio.cjs');

const root = path.join(__dirname, '..');
const installed = path.join(root, 'node_modules', TARGET);

// expo-audio 58.0.12's listener wrapper, unpatched.
const ORIGINAL = `internal class MetadataInjectingPlayer(
  player: Player
) : ForwardingPlayer(player) {
  private inner class MetadataForwardingListener(
    private val listener: Player.Listener
  ) : Player.Listener by listener {
    override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {
      listener.onMediaMetadataChanged(this@MetadataInjectingPlayer.mediaMetadata)
    }

    override fun onEvents(player: Player, events: Player.Events) {
      listener.onEvents(this@MetadataInjectingPlayer, events)
    }
  }
}
`;

// What the media session reads the notification's progress bar and
// play/pause button from (Media3's MediaSessionImpl.PlayerListener).
const SESSION_CALLBACKS = [
  'onMediaItemTransition',
  'onPositionDiscontinuity',
  'onTimelineChanged',
  'onIsPlayingChanged',
  'onIsLoadingChanged',
  'onPlaybackStateChanged',
  'onPlayWhenReadyChanged',
  'onPlaybackParametersChanged',
  'onAvailableCommandsChanged',
  'onPlayerError',
];

const overrides = (source: string, name: string) =>
  source.split('\n').filter(line => line.includes(`override fun ${name}(`)).length;

describe("expo-audio's media session hears the player (#804)", () => {
  it('passes every listener call on, so the notification follows chapter changes, seeks and pauses', () => {
    const patched = patchMetadataInjectingPlayer(ORIGINAL);
    expect(patched).toContain(MARKER);
    for (const name of SESSION_CALLBACKS) {
      expect(overrides(patched, name)).toBeGreaterThan(0);
    }
    for (const [signature, call] of FORWARDED as [string, string][]) {
      expect(patched).toContain(`override fun ${signature} = listener.${call}`);
    }
    // Inside the listener class, which still ends the file's last class.
    expect(patched.trimEnd().endsWith('listener.onMetadata(metadata)\n  }\n}')).toBe(true);
    expect(patched).toContain('@Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")\n  private inner class MetadataForwardingListener(');
    // expo-audio's own two overrides are untouched.
    expect(overrides(patched, 'onMediaMetadataChanged')).toBe(1);
    expect(overrides(patched, 'onEvents')).toBe(1);
  });

  it('changes nothing the second time, and nothing it does not know', () => {
    const patched = patchMetadataInjectingPlayer(ORIGINAL);
    expect(patchMetadataInjectingPlayer(patched)).toBe(patched);
    expect(patchMetadataInjectingPlayer(ORIGINAL.replace('Player.Listener by listener', 'Player.Listener'))).toBeNull();
  });

  it('fits the installed expo-audio', () => {
    // If this fails after updating expo-audio, check whether its
    // MetadataInjectingPlayer.kt now passes every Player.Listener call on. If it
    // does, delete scripts/patch-expo-audio.cjs, its call in
    // scripts/build-android-native.mjs, and this test; if not, update the
    // script for the new file.
    const patched = patchMetadataInjectingPlayer(fs.readFileSync(installed, 'utf8'));
    expect(patched).not.toBeNull();
    expect(patched).toContain(MARKER);
    for (const name of SESSION_CALLBACKS) {
      expect(overrides(patched, name)).toBeGreaterThan(0);
    }
  });

  it("forwards every callback of the Media3 version expo-audio builds with", () => {
    // FORWARDED lists Player.Listener's methods in Media3 1.9.1. A newer Media3
    // can add more: compare its Player.Listener, add any new ones, and update
    // this version.
    const gradle = fs.readFileSync(path.join(root, 'node_modules', 'expo-audio', 'android', 'build.gradle'), 'utf8');
    expect(gradle).toMatch(/androidxMedia3Version = "1\.9\.1"/);
  });

  it('builds expo-audio from its patched source on Android, not from its prebuilt library', () => {
    // Expo 58 links a prebuilt copy of each module from its local-maven-repo,
    // which the patch can't reach.
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(packageJson.expo.autolinking.android.buildFromSource).toContain('expo-audio');
    expect(packageJson.expo.autolinking.buildFromSource).toBeUndefined();
    expect(packageJson.expo.autolinking.ios?.buildFromSource).toBeUndefined();
  });

  it('runs before each Android build, before Gradle', () => {
    const build = fs.readFileSync(path.join(root, 'scripts', 'build-android-native.mjs'), 'utf8');
    const patch = build.indexOf('ensureExpoAudioPatched();');
    expect(patch).toBeGreaterThan(0);
    expect(patch).toBeLessThan(build.indexOf("run('./gradlew'"));
  });
});
