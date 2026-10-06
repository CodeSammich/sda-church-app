import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  CHINESE_506_DIRECTORY_URL,
  getChinese506HymnUrl,
  getSortedChinese506Hymns,
} from '@/features/hymnal/Chinese506Hymnal';
import { getHymnalSearchItems } from '@/features/hymnal/HymnalSearch';

describe('Chinese 506 hymnal directory', () => {
  const hymns = getSortedChinese506Hymns();

  it('contains every hymn published by the source directory', () => {
    expect(hymns).toHaveLength(506);
    expect(hymns[0]).toEqual({
      number: 1,
      title: '圣哉真神',
      pageId: 2662,
    });
    expect(hymns.at(-1)).toEqual({
      number: 506,
      title: '阿门',
      pageId: 3709,
    });
  });

  it('corrects typos in the source directory\'s titles', () => {
    const titles = Object.fromEntries(hymns.map(({ number, title }) => [number, title]));
    expect(titles).toMatchObject({
      59: '昨日，今日，直到永远',
      89: '到各山岭去传扬',
      129: '我们回天家',
      159: '我听主声欢迎',
      203: '宝血大权能',
      319: '主永不离你',
      337: '祷告良辰',
      344: '得福良辰',
    });
  });

  it('keeps the corrections when the directory is scraped again', () => {
    const links = hymns
      .map(({ number, title, pageId }) => {
        const sourceTitle = number === 129 ? '我们会天家' : title;
        return `<a href="/index.php?m=content&amp;c=index&amp;a=show&amp;catid=90&amp;id=${pageId}">${number}、${sourceTitle}</a>`;
      })
      .join('\n');
    const dir = mkdtempSync(join(tmpdir(), 'hymnal-506-'));
    writeFileSync(join(dir, 'directory.html'), links);
    execFileSync(process.execPath, [
      resolve('scripts/scrape-chinese-506-hymnal.mjs'),
      '--input',
      join(dir, 'directory.html'),
      '--output',
      join(dir, 'hymnal.json'),
    ]);
    const scraped = JSON.parse(readFileSync(join(dir, 'hymnal.json'), 'utf8'));
    expect(scraped['129']).toEqual({ title: '我们回天家', pageId: hymns[128].pageId });
    expect(Object.keys(scraped)).toHaveLength(506);
  });

  it('maps hymn numbers to the source page IDs and falls back safely', () => {
    expect(getChinese506HymnUrl(1)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=90&id=2662',
    );
    expect(getChinese506HymnUrl(506)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=90&id=3709',
    );
    expect(getChinese506HymnUrl(507)).toBe(CHINESE_506_DIRECTORY_URL);
  });

  it('adds 506 hymns to the search across every hymnal', () => {
    const item = getHymnalSearchItems('zh-cn').find(
      ({ title, hymnalId }) => title === '1. 圣哉真神' && hymnalId === 'chinese-hymnal-506',
    );

    expect(item).toMatchObject({ hymnNumber: 1 });
  });
});
