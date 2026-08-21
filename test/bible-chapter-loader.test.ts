import { loadBibleChapterWithRetry } from '@/services/BibleChapterLoader';

describe('Bible chapter loading recovery', () => {
  afterEach(() => jest.useRealTimers());

  it('aborts a suspended request and retries with a fresh request', async () => {
    jest.useFakeTimers();
    const chapter = { chapter: { number: 2 } } as any;
    const signals: AbortSignal[] = [];
    const fetchChapter = jest
      .fn()
      .mockImplementationOnce(
        (_translation, _book, _chapter, options) =>
          new Promise((_resolve, reject) => {
            signals.push(options.signal);
            options.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      )
      .mockImplementationOnce(
        (_translation, _book, _chapter, options) => {
          signals.push(options.signal);
          return Promise.resolve(chapter);
        },
      );

    const request = loadBibleChapterWithRetry(
      'BSB',
      'GEN',
      2,
      { retries: 1, timeoutMs: 100 },
      fetchChapter as any,
    );
    await jest.advanceTimersByTimeAsync(100);

    await expect(request).resolves.toBe(chapter);
    expect(fetchChapter).toHaveBeenCalledTimes(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('surfaces the final error after the bounded retry', async () => {
    const error = new Error('offline');
    const fetchChapter = jest.fn().mockRejectedValue(error);

    await expect(
      loadBibleChapterWithRetry(
        'BSB',
        'GEN',
        2,
        { retries: 1, timeoutMs: 100 },
        fetchChapter as any,
      ),
    ).rejects.toBe(error);
    expect(fetchChapter).toHaveBeenCalledTimes(2);
  });
});
