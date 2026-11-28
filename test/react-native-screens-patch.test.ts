import fs from 'node:fs';
import path from 'node:path';

const {
  ANCHOR,
  MARKER,
  TARGET,
  patchFormSheetAnimatorFactory,
} = require('../scripts/patch-react-native-screens.cjs');

const root = path.join(__dirname, '..');
const installed = path.join(root, 'node_modules', TARGET);

// react-native-screens 4.30.1's enter animation, unpatched.
const ORIGINAL = `    internal fun createEnterAnimator(
        view: View,
        isInterrupting: Boolean = false,
    ): Animator {
        val startY = if (isInterrupting) view.translationY else view.height.toFloat()
        val startAlpha = if (isInterrupting) dimmingManager.dimmingViewAlpha else 0f

${ANCHOR}
    }
`;

describe("Android's sheets show with animations off (#867)", () => {
  it('moves the sheet below the screen before its slide starts, not as it starts', () => {
    const patched = patchFormSheetAnimatorFactory(ORIGINAL);
    expect(patched).toContain(MARKER);
    expect(patched).not.toContain('doOnStart { view.translationY = startY }');
    // Set first, then the animation that slides it up from there.
    expect(patched.indexOf('view.translationY = startY')).toBeLessThan(patched.indexOf('return AnimatorSet()'));
  });

  it('changes nothing the second time, and nothing it does not know', () => {
    const patched = patchFormSheetAnimatorFactory(ORIGINAL);
    expect(patchFormSheetAnimatorFactory(patched)).toBe(patched);
    expect(patchFormSheetAnimatorFactory(ORIGINAL.replace('doOnStart', 'doOnEnd'))).toBeNull();
  });

  it('fits the installed react-native-screens', () => {
    // If this fails after updating react-native-screens, check whether its
    // FormSheetAnimatorFactory.kt now sets the sheet below the screen before
    // it starts the enter animation. If it does, delete
    // scripts/patch-react-native-screens.cjs, its call in
    // scripts/build-android-native.mjs, and this test; if not, update the
    // script for the new file.
    const patched = patchFormSheetAnimatorFactory(fs.readFileSync(installed, 'utf8'));
    expect(patched).not.toBeNull();
    expect(patched).toContain(MARKER);
  });

  it('runs before each Android build, before Gradle', () => {
    const build = fs.readFileSync(path.join(root, 'scripts', 'build-android-native.mjs'), 'utf8');
    const patch = build.indexOf('ensureReactNativeScreensPatched();');
    expect(patch).toBeGreaterThan(0);
    expect(patch).toBeLessThan(build.indexOf("run('./gradlew'"));
  });
});
