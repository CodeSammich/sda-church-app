import type { SupportedLanguage } from '@/constants/LanguageContext';
import type { DownloadProgress } from '@/services/FileDownloads';

/**
 * What a download's progress says, the same wherever the phone downloads a big
 * file itself (docs/UI_UX.md, External Service Links): the children's lessons
 * (#529) and Bible audio for listening offline (#556).
 */

const GIGABYTE = 1_000_000_000;

const number = (value: number, decimals: number, language: SupportedLanguage) => {
  const text = value.toFixed(decimals);
  return language === 'es' ? text.replace('.', ',') : text;
};

/** A size in the unit `scale` calls for: MB, or GB from 1 GB up. */
const inUnit = (bytes: number, scale: number, language: SupportedLanguage) =>
  scale >= GIGABYTE
    ? number(bytes / GIGABYTE, 2, language)
    : number(bytes / 1_000_000, 1, language);

const unitOf = (scale: number) => (scale >= GIGABYTE ? 'GB' : 'MB');

/** A file's size, such as "24.5 MB" or "4.01 GB". */
export const formatDownloadSize = (bytes: number, language: SupportedLanguage) =>
  `${inUnit(bytes, bytes, language)} ${unitOf(bytes)}`;

const copy = {
  en: {
    starting: 'Downloading…',
    downloading: (done: string, total?: string) =>
      total ? `Downloading · ${done} of ${total}` : `Downloading · ${done}`,
  },
  zh: {
    starting: '下載中…',
    downloading: (done: string, total?: string) =>
      total ? `下載中 · ${done} / ${total}` : `下載中 · ${done}`,
  },
  'zh-cn': {
    starting: '下载中…',
    downloading: (done: string, total?: string) =>
      total ? `下载中 · ${done} / ${total}` : `下载中 · ${done}`,
  },
  es: {
    starting: 'Descargando…',
    downloading: (done: string, total?: string) =>
      total ? `Descargando · ${done} de ${total}` : `Descargando · ${done}`,
  },
} as const;

/**
 * "Downloading · 5.1 of 14.2 MB", with how far along it is, or null while the
 * size isn't known.
 */
export const getDownloadProgressStatus = (
  progress: DownloadProgress,
  language: SupportedLanguage,
): { text: string; fraction: number | null } => {
  const labels = copy[language] || copy.en;
  const known = progress.totalBytes > 0;
  // Until the first progress event, which can take a second or two.
  if (!known && progress.bytesWritten <= 0) return { text: labels.starting, fraction: null };
  const scale = known ? progress.totalBytes : progress.bytesWritten;
  const done = inUnit(progress.bytesWritten, scale, language);
  return {
    text: known
      ? labels.downloading(done, `${inUnit(progress.totalBytes, scale, language)} ${unitOf(scale)}`)
      : labels.downloading(`${done} ${unitOf(scale)}`),
    fraction: known ? Math.min(1, progress.bytesWritten / progress.totalBytes) : null,
  };
};
