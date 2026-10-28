import { ChildrenLessonDialog, getChildrenLessonStatus } from '@/components/ChildrenLessonDialog';
import { findChildrenLessonUrl } from '@/features/sabbath-school/ChildrenLessons';
import {
  comingSabbathOf,
  fetchChildrenLessonsAhead,
  getChildrenLesson,
  lessonFileName,
  lessonPeriodOf,
  previewChildrenLesson,
  pruneChildrenLessons,
} from '@/features/sabbath-school/LessonDownloads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { getNetworkStateAsync } from 'expo-network';
import { createElement } from 'react';
import { mockFiles } from './helpers/file-system-mock';
import { renderWithPreferences } from './helpers/render-preferences';

// Children's lesson PDFs kept on the phone for the week (#529).
jest.mock('@/features/sabbath-school/ChildrenLessons', () => ({
  ...jest.requireActual('@/features/sabbath-school/ChildrenLessons'),
  findChildrenLessonUrl: jest.fn(),
}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}));

const find = findChildrenLessonUrl as jest.MockedFunction<typeof findChildrenLessonUrl>;
const PDF = 'https://sabbath-school-pdf.adventech.io/pdf/en/2026-04-pp/05/student.pdf';
const OTHER_PDF = 'https://sabbath-school-pdf.adventech.io/pdf/en/2026-04-pp/06/student.pdf';
const WEBSITE = 'https://junior.aliveinjesus.info/';
const day = (text: string) => {
  const [year, month, date] = text.split('-').map(Number);
  return new Date(year, month - 1, date);
};
const WEDNESDAY = day('2026-10-28');
const SABBATH = day('2026-10-31');

const lessonFiles = () =>
  [...mockFiles.keys()].filter((path) => path.startsWith('cache/children-lessons/') && path.endsWith('.pdf'));

type Download = (url: string, destination: File, options?: { onProgress?: Function; signal?: AbortSignal }) => Promise<File>;
const mockDownloads = (download?: Download) =>
  jest.spyOn(File, 'downloadFileAsync').mockImplementation(
    (download ??
      (async (url, destination, options) => {
        options?.onProgress?.({ bytesWritten: 4_200_000, totalBytes: 9_300_000 });
        mockFiles.set(destination.uri, `PDF from ${url}`);
        return destination;
      })) as typeof File.downloadFileAsync,
  );

beforeEach(async () => {
  find.mockReset();
  jest.restoreAllMocks();
  await AsyncStorage.clear();
});

