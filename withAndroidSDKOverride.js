const fs = require("fs");
const path = require("path");
const {
  withDangerousMod,
  withProjectBuildGradle,
} = require("@expo/config-plugins");

const AUDIO_MODULE_PATH = path.join(
  "node_modules",
  "expo-audio",
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "audio",
  "AudioModule.kt",
);

const withAndroidSDKOverride = (config) => {
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = addAndroidOverride(
        config.modResults.contents,
      );
    }
    return config;
  });

  return withDangerousMod(config, ["android", async (config) => {
    // This patch is Android-only. iOS uses AVAudioSession through the shared
    // expo-audio `doNotMix` mode; it has no Android-style AUDIOFOCUS_GAIN.
    const sourcePath = path.join(config.modRequest.projectRoot, AUDIO_MODULE_PATH);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(
        `Expected expo-audio Android source at ${sourcePath}. ` +
          "The permanent audio-focus patch must be updated for this expo-audio version.",
      );
    }

    let source = fs.readFileSync(sourcePath, "utf8");
    const originalSource = source;

    // Android audio-focus behavior reference:
    // https://developer.android.com/media/optimize/audio-focus
    source = source.replace(
      `if (it == InterruptionMode.DO_NOT_MIX) {
          AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
        } else {`,
      `if (it == InterruptionMode.DO_NOT_MIX) {
          // Bible narration is long-form media. Keep permanent focus until the
          // app explicitly releases it, so a seek/buffer transition cannot let
          // another media app resume in the gap.
          AudioManager.AUDIOFOCUS_GAIN
        } else {`,
    );
    source = source.replace(
      `val requestType = if (interruptionMode == InterruptionMode.DO_NOT_MIX) {
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
      } else {`,
      `val requestType = if (interruptionMode == InterruptionMode.DO_NOT_MIX) {
        AudioManager.AUDIOFOCUS_GAIN
      } else {`,
    );

    const playerReleaseGuard =
      `if (!isPlaying && shouldReleaseFocus()) {
              releaseAudioFocus()
            }`;
    const keepSessionPlayerReleaseGuard =
      `if (!isPlaying && !keepAudioSessionActive && shouldReleaseFocus()) {
              releaseAudioFocus()
            }`;
    source = source.replace(playerReleaseGuard, keepSessionPlayerReleaseGuard);

    if (source === originalSource) {
      if (
        !originalSource.includes("AudioManager.AUDIOFOCUS_GAIN") ||
        !originalSource.includes(
          "!keepAudioSessionActive && shouldReleaseFocus()",
        )
      ) {
        throw new Error(
          "expo-audio Android audio-focus patch did not match the expected source layout.",
        );
      }
    }

    if (source !== originalSource) {
      fs.writeFileSync(sourcePath, source);
    }
    return config;
  }]);
};

function addAndroidOverride(buildGradle) {
  const overrideBlock = `
allprojects {
  ext {
    kotlinVersion = project.properties['android.kotlinVersion'] ?: "2.1.20"
  }
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).all {
    kotlinOptions {
      jvmTarget = "17"
    }
  }
}

subprojects {
  def configureAndroid = { p ->
    if (p.hasProperty('android')) {
      p.android {
        compileSdkVersion 36
        buildToolsVersion "36.0.0"
        defaultConfig {
          minSdkVersion 24
          targetSdkVersion 36
        }
      }
    }
  }
  if (it.state.executed) { configureAndroid(it) } else { it.afterEvaluate { configureAndroid(it) } }
}
`;

  // Check for the unique subprojects override block to avoid duplicates
  const marker = "compileSdkVersion 36";
  if (!buildGradle.includes(marker)) {
    return buildGradle + overrideBlock;
  }
  return buildGradle;
}

module.exports = withAndroidSDKOverride;
