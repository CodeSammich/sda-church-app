import { CUV_ADVENTIST_AUDIO_URLS } from '@/constants/CuvAdventistAudioManifest';

/** Maps narrator names to one source URL or an ordered list of fallback URLs. */
export interface TranslationBookChapterAudioLinks {
  [reader: string]: string | string[];
}

const AUDIO_POWER_CUV_RECORDINGS_BASE =
  'https://theaudiopower.com/CUV/Recordings';
const ARCHIVE_ORG_CUV_RECORDINGS_BASE =
  'https://archive.org/download/CUV_201911';
const AUDIO_POWER_CUV_READER = '基督徒团契 (Audio Power)';
const AUDIO_POWER_CUV_TRANSLATIONS = new Set(['cmn_cuv', 'cmn_cu1']);

// Audio Power uses these simplified-Chinese filenames for both CUV text
// variants. Keep this source-specific catalog in canonical Protestant order and
// synchronized with scripts/download-cuv-audio.mjs.
const AUDIO_POWER_CUV_BOOKS = [
  ['GEN', '创世记', 50], ['EXO', '出埃及记', 40], ['LEV', '利未记', 27],
  ['NUM', '民数记', 36], ['DEU', '申命记', 34], ['JOS', '约书亚记', 24],
  ['JDG', '士师记', 21], ['RUT', '路得记', 4], ['1SA', '撒母耳记上', 31],
  ['2SA', '撒母耳记下', 24], ['1KI', '列王纪上', 22], ['2KI', '列王纪下', 25],
  ['1CH', '历代志上', 29], ['2CH', '历代志下', 36], ['EZR', '以斯拉记', 10],
  ['NEH', '尼希米记', 13], ['EST', '以斯帖记', 10], ['JOB', '约伯记', 42],
  ['PSA', '诗篇', 150], ['PRO', '箴言', 31], ['ECC', '传道书', 12],
  ['SNG', '雅歌', 8], ['ISA', '以赛亚书', 66], ['JER', '耶利米书', 52],
  ['LAM', '耶利米哀歌', 5], ['EZK', '以西结书', 48], ['DAN', '但以理书', 12],
  ['HOS', '何西阿书', 14], ['JOL', '约珥书', 3], ['AMO', '阿摩司书', 9],
  ['OBA', '俄巴底亚书', 1], ['JON', '约拿书', 4], ['MIC', '弥迦书', 7],
  ['NAH', '那鸿书', 3], ['HAB', '哈巴谷书', 3], ['ZEP', '西番雅书', 3],
  ['HAG', '哈该书', 2], ['ZEC', '撒迦利亚书', 14], ['MAL', '玛拉基书', 4],
  ['MAT', '马太福音', 28], ['MRK', '马可福音', 16], ['LUK', '路加福音', 24],
  ['JHN', '约翰福音', 21], ['ACT', '使徒行传', 28], ['ROM', '罗马书', 16],
  ['1CO', '哥林多前书', 16], ['2CO', '哥林多后书', 13], ['GAL', '加拉太书', 6],
  ['EPH', '以弗所书', 6], ['PHP', '腓立比书', 4], ['COL', '歌罗西书', 4],
  ['1TH', '帖撒罗尼迦前书', 5], ['2TH', '帖撒罗尼迦后书', 3],
  ['1TI', '提摩太前书', 6], ['2TI', '提摩太后书', 4], ['TIT', '提多书', 3],
  ['PHM', '腓利门书', 1], ['HEB', '希伯来书', 13], ['JAS', '雅各书', 5],
  ['1PE', '彼得前书', 5], ['2PE', '彼得后书', 3], ['1JN', '约翰一书', 5],
  ['2JN', '约翰二书', 1], ['3JN', '约翰三书', 1], ['JUD', '犹大书', 1],
  ['REV', '启示录', 22],
] as const;

const AUDIO_POWER_CUV_BOOK_BY_ID = new Map<
  string,
  { bookNumber: number; chapterCount: number; simplifiedName: string }
>(
  AUDIO_POWER_CUV_BOOKS.map(([id, simplifiedName, chapterCount], index) => [
    id,
    { bookNumber: index + 1, chapterCount, simplifiedName },
  ]),
);

/** Whether a translation uses the shared Audio Power CUV narration. */
export const supportsAudioPowerCuv = (translationId: string) =>
  AUDIO_POWER_CUV_TRANSLATIONS.has(translationId);

/**
 * Builds the three ordered mirrors for an Audio Power CUV chapter recording.
 *
 * Audio Power's owner explicitly approved the church app's use, download, and
 * self-hosting of these recordings. Preserve the permission record when
 * changing providers or hosting strategy:
 * https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/134#issuecomment-5274730608
 */
export const getAudioPowerCuvChapterLinks = (
  bookId: string,
  chapter: number,
): TranslationBookChapterAudioLinks => {
  const book = AUDIO_POWER_CUV_BOOK_BY_ID.get(bookId.toUpperCase());
  if (
    !book ||
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    chapter > book.chapterCount
  ) {
    return {};
  }

  const chapterSuffix = book.chapterCount === 1 ? '' : ` ${chapter}`;
  const sourceFilename = encodeURIComponent(
    `${book.simplifiedName}${chapterSuffix}.mp3`,
  );
  const canonicalFilename = `CUV_B${String(book.bookNumber).padStart(
    2,
    '0',
  )}C${String(chapter).padStart(3, '0')}.mp3`;
  const churchHostedUrl = CUV_ADVENTIST_AUDIO_URLS[canonicalFilename];

  // These are mirrors of one recording, not separate narrator choices. These
  // fallback URLs are valid only for the Audio Power narrator.
  return {
    [AUDIO_POWER_CUV_READER]: [
      ...(churchHostedUrl ? [churchHostedUrl] : []),
      `${AUDIO_POWER_CUV_RECORDINGS_BASE}/${sourceFilename}`,
      `${ARCHIVE_ORG_CUV_RECORDINGS_BASE}/${canonicalFilename}`,
    ],
  };
};
