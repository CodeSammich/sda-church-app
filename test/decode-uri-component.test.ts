import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Expo Router's query-string 7 decodes URL query values with
// decode-uri-component. Versions up to 0.4.2 take exponential time on
// malformed input (GHSA-vcc3-ghjq-m6fr); 0.5.0 fixes it but ships only as an ES
// module, which query-string 7's require() can't use. package.json overrides
// it with a CommonJS copy of 0.5.0 in vendor/decode-uri-component.
describe('decode-uri-component', () => {
  const vendored = resolve('vendor/decode-uri-component/index.js');
  const queryStringDir = dirname(
    require.resolve('query-string', { paths: [dirname(require.resolve('expo-router/package.json'))] }),
  );

  it("is the patched copy wherever Expo Router's query-string loads it", () => {
    const loaded = realpathSync(require.resolve('decode-uri-component', { paths: [queryStringDir] }));
    // Compared by location and content rather than full path: a git worktree that
    // shares another checkout's node_modules resolves the link to that checkout's
    // vendor folder. An unpatched copy from npm still fails both checks.
    expect(loaded.endsWith(join('vendor', 'decode-uri-component', 'index.js'))).toBe(true);
    expect(readFileSync(loaded, 'utf8')).toBe(readFileSync(vendored, 'utf8'));
    expect(require('../vendor/decode-uri-component/package.json').version).toBe('0.5.0');
  });

  it('leaves no older copy in the lockfile', () => {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const copies = Object.entries(lock.packages as Record<string, { version?: string; link?: boolean; resolved?: string }>)
      .filter(([path]) => path.endsWith('node_modules/decode-uri-component'));
    expect(copies).toEqual([
      ['node_modules/decode-uri-component', { resolved: 'vendor/decode-uri-component', link: true }],
    ]);
  });

  it('decodes malformed input in linear time', () => {
    const decode = require('../vendor/decode-uri-component') as (value: string) => string;
    // 0.2.2 takes about 18 seconds on this 3 KB value.
    const malformed = '%80'.repeat(1000);
    const started = Date.now();
    expect(decode(malformed)).toBe(malformed);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('still decodes query values the way query-string expects', () => {
    const queryString = require(queryStringDir) as { parse: (query: string) => Record<string, unknown> };
    expect(queryString.parse('?a=%E2%9C%93&b=%E0%A4%A&c=x%20y&backTo=%2Fhome%2Fbulletin')).toEqual({
      a: '✓',
      b: '%E0%A4%A',
      c: 'x y',
      backTo: '/home/bulletin',
    });
  });
});
