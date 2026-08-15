import {
  setAudioModeAsync,
  type AudioMetadata,
  type AudioPlayer,
} from 'expo-audio';

import {
  getAudioPowerCuvChapterLinks,
  type TranslationBook,
  type TranslationBookChapterAudioLinks,
} from './BibleService';
import type { BibleAudioQueueItem } from './BibleAudioPlayer.types';

const BSB_AUDIO_READER_PRIORITY = ['souer', 'hays', 'david'] as const;

/** Configures Bible narration as long-form background media. */
export const configureBibleAudioPlayback = () =>
  setAudioModeAsync({
    interruptionMode: 'doNotMix',
    playsInSilentMode: true,
    shouldPlayInBackground: true,
  });

/** Publishes playback to native system controls and the web Media Session API. */
export const activateBibleAudioLockScreen = (
  player: Pick<AudioPlayer, 'setActiveForLockScreen'>,
  metadata: AudioMetadata,
) =>
  player.setActiveForLockScreen(true, metadata, {
    showSeekBackward: true,
    showSeekForward: true,
  });

/** Returns a stable provider identifier for an audio URL. */
export const getBibleAudioSourceId = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/** Returns the user-facing provider name shown in audio controls. */
export const getBibleAudioSourceLabel = (url: string) => {
  const host = getBibleAudioSourceId(url);
  if (host === 'assets.adventistconnect.org') return 'NYCCSDAS.org';
  if (host === 'theaudiopower.com' || host === 'theaudiopower.org') {
    return 'Audio Power';
  }
  if (host === 'archive.org') return 'Internet Archive';
  if (host === 'bible.helloao.org' || host === 'audio.bible.helloao.org') {
    return 'HelloAO';
  }
  return host.replace(/^www\./, '');
};

export const getBibleAudioMediaTitle = (
  chapterTitle: string,
  translationLabel: string,
  sourceUrl: string,
) =>
  `${chapterTitle} · ${translationLabel} (${getBibleAudioSourceLabel(sourceUrl)})`;

/**
 * Moves a preferred provider to the front without removing automatic
 * fallbacks or changing their relative order.
 */
export const prioritizeBibleAudioSource = (
  urls: string[],
  preferredSourceId?: string,
) => {
  if (!preferredSourceId) return urls;
  return [
    ...urls.filter(
      (url) => getBibleAudioSourceId(url) === preferredSourceId,
    ),
    ...urls.filter(
      (url) => getBibleAudioSourceId(url) !== preferredSourceId,
    ),
  ];
};

/**
 * Orders the narrators exposed for a chapter without loading any audio. BSB's
 * preferred narration order is Souer, Hays, then David; unknown narrators keep
 * the order supplied by the provider.
 */
export const getOrderedBibleAudioReaders = (
  translationId: string,
  links?: TranslationBookChapterAudioLinks,
) => {
  const entries = Object.entries(links || {});
  if (translationId !== 'BSB') return entries;

  const priority = new Map<string, number>(
    BSB_AUDIO_READER_PRIORITY.map((reader, index) => [reader, index]),
  );

  return entries
    .map((entry, providerIndex) => ({ entry, providerIndex }))
    .sort(
      (left, right) =>
        (priority.get(left.entry[0].toLocaleLowerCase()) ??
          BSB_AUDIO_READER_PRIORITY.length) -
          (priority.get(right.entry[0].toLocaleLowerCase()) ??
            BSB_AUDIO_READER_PRIORITY.length) ||
        left.providerIndex - right.providerIndex,
    )
    .map(({ entry }) => entry);
};

/** Returns lightweight chapter coordinates without requesting chapter text. */
export const getFollowingBibleChapters = (
  books: TranslationBook[],
  bookId: string,
  chapter: number,
  limit: number,
) => {
  const chapters: Array<{ book: TranslationBook; chapter: number }> = [];
  let bookIndex = books.findIndex((candidate) => candidate.id === bookId);
  let nextChapter = chapter + 1;

  while (bookIndex >= 0 && bookIndex < books.length && chapters.length < limit) {
    const nextBook = books[bookIndex];
    if (nextChapter <= nextBook.numberOfChapters) {
      chapters.push({ book: nextBook, chapter: nextChapter });
      nextChapter += 1;
    } else {
      bookIndex += 1;
      nextChapter = 1;
    }
  }

  return chapters;
};

/** Retargets a HelloAO recording URL while preserving its narrator filename. */
export const retargetHelloAoAudioUrl = (
  sourceUrl: string,
  translationId: string,
  bookId: string,
  chapter: number,
) => {
  try {
    const url = new URL(sourceUrl);
    if (!/(^|\.)helloao\.org$/i.test(url.hostname)) return null;

    const match = url.pathname.match(
      /^(.*\/api\/)[^/]+\/[^/]+\/\d+(\/audio\/.*)$/,
    );
    if (!match) return null;
    url.pathname = `${match[1]}${translationId}/${bookId}/${chapter}${match[2]}`;
    return url.toString();
  } catch {
    return null;
  }
};

interface BibleAudioQueueOptions {
  albumTitle: string;
  artist: string;
  books: TranslationBook[];
  currentBookId: string;
  currentChapter: number;
  limit: number;
  preferredSourceId?: string;
  selectedAudioUrls: string[];
  selectedReader?: string;
  translationId: string;
  translationLabel: string;
}

/** Builds future track descriptors without fetching chapter text or audio. */
export const buildBibleAudioQueue = ({
  albumTitle,
  artist,
  books,
  currentBookId,
  currentChapter,
  limit,
  preferredSourceId,
  selectedAudioUrls,
  selectedReader,
  translationId,
  translationLabel,
}: BibleAudioQueueOptions): BibleAudioQueueItem[] =>
  getFollowingBibleChapters(
    books,
    currentBookId,
    currentChapter,
    limit,
  ).flatMap(({ book, chapter }) => {
    let queuedUrl: string | undefined;

    if (translationId === 'cmn_cuv' || translationId === 'cmn_cu1') {
      const links = getAudioPowerCuvChapterLinks(
        book.id,
        chapter,
        book.numberOfChapters,
      );
      const source = selectedReader
        ? links[selectedReader]
        : Object.values(links)[0];
      const urls = source ? (Array.isArray(source) ? source : [source]) : [];
      queuedUrl = prioritizeBibleAudioSource(urls, preferredSourceId)[0];
    } else {
      queuedUrl = selectedAudioUrls
        .map((url) =>
          retargetHelloAoAudioUrl(url, translationId, book.id, chapter),
        )
        .find((url): url is string => !!url);
    }

    if (!queuedUrl) return [];
    const title = getBibleAudioMediaTitle(
      `${book.name} ${chapter}`,
      translationLabel,
      queuedUrl,
    );
    return [
      {
        bookId: book.id,
        chapter,
        translationId,
        source: { uri: queuedUrl, name: title },
        metadata: { title, artist, albumTitle },
      },
    ];
  });
