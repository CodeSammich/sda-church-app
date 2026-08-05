/**
 * Static guard for typography declarations. Behavioral coverage lives in the
 * TypeScript Jest suite under test/; this small Node script only prevents a
 * future raw font metric from silently bypassing the saved text preference.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = ['app', 'components', 'styles'];
const sourcePattern = /\.(?:ts|tsx)$/;
const prohibitedPatterns = [
  {
    reason: 'raw typography metric',
    pattern: /\b(?:fontSize|lineHeight)\s*:\s*\d+(?:\.\d+)?\b/g,
  },
  {
    reason: 'accessibility font-size cap',
    pattern: /\bmaxFontSizeMultiplier\b/g,
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
    for (const { pattern, reason } of prohibitedPatterns) {
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
  console.log('Text-scale coverage passed across app, components, and styles.');
}
