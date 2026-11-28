/**
 * Shows Android's bottom sheets when animations are off (#867).
 *
 * The app's sheets are react-native-screens' FormSheet (components/AppSheet.tsx).
 * On Android it slides a sheet in with an AnimatorSet whose `doOnStart` first
 * moves the sheet below the screen. With Android's animations off (Settings →
 * Accessibility → Remove animations, which older members turn on, and the
 * key-screen emulators), Android runs a zero-length animation to its end as
 * it starts, before that `doOnStart`: the slide ends at the top, then
 * `doOnStart` moves the sheet back below the screen, where it stays. Only the
 * dim showed, over the page, with no sheet.
 *
 * This moves the sheet below the screen when the animation is made, just
 * before it starts, so a zero-length one ends with the sheet in place. With
 * animations on, nothing changes: the sheet starts below and slides up.
 *
 * Gradle builds react-native-screens from node_modules, so every Android build
 * runs this first (scripts/build-android-native.mjs), and stops if it doesn't
 * fit the installed react-native-screens; once applied, it changes nothing.
 * `test/react-native-screens-patch.test.ts` fails if it no longer fits. When
 * react-native-screens sets the start position before it starts the
 * animation itself, delete this script.
 *
 *   node scripts/patch-react-native-screens.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'Patched by scripts/patch-react-native-screens.cjs';

const TARGET = path.join(
  'react-native-screens',
  'android',
  'src',
  'main',
  'java',
  'com',
  'swmansion',
  'rnscreens',
  'gamma',
  'modals',
  'formsheet',
  'FormSheetAnimatorFactory.kt',
);

// react-native-screens 4.30's enter animation, from the AnimatorSet on.
const ANCHOR = `        return AnimatorSet().apply {
            playTogether(slideAnimator, alphaAnimator)
            duration = animationDuration
            doOnStart { view.translationY = startY }
        }`;

const REPLACEMENT = `        // ${MARKER} (#867): with animations off, a
        // zero-length animation ends as it starts, before doOnStart, which
        // left the sheet below the screen. So it starts below the screen now.
        view.translationY = startY
        return AnimatorSet().apply {
            playTogether(slideAnimator, alphaAnimator)
            duration = animationDuration
        }`;

/**
 * Returns `source` with the start position set before the animation starts,
 * the same text if it already is, or null if it isn't the animation this
 * patch knows.
 */
const patchFormSheetAnimatorFactory = (source) => {
  if (source.includes(MARKER)) return source;
  if (!source.includes(ANCHOR)) return null;
  return source.replace(ANCHOR, REPLACEMENT);
};

/** Patches the installed react-native-screens. Returns what it did. */
const patchInstalledReactNativeScreens = (nodeModules = path.join(__dirname, '..', 'node_modules')) => {
  const file = path.join(nodeModules, TARGET);
  if (!fs.existsSync(file)) return { status: 'missing', file };
  const source = fs.readFileSync(file, 'utf8');
  const patched = patchFormSheetAnimatorFactory(source);
  if (patched === null) return { status: 'unknown', file };
  if (patched === source) return { status: 'already', file };
  fs.writeFileSync(file, patched);
  return { status: 'patched', file };
};

/** Patches the installed react-native-screens, or throws if it can't. */
const ensureReactNativeScreensPatched = (nodeModules) => {
  const { status, file } = patchInstalledReactNativeScreens(nodeModules);
  if (status === 'patched') {
    console.log(`Patched react-native-screens' sheet animation: ${file}`);
  } else if (status !== 'already') {
    throw new Error(
      `scripts/patch-react-native-screens.cjs doesn't fit ${file} (${status}). ` +
        'Check whether react-native-screens now sets the sheet below the screen before it starts the animation, and update or delete the patch.',
    );
  }
};

if (require.main === module) {
  ensureReactNativeScreensPatched();
}

module.exports = {
  ANCHOR,
  MARKER,
  TARGET,
  ensureReactNativeScreensPatched,
  patchFormSheetAnimatorFactory,
  patchInstalledReactNativeScreens,
};
