#!/usr/bin/env node

/**
 * Renders docs/diagrams/architecture.mmd to docs/diagrams/architecture.svg.
 *
 * GitHub's Mermaid renderer cannot load the diagram's logo images from external
 * URLs, so the diagram is published as a pre-rendered SVG instead. Mermaid CLI
 * renders the source, then each pinned logo URL is fetched and embedded as a
 * data URI so the SVG is self-contained. Re-run after editing the source.
 *
 * The SVG starts with a comment holding the source's SHA-256. A Jest test
 * compares it with the current source, so CI fails if the source changes
 * without the SVG being re-rendered.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MERMAID_CLI = '@mermaid-js/mermaid-cli@12.0.0';
const SOURCE_HASH_PREFIX = '<!-- architecture.mmd sha256:';
const LOGO_URL_PATTERN = /href="(https:\/\/cdn\.jsdelivr\.net\/[^"]+\.svg)"/g;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(repoRoot, 'docs/diagrams/architecture.mmd');
const outputPath = path.join(repoRoot, 'docs/diagrams/architecture.svg');

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'architecture-diagram-'));
try {
  const renderedPath = path.join(tempDir, 'architecture.svg');
  execFileSync(
    'npx',
    ['--yes', MERMAID_CLI, '--input', sourcePath, '--output', renderedPath, '--backgroundColor', 'white'],
    { stdio: 'inherit' },
  );

  let svg = await readFile(renderedPath, 'utf8');
  const logoUrls = [...new Set([...svg.matchAll(LOGO_URL_PATTERN)].map(([, url]) => url))];
  for (const url of logoUrls) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Logo request failed with HTTP ${response.status}: ${url}`);
    const logo = Buffer.from(await response.arrayBuffer()).toString('base64');
    svg = svg.replaceAll(`href="${url}"`, `href="data:image/svg+xml;base64,${logo}"`);
  }

  if (/<image[^>]+href="https?:/.test(svg)) {
    throw new Error('The rendered SVG still references an external image; add its host to LOGO_URL_PATTERN.');
  }

  // Hash with LF line endings so a CRLF checkout on Windows still matches.
  const source = (await readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n');
  const sourceHash = createHash('sha256').update(source).digest('hex');
  await writeFile(outputPath, `${SOURCE_HASH_PREFIX}${sourceHash} -->\n${svg}`);
  console.log(`Embedded ${logoUrls.length} logos into ${path.relative(repoRoot, outputPath)}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
