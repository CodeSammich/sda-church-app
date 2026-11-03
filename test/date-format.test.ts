import { execFileSync } from 'node:child_process';
import { formatAppDate } from '@/constants/DateFormat';

// Sabbath, November 7, 2026.
const sabbath = new Date(2026, 10, 7, 12);

describe('dates in the app language', () => {
  it('writes Chinese dates out by hand, the same in both scripts', () => {
    for (const language of ['zh', 'zh-cn'] as const) {
      expect(formatAppDate(sabbath, language, { year: true })).toBe('2026年11月7日');
      expect(formatAppDate(sabbath, language, { weekday: true })).toBe('11月7日星期六');
      expect(formatAppDate(sabbath, language)).toBe('11月7日');
      expect(formatAppDate(new Date(2026, 10, 1), language, { weekday: true })).toBe('11月1日星期日');
    }
  });

  it('formats English and Spanish dates with Intl', () => {
    expect(formatAppDate(sabbath, 'en', { year: true })).toBe('November 7, 2026');
    expect(formatAppDate(sabbath, 'en', { weekday: true })).toBe('Saturday, November 7');
    expect(formatAppDate(sabbath, 'es', { year: true })).toBe('7 de noviembre de 2026');
    expect(formatAppDate(sabbath, 'es', { weekday: true })).toBe('sábado, 7 de noviembre');
  });

  // On Android, Hermes formats Intl dates for zh-TW, zh-CN, and zh-cn in
  // English, which Node, running these tests, doesn't. So app code formats
  // dates through formatAppDate; only an English-only Intl call may stay.
  it('keeps Intl.DateTimeFormat out of app code, except for fixed English', () => {
    let found = '';
    try {
      found = execFileSync(
        'git',
        ['grep', '-n', 'Intl.DateTimeFormat(', '--', 'app', 'components', 'constants', 'features', 'hooks', 'services'],
        { encoding: 'utf8' },
      );
    } catch (error) {
      // git grep exits with 1 when nothing matches.
      if ((error as { status?: number }).status !== 1) throw error;
    }
    const calls = found
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.startsWith('constants/DateFormat.ts:'))
      .filter((line) => !/Intl\.DateTimeFormat\('en-US'/.test(line));
    expect(calls).toEqual([]);
  });
});
