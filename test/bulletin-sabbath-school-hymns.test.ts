import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getSabbathSchoolHymnRowText } from '@/services/BulletinSabbathSchoolHymns';

// The digital bulletin's Opening Hymns and Closing Hymns rows, as in print
// (#626, #635).
describe('the Sabbath School hymn rows', () => {
  it('names the rows, and says the closing is the opening hymns again, in each language', () => {
    expect(getSabbathSchoolHymnRowText('en', 3)).toEqual({
      openingLabel: 'Opening Hymns',
      closingLabel: 'Closing Hymns',
      closingValue: 'Same as Opening Hymns',
    });
    expect(getSabbathSchoolHymnRowText('zh', 3)).toEqual({
      openingLabel: '開會詩歌',
      closingLabel: '結會詩歌',
      closingValue: '同開會詩歌',
    });
    expect(getSabbathSchoolHymnRowText('zh-cn', 3)).toEqual({
      openingLabel: '开会诗歌',
      closingLabel: '结会诗歌',
      closingValue: '同开会诗歌',
    });
    expect(getSabbathSchoolHymnRowText('es', 3)).toEqual({
      openingLabel: 'Himnos de apertura',
      closingLabel: 'Himnos de clausura',
      closingValue: 'Igual que los himnos de apertura',
    });
  });

  it('says Hymn for one, and leaves the closing blank, for Not available, with none', () => {
    expect(getSabbathSchoolHymnRowText('en', 1)).toEqual({
      openingLabel: 'Opening Hymn',
      closingLabel: 'Closing Hymn',
      closingValue: 'Same as Opening Hymn',
    });
    expect(getSabbathSchoolHymnRowText('es', 1).closingValue).toBe('Igual que el himno de apertura');
    expect(getSabbathSchoolHymnRowText('en', 0)).toEqual({
      openingLabel: 'Opening Hymn',
      closingLabel: 'Closing Hymn',
      closingValue: '',
    });
    expect(getSabbathSchoolHymnRowText('fr', 2).openingLabel).toBe('Opening Hymns');
  });

  it('puts Opening Hymns before the lesson and Closing Hymns at the end, in both programs', () => {
    const source = readFileSync(join(process.cwd(), 'app/(tabs)/home/bulletin.tsx'), 'utf8');
    const rows = source.slice(source.indexOf('const rows: Row[] = isQueens'));
    const [queens, brooklyn] = rows
      .slice(0, rows.indexOf('];', rows.indexOf(': [')) + 2)
      .split(': [');
    const order = (list: string, names: string[]) => names.map((name) => list.indexOf(name));
    const increasing = (positions: number[]) =>
      positions.every((position, index) => position > -1 && (index === 0 || position > positions[index - 1]));

    expect(
      increasing(order(queens, ['ssOpeningPrayer', 'openingHymns', 'lessonRow', 'kidsTeacher', 'closingHymns', 'ssClosingPrayer'])),
    ).toBe(true);
    expect(increasing(order(brooklyn, ['openingHymns', 'roles.prayer', 'lessonRow', 'closingHymns']))).toBe(true);
    expect(source).not.toContain('Opening & Closing Hymns');
    expect(source).not.toContain('開會及結會詩歌');
  });
});
