import * as BibleService from './BibleService';

interface BibleChapterLoadOptions {
  retries?: number;
  timeoutMs?: number;
}

type ChapterFetcher = typeof BibleService.fetchChapter;

/**
 * Loads a chapter without allowing a suspended browser request to freeze the
 * reader indefinitely. Each retry receives a fresh AbortSignal.
 */
export async function loadBibleChapterWithRetry(
  translationId: string,
  bookId: string,
  chapter: number,
  options: BibleChapterLoadOptions = {},
  fetchChapter: ChapterFetcher = BibleService.fetchChapter,
) {
  const { retries = 1, timeoutMs = 12_000 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutRequest = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error(`Bible chapter request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        fetchChapter(translationId, bookId, chapter, {
          signal: controller.signal,
        }),
        timeoutRequest,
      ]);
    } catch (error) {
      lastError = error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  throw lastError;
}
