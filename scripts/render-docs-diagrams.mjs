#!/usr/bin/env node

/**
 * Renders every docs/diagrams/*.mmd file to an .svg file beside it.
 *
 * GitHub's Mermaid renderer cannot load the diagrams' logo images from external
 * URLs, so the diagrams are published as pre-rendered SVGs instead. Mermaid CLI
 * renders each source, then each pinned logo URL is fetched and embedded as a
 * data URI so the SVG is self-contained. Re-run after editing a source.
 *
 * Each SVG starts with a comment holding its source's SHA-256. A Jest test
 * compares it with the current source, so CI fails if a source changes without
 * its SVG being re-rendered.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MERMAID_CLI = '@mermaid-js/mermaid-cli@12.0.0';
// Plain SVG text labels instead of HTML ones: HTML labels are sized with the
// renderer's fonts and get clipped when the viewer's font is wider.
const MERMAID_CONFIG = {
  htmlLabels: false,
  markdownAutoWrap: false,
  fontFamily: 'Arial, Helvetica, sans-serif',
  flowchart: { htmlLabels: false, padding: 12, wrappingWidth: 1000 },
};
const LOGO_URL_PATTERN = /href="(https:\/\/cdn\.jsdelivr\.net\/[^"]+\.svg)"/g;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const diagramsDir = path.join(repoRoot, 'docs/diagrams');

const renderDiagram = async (sourceName, tempDir, configPath) => {
  const sourcePath = path.join(diagramsDir, sourceName);
  const outputPath = sourcePath.replace(/\.mmd$/, '.svg');
  const renderedPath = path.join(tempDir, path.basename(outputPath));
  execFileSync(
    'npx',
    [
      '--yes', MERMAID_CLI, '--input', sourcePath, '--output', renderedPath,
      '--backgroundColor', 'white', '--configFile', configPath,
    ],
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

  // Mermaid writes an inline dash pattern on every edge to leave room for the
  // arrowhead, and sometimes computes one long dash for a dotted edge, which
  // then looks solid. Reset dotted edges to a plain dotted pattern.
  svg = svg.replace(
    /(<path[^>]*class="[^"]*edge-pattern-dotted[^"]*"[^>]*style=")stroke-dasharray:[^;"]*;?/g,
    '$1stroke-dasharray: 2 2;',
  );

  if (/<image[^>]+href="https?:/.test(svg)) {
    throw new Error(`${sourceName} still references an external image; add its host to LOGO_URL_PATTERN.`);
  }

  // Hash with LF line endings so a CRLF checkout on Windows still matches.
  const source = (await readFile(sourcePath, 'utf8')).replace(/\r\n/g, '\n');
  const sourceHash = createHash('sha256').update(source).digest('hex');
  await writeFile(outputPath, `<!-- ${sourceName} sha256:${sourceHash} -->\n${svg}`);
  console.log(`Embedded ${logoUrls.length} logos into ${path.relative(repoRoot, outputPath)}`);
};

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'docs-diagrams-'));
try {
  const configPath = path.join(tempDir, 'mermaid-config.json');
  await writeFile(configPath, JSON.stringify(MERMAID_CONFIG));
  const sources = (await readdir(diagramsDir)).filter((name) => name.endsWith('.mmd'));
  for (const sourceName of sources) {
    await renderDiagram(sourceName, tempDir, configPath);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