describe("children's lesson downloads", () => {
  it('download a lesson once, then open the copy without looking it up or downloading it again', async () => {
    find.mockResolvedValue(PDF);
    const download = mockDownloads();
    const progress = jest.fn();

    const first = await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY, onProgress: progress });
    expect(first).toMatchObject({ url: PDF, file: expect.any(File) });
    expect(progress.mock.calls).toEqual([
      [{ bytesWritten: 0, totalBytes: -1 }],
      [{ bytesWritten: 4_200_000, totalBytes: 9_300_000 }],
    ]);
    expect(lessonFiles()).toHaveLength(1);

    const again = await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: day('2026-10-30') });
    expect(again).toMatchObject({ url: PDF });
    expect('file' in again && again.file.uri).toBe('file' in first && first.file.uri);
    expect(find).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('look the lesson up again when a Sabbath or a Sunday begins, and in another language', async () => {
    find.mockResolvedValue(PDF);
    mockDownloads();
    await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY });
    await getChildrenLesson({ curriculum: 'junior', language: 'zh' }, { date: WEDNESDAY });
    await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: SABBATH });
    expect(find.mock.calls.map(([curriculum, language, date]) => [curriculum, language, date?.getDay()])).toEqual([
      ['junior', 'en', 3],
      ['junior', 'zh', 3],
      ['junior', 'en', 6],
    ]);
  });

  it("open the age group's website when there's no PDF yet, and look again next time", async () => {
    find.mockResolvedValue(WEBSITE);
    const download = mockDownloads();
    expect(await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY })).toEqual({ url: WEBSITE });
    await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY });
    expect(find).toHaveBeenCalledTimes(2);
    expect(download).not.toHaveBeenCalled();
  });

  it("say there's no connection, instead of opening a page that can't load, when offline with no copy", async () => {
    jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: false, isInternetReachable: false } as never);
    // The lookup finds nothing offline, and gives the website.
    find.mockResolvedValue(WEBSITE);
    expect(await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY })).toEqual({ offline: true });

    // A lesson looked up before, but never downloaded.
    find.mockResolvedValue(PDF);
    jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: true, isInternetReachable: true } as never);
    mockDownloads(async () => {
      throw new Error('stopped');
    });
    await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY });
    jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: true, isInternetReachable: false } as never);
    expect(await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY })).toEqual({ offline: true });
    jest.mocked(getNetworkStateAsync).mockResolvedValue({ isConnected: true, isInternetReachable: true } as never);
  });

  it("open the PDF in the browser when it can't be downloaded, keeping no partial copy", async () => {
    find.mockResolvedValue(PDF);
    mockDownloads(async (_url, destination) => {
      mockFiles.set(destination.uri, 'half a PDF');
      throw new Error('The network connection was lost.');
    });
    expect(await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY })).toEqual({ url: PDF });
    expect(lessonFiles()).toEqual([]);
  });

  it('stop the download when the popup closes', async () => {
    find.mockResolvedValue(PDF);
    mockDownloads(
      (_url, _destination, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () => reject(new Error('AbortError'))),
        ),
    );
    const controller = new AbortController();
    const lesson = getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY, signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(lesson).rejects.toThrow('AbortError');
    expect(lessonFiles()).toEqual([]);
  });

  it('start the download again when the popup closes and the lesson is tapped again', async () => {
    find.mockResolvedValue(PDF);
    let calls = 0;
    const download = mockDownloads(async (url, destination, options) => {
      if (++calls === 1) {
        await new Promise((_resolve, reject) =>
          options?.signal?.addEventListener('abort', () => reject(new Error('AbortError'))),
        );
      }
      mockFiles.set(destination.uri, `PDF from ${url}`);
      return destination;
    });
    const controller = new AbortController();
    const first = getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY, signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    const again = getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY });
    await expect(first).rejects.toThrow('AbortError');
    expect(await again).toMatchObject({ url: PDF, file: expect.any(File) });
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('share a download already under way, as when a tap comes during a Wi-Fi fetch', async () => {
    find.mockResolvedValue(PDF);
    const download = mockDownloads();
    const [one, two] = await Promise.all([
      getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY }),
      getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY }),
    ]);
    expect(download).toHaveBeenCalledTimes(1);
    expect('file' in one && 'file' in two && one.file.uri === two.file.uri).toBe(true);
  });

  it('fetch the coming Sabbath’s lesson ahead for the two age groups opened most recently', async () => {
    find.mockImplementation(async (curriculum, _language, date) =>
      date?.getDay() === 6 ? `${OTHER_PDF}?${curriculum}` : `${PDF}?${curriculum}`,
    );
    const download = mockDownloads();
    for (const curriculum of ['beginner-student', 'primary-student', 'junior'] as const) {
      await getChildrenLesson({ curriculum, language: 'en' }, { date: WEDNESDAY });
    }
    find.mockClear();
    download.mockClear();

    await fetchChildrenLessonsAhead(WEDNESDAY);
    expect(find.mock.calls.map(([curriculum, , date]) => [curriculum, date && lessonPeriodOf(date)])).toEqual([
      ['junior', '2026-10-31'],
      ['primary-student', '2026-10-31'],
    ]);
    expect(download.mock.calls.map(([url]) => url)).toEqual([`${OTHER_PDF}?junior`, `${OTHER_PDF}?primary-student`]);

    // On Sabbath, they open without a lookup or a download.
    find.mockClear();
    download.mockClear();
    expect(await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: SABBATH })).toMatchObject({
      url: `${OTHER_PDF}?junior`,
      file: expect.any(File),
    });
    expect(find).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("look up this week's lesson ahead too, so a lesson opened on Sabbath opens offline on Monday", async () => {
    // A quarterly lesson runs Sabbath to Friday, but the lookups change on Sunday too.
    find.mockResolvedValue(PDF);
    const download = mockDownloads();
    await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: SABBATH });
    const monday = day('2026-11-02');
    find.mockImplementation(async (_curriculum, _language, date) => (date?.getDay() === 6 ? OTHER_PDF : PDF));

    await fetchChildrenLessonsAhead(monday);
    expect(find.mock.calls.slice(1).map(([, , date]) => date && lessonPeriodOf(date))).toEqual(['2026-11-01', '2026-11-07']);
    expect(download.mock.calls.map(([url]) => url)).toEqual([PDF, OTHER_PDF]);

    // Offline on Monday: no lookup, and the copy from Sabbath.
    find.mockRejectedValue(new Error('offline'));
    expect(await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: monday })).toMatchObject({
      url: PDF,
      file: expect.any(File),
    });
  });

  it('delete the copies a week after their period, keeping the current ones', async () => {
    find.mockResolvedValueOnce(PDF).mockResolvedValueOnce(OTHER_PDF);
    mockDownloads();
    await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: day('2026-10-14') });
    await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY });
    expect(lessonFiles()).toHaveLength(2);

    await pruneChildrenLessons(WEDNESDAY);
    expect(lessonFiles()).toEqual([`cache/children-lessons/${lessonFileName('junior', OTHER_PDF)}`]);
    expect(mockFiles.has('cache/children-lessons/index.json')).toBe(true);
  });

  it('name the periods by the Sabbath or Sunday that begins them', () => {
    expect(['2026-10-31', '2026-11-01', '2026-11-06', '2026-11-07'].map((each) => lessonPeriodOf(day(each)))).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-01',
      '2026-11-07',
    ]);
    expect(lessonPeriodOf(comingSabbathOf(WEDNESDAY))).toBe('2026-10-31');
    expect(lessonPeriodOf(comingSabbathOf(SABBATH))).toBe('2026-10-31');
  });

  it('name each copy for its age group and guide, which the viewer shows, and its address', () => {
    expect(lessonFileName('junior', PDF)).toMatch(/^junior-[0-9a-f]{8}\.pdf$/);
    expect(lessonFileName('junior', PDF)).not.toBe(lessonFileName('junior', OTHER_PDF));
    expect(lessonFileName('primary-teacher', PDF)).toMatch(/^primary-teacher-/);
  });

  it('remember the lessons opened most recently when a full phone clears the cache', async () => {
    find.mockResolvedValue(PDF);
    const download = mockDownloads();
    await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY });
    for (const path of [...mockFiles.keys()]) mockFiles.delete(path);
    download.mockClear();

    await fetchChildrenLessonsAhead(WEDNESDAY);
    expect(find).toHaveBeenLastCalledWith('junior', 'en', comingSabbathOf(WEDNESDAY));
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("open in the phone's PDF viewer, or report that there's none", async () => {
    find.mockResolvedValue(PDF);
    mockDownloads();
    const lesson = await getChildrenLesson({ curriculum: 'junior', language: 'en' }, { date: WEDNESDAY });
    if (!('file' in lesson)) throw new Error('No copy');
    const preview = jest.spyOn(lesson.file, 'preview');
    expect(await previewChildrenLesson(lesson.file, 'Junior (ages 10–12)')).toBe(true);
    expect(preview).toHaveBeenCalledWith({ mimeType: 'application/pdf', title: 'Junior (ages 10–12)' });

    jest.spyOn(lesson.file, 'canPreview').mockResolvedValue(false);
    expect(await previewChildrenLesson(lesson.file, 'Junior (ages 10–12)')).toBe(false);
  });
});

