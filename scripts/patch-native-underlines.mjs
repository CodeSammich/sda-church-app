import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const patchFile = async ({ relativePath, marker, needle, replacement }) => {
  const filePath = resolve(projectRoot, relativePath);
  const source = await readFile(filePath, 'utf8');

  if (source.includes(marker)) return;

  if (!source.includes(needle)) {
    throw new Error(
      `Unable to patch ${relativePath}; the installed React Native source does not match the expected version.`,
    );
  }

  await writeFile(filePath, source.replace(needle, replacement));
  console.log(`Patched ${relativePath}`);
};

await patchFile({
  relativePath:
    'node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/TextDecorationStyle.kt',
  marker: '// sda-church-app: thicker solid underline',
  needle: `  val thickness =
      if (style == TextDecorationStyle.SOLID || style == TextDecorationStyle.DOUBLE) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          textPaint.underlineThickness
        } else {
          textPaint.fontMetrics.descent * 0.1f
        }
      } else {
        val minThickness = 1.5f * textPaint.density
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          max(textPaint.underlineThickness, minThickness)
        } else {
          max(textPaint.fontMetrics.descent * 0.1f, minThickness)
        }
      }
`,
  replacement: `  val baseThickness =
      if (style == TextDecorationStyle.SOLID || style == TextDecorationStyle.DOUBLE) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          textPaint.underlineThickness
        } else {
          textPaint.fontMetrics.descent * 0.1f
        }
      } else {
        val minThickness = 1.5f * textPaint.density
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          max(textPaint.underlineThickness, minThickness)
        } else {
          max(textPaint.fontMetrics.descent * 0.1f, minThickness)
        }
      }

  // sda-church-app: thicker solid underline
  // Keep one continuous stroke; the multiplier scales with the font size.
  val thickness =
      if (style == TextDecorationStyle.SOLID) baseThickness * 2f else baseThickness
`,
});

await patchFile({
  relativePath:
    'node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/text/TextDecorationStyle.kt',
  marker: '// sda-church-app: join adjacent solid underline spans',
  needle: `    val x1 = min(rawX1, rawX2)
    val x2 = max(rawX1, rawX2)
`,
  replacement: `    // sda-church-app: join adjacent solid underline spans
    // Extend each solid span by the stroke width so neighboring spans meet
    // instead of producing visible breaks at their boundaries.
    val horizontalPadding = if (style == TextDecorationStyle.SOLID) thickness * 2f else 0f
    val x1 = min(rawX1, rawX2) - horizontalPadding
    val x2 = max(rawX1, rawX2) + horizontalPadding
`,
});

await patchFile({
  relativePath:
    'node_modules/react-native/ReactCommon/react/renderer/textlayoutmanager/platform/ios/react/renderer/textlayoutmanager/RCTTextPrimitivesConversions.h',
  marker: '// sda-church-app: thicker solid underline',
  needle: `    case facebook::react::TextDecorationStyle::Solid:
      return NSUnderlineStyleSingle;`,
  replacement: `    case facebook::react::TextDecorationStyle::Solid:
      // sda-church-app: thicker solid underline
      return NSUnderlineStyleThick;`,
});
