import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../app/(tabs)/home/fellowship.tsx'), 'utf8');

describe('the Saturday service on Fellowships is Sabbath worship (#793)', () => {
  it('says 安息日崇拜, not 主日崇拜 (read as Sunday worship), in Traditional and Simplified', () => {
    expect(source).not.toContain('主日崇拜');
    expect(source).toContain('每週的安息日崇拜服務');
    expect(source).toContain('每周的安息日崇拜服务');
  });
});
