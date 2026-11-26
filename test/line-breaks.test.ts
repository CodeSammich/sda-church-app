import { readFileSync } from 'node:fs';
import { keepWordsWhole, unbroken } from '@/constants/LineBreaks';
import { HYMNAL_LABELS } from '@/features/hymnal/HymnalLabels';

const WJ = '⁠';
const NBSP = ' ';
// Where a line may break: at a plain space. A word joiner and a no-break space
// don't allow it, and keepWordsWhole adds one between every two Chinese
// characters, so a break between Chinese characters is a break inside a word.
const breaksAt = (text: string) => text.split(' ');

describe('keeping words whole on a line (#797)', () => {
  it('breaks a Chinese title only between its words, never leaving 版 alone', () => {
    const title = keepWordsWhole('中文讚美詩 — 505 版');
    expect(title).toBe(`中${WJ}文${WJ}讚${WJ}美${WJ}詩 — 505${NBSP}版`);
    expect(breaksAt(title)).toEqual([`中${WJ}文${WJ}讚${WJ}美${WJ}詩`, '—', `505${NBSP}版`]);
  });

  it('keeps Chinese beside a number or a Latin word together, which a space only spaces apart', () => {
    expect(breaksAt(keepWordsWhole('英文 SDA 詩歌本 — 1985 年版'))).toEqual([
      `英${WJ}文${NBSP}SDA${NBSP}詩${WJ}歌${WJ}本`,
      '—',
      `1985${NBSP}年${WJ}版`,
    ]);
  });

  it("still breaks after Chinese punctuation, and leaves text without Chinese as it is", () => {
    expect(keepWordsWhole('「我從前，如今」')).toBe(`「我${WJ}從${WJ}前，如${WJ}今」`);
    for (const text of ['Chinese Hymnal — 505 Edition', 'Audio bíblico sin conexión', 'Offline Bible Audio']) {
      expect(keepWordsWhole(text)).toBe(text);
    }
  });

  it('keeps every hymnal title, in every language, breaking only between its words', () => {
    for (const labels of Object.values(HYMNAL_LABELS)) {
      for (const label of Object.values(labels)) {
        const whole = keepWordsWhole(label);
        // Nothing but the joiners and no-break spaces is added.
        expect(whole.replace(/⁠/g, '').replace(/ /g, ' ')).toBe(label);
        // A Chinese label breaks only at its dash.
        if (/[㐀-鿿]/u.test(label)) expect(breaksAt(whole)).toHaveLength(3);
      }
    }
  });

  it('keeps a reference such as 約翰福音 9:25 on one line', () => {
    expect(unbroken('約翰福音 9:25')).toBe(`約${WJ}翰${WJ}福${WJ}音${NBSP}9:25`);
    expect(unbroken('John 9:25')).toBe(`John${NBSP}9:25`);
  });

  it("draws the header's title so, and the Bible's names with the same joiners", () => {
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain("typeof title === 'string' ? keepWordsWhole(title) : title");
    expect(readFileSync('services/BibleNames.ts', 'utf8')).toContain("import { unbroken } from '@/constants/LineBreaks';");
  });
});
