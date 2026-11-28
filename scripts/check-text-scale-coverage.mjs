/**
 * Static guard for typography declarations. Behavioral coverage lives in the
 * TypeScript Jest suite under test/; this small Node script only prevents a
 * future raw font metric from silently bypassing the saved text preference.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// features/ holds whole screens too, such as the hymnal page, whose title and
// rows must follow the saved size as the app's own screens do (#797).
const sourceRoots = ['app', 'components', 'features', 'styles'];
const sourcePattern = /\.(?:ts|tsx)$/;
const prohibitedPatterns = [
  {
    reason: 'raw typography metric',
    pattern: /\b(?:fontSize|lineHeight)\s*:\s*\d+(?:\.\d+)?\b/g,
    // The Android home screen widget, which Android draws outside the app,
    // at the phone's own text size; the app's setting can't reach it.
    allowedFiles: ['features/verse-of-the-day/VerseOfTheDayWidgetLayout.tsx'],
  },
  {
    // Except the header's own cap (#368). It limits only the phone's text size,
    // so the header fits at the largest accessibility sizes. The app's own
    // 100%-200% setting still applies in full.
    reason: 'accessibility font-size cap',
    pattern: /\bmaxFontSizeMultiplier\b(?!=\{HEADER_MAX_FONT_SCALE\})/g,
  },
  {
    // Text that turns off the phone's text size must apply it itself. Only the
    // grid cards do, so they can measure their titles' words at the size
    // they're drawn.
    reason: 'phone text size turned off',
    pattern: /\ballowFontScaling\b/g,
    allowedFiles: ['components/GridMenuCard.tsx'],
  },
  {
    // A new limit on the text size, such as the grid cards' 1.25× until 1.9.2,
    // which a regular expression can't see applied: at 200% their cards and
    // icons grew and their titles didn't. The app's few limits live in
    // constants/AppPreferences.ts and hooks/useGlobalHeaderHeight.ts, outside
    // these folders, and docs/accessibility/README.md lists each one.
    reason: 'text-size cap',
    pattern: /\bconst\s+(?=[A-Z0-9_]*(?:TEXT|FONT))(?=[A-Z0-9_]*(?:MAX|CAP))[A-Z0-9_]+\s*=/g,
  },
  {
    reason: 'compact Bible-reader scale cap',
    pattern:
      /\b(?:compactDockScaleCap|compactDockTextScale|compactDockMaxFontSizeMultiplier|compactReaderStyles)\b/g,
  },
];

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? walk(filePath)
      : sourcePattern.test(entry.name)
        ? [filePath]
        : [];
  });

const violations = [];
for (const root of sourceRoots) {
  for (const filePath of walk(path.join(repoRoot, root))) {
    const source = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');
    for (const { allowedFiles = [], pattern, reason } of prohibitedPatterns) {
      if (allowedFiles.includes(relativePath)) continue;
      for (const match of source.matchAll(pattern)) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        violations.push(
          `${path.relative(repoRoot, filePath)}:${line}: ${reason}: ${match[0]}`,
        );
      }
    }
  }
}

if (violations.length) {
  console.error('Typography declarations bypass the saved 100%-200% preference:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log(`Text-scale coverage passed across ${sourceRoots.join(', ')}.`);
}
