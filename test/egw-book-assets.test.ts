import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { EGW_BOOKS } from '@/features/library/EgwBookCatalog';

describe('EGW book cover assets', () => {
  it('provides one optimized original cover for every curated work', () => {
    const assetDirectory = join(process.cwd(), 'public/library/egw');
    const filenames = readdirSync(assetDirectory)
      .filter((filename) => /\.(?:jpg|png)$/.test(filename))
      .map((filename) => filename.replace(/\.(?:jpg|png)$/, ''))
      .sort();

    expect(filenames).toEqual(
      EGW_BOOKS.map(({ id }) => id).sort(),
    );
  });
});
