import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const diagramsDir = path.join(__dirname, '..', 'docs', 'diagrams');
const sources = readdirSync(diagramsDir).filter((name) => name.endsWith('.mmd'));

describe.each(sources)('docs/diagrams/%s', (sourceName) => {
  const svgPath = path.join(diagramsDir, sourceName.replace(/\.mmd$/, '.svg'));

  it('has a rendered SVG from the current source', () => {
    // Matches the stamp written by scripts/render-docs-diagrams.mjs.
    const source = readFileSync(path.join(diagramsDir, sourceName), 'utf8').replace(/\r\n/g, '\n');
    const svg = readFileSync(svgPath, 'utf8');
    const escapedName = sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stampPattern = new RegExp(`^<!-- ${escapedName} sha256:([0-9a-f]{64}) -->\\n`);

    const renderedHash = svg.match(stampPattern)?.[1];
    const sourceHash = createHash('sha256').update(source).digest('hex');

    expect({ renderedHash, hint: 'Run `npm run docs:diagram` and commit the SVGs.' }).toEqual({
      renderedHash: sourceHash,
      hint: 'Run `npm run docs:diagram` and commit the SVGs.',
    });
  });

  it('does not load anything from outside the SVG', () => {
    expect(readFileSync(svgPath, 'utf8')).not.toMatch(/<image[^>]+href="https?:/);
  });
});