describe("the children's lesson popup", () => {
  it('say it is finding the lesson, then how much has downloaded, in each language', () => {
    expect(getChildrenLessonStatus(null, 'en')).toEqual({ text: 'Finding this week’s lesson…', fraction: null });
    // Until the first progress event, and then without a size if the server gives none.
    expect(getChildrenLessonStatus({ bytesWritten: 0, totalBytes: -1 }, 'zh')).toEqual({ text: '下載中…', fraction: null });
    expect(getChildrenLessonStatus({ bytesWritten: 1_200_000, totalBytes: -1 }, 'en')).toEqual({
      text: 'Downloading · 1.2 MB',
      fraction: null,
    });
    expect(getChildrenLessonStatus({ bytesWritten: 4_200_000, totalBytes: 9_300_000 }, 'es')).toMatchObject({
      text: 'Descargando · 4,2 de 9,3 MB',
    });
    expect(getChildrenLessonStatus({ bytesWritten: 16_450_000, totalBytes: 32_900_000 }, 'zh-cn')).toEqual({
      text: '下载中 · 16.4 / 32.9 MB',
      fraction: 0.5,
    });
  });

  it('say when there is no connection, with only the X', async () => {
    const screen = await renderWithPreferences(
      createElement(ChildrenLessonDialog, {
        offline: true,
        onCancel: jest.fn(),
        progress: null,
        title: '少年級（10–12 歲）',
        visible: true,
      }),
      { language: 'zh' },
    );
    expect(screen.getByText('沒有網路連線。請連上網路以下載本週課程。')).toBeTruthy();
    expect(screen.queryByText('正在尋找本週課程…')).toBeNull();
  });

  it('close with an X, which stops the download', async () => {
    const onCancel = jest.fn();
    const screen = await renderWithPreferences(
      createElement(ChildrenLessonDialog, {
        onCancel,
        progress: { bytesWritten: 4_200_000, totalBytes: 9_300_000 },
        title: 'Junior (ages 10–12)',
        visible: true,
      }),
    );
    expect(screen.getByText('Downloading · 4.2 of 9.3 MB')).toBeTruthy();
    expect(screen.queryByText('Close')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
