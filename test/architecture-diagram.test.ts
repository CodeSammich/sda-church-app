import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Keep in sync with SOURCE_HASH_PREFIX in scripts/render-architecture-diagram.mjs.
const SOURCE_HASH_PATTERN = /^<!-- architecture\.mmd sha256:([0-9a-f]{64}) -->\n/;

const diagramsDir = path.join(__dirname, '..', 'docs', 'diagrams');

describe('architecture diagram', () => {
  it('was rendered from the current architecture.mmd', () => {
    const source = readFileSync(path.join(diagramsDir, 'architecture.mmd'), 'utf8').replace(
      /\r\n/g,
      '\n',
    );
    const svg = readFileSync(path.join(diagramsDir, 'architecture.svg'), 'utf8');

    const renderedHash = svg.match(SOURCE_HASH_PATTERN)?.[1];
    const sourceHash = createHash('sha256').update(source).digest('hex');

    expect({ renderedHash, hint: 'Run `npm run docs:diagram` and commit the SVG.' }).toEqual({
      renderedHash: sourceHash,
      hint: 'Run `npm run docs:diagram` and commit the SVG.',
    });
  });

  it('does not load anything from outside the SVG', () => {
    const svg = readFileSync(path.join(diagramsDir, 'architecture.svg'), 'utf8');

    expect(svg).not.toMatch(/<image[^>]+href="https?:/);
  });
});
