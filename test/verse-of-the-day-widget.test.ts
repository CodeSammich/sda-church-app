import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import * as BibleService from '@/services/BibleService';
import {
  getVerseOfTheDay,
  getVerseOfTheDayDateKey,
  type VerseReference,
} from '@/services/VerseOfTheDay';
import * as VerseOfTheDayText from '@/services/VerseOfTheDayText';
import {
  APP_LINK_SCHEME,
  VERSE_WIDGET_DAYS,
  getVerseWidgetUrl,
  loadVerseWidgetDays,
  type VerseWidgetDay,
  type VerseWidgetProps,
} from '@/services/VerseOfTheDayWidgetData';

jest.mock('expo-widgets', () => ({
  createWidget: (name: string, layout: unknown) => ({ name, layout, updateSnapshot: () => {} }),
}));
jest.mock('@expo/ui/jetpack-compose', () => ({}));
jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({}));

const appJson = JSON.parse(readFileSync(resolve(process.cwd(), 'app.json'), 'utf8')).expo;
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const plugin = require('../plugins/withAndroidVerseWidget');

afterEach(() => {
  jest.useRealTimers();
});

describe('the verses the app hands the widget', () => {
  const fakeVerse = (selection: VerseReference) => ({
    ...selection,
    text: `Text of ${selection.bookId} ${selection.chapter}:${selection.verse}`,
    reference: `${selection.bookId} ${selection.chapter}:${selection.verse}`,
  });

  beforeEach(() => {
    jest
      .spyOn(VerseOfTheDayText, 'loadVerseOfTheDayText')
      .mockImplementation(async (_translationId, selection) => fakeVerse(selection));
  });

  it('cover a week from today, each day with that day’s verse', async () => {
    const now = new Date(2026, 10, 2, 9, 30);
    const days = await loadVerseWidgetDays('en', now);

    expect(days).toHaveLength(VERSE_WIDGET_DAYS);
    days.forEach((day, offset) => {
      const date = new Date(2026, 10, 2 + offset, 12);
      const verse = getVerseOfTheDay(date);
      expect(day.day).toBe(getVerseOfTheDayDateKey(date));
      expect(day.text).toBe(fakeVerse(verse).text);
      expect(day.url).toBe(getVerseWidgetUrl(verse, 'en'));
    });
    expect(days[0].day).toBe('2026-11-2');
    expect(days[6].day).toBe('2026-11-8');
  });

  it('start from yesterday before 6 AM, as the home page does', async () => {
    const days = await loadVerseWidgetDays('en', new Date(2026, 10, 2, 5, 59));
    expect(days[0].day).toBe('2026-11-1');
    expect(days[0].text).toBe(fakeVerse(getVerseOfTheDay(new Date(2026, 10, 2, 5, 59))).text);
  });

  it('come from the language’s own Bible', async () => {
    const load = VerseOfTheDayText.loadVerseOfTheDayText as jest.Mock;
    await loadVerseWidgetDays('zh', new Date(2026, 10, 2, 9));
    expect(load).toHaveBeenCalledWith('cmn_cuv', expect.anything());
    await loadVerseWidgetDays('es', new Date(2026, 10, 2, 9));
    expect(load).toHaveBeenCalledWith('spa_r09', expect.anything());
  });

  it('skip a day whose verse the Bible lacks', async () => {
    (VerseOfTheDayText.loadVerseOfTheDayText as jest.Mock).mockImplementation(
      async (_translationId: string, selection: VerseReference) =>
        selection.bookId === getVerseOfTheDay(new Date(2026, 10, 3, 12)).bookId &&
        selection.verse === getVerseOfTheDay(new Date(2026, 10, 3, 12)).verse
          ? null
          : fakeVerse(selection),
    );
    const days = await loadVerseWidgetDays('en', new Date(2026, 10, 2, 9));
    expect(days.map((day) => day.day)).not.toContain('2026-11-3');
  });

  it('open the verse in the reader the way the home page’s Read button does', () => {
    const url = getVerseWidgetUrl({ bookId: 'PSA', chapter: 23, verse: 1 }, 'zh-cn');
    expect(url).toBe(
      'sdachurchapp://bible?translationId=cmn_cu1&bookId=PSA&chapter=23&verseStart=1&verseEnd=1&backTo=%2F',
    );
    expect(APP_LINK_SCHEME).toBe(appJson.scheme);
  });
});

describe('updating the widget from the home page', () => {
  const week: VerseWidgetDay[] = [
    { day: '2026-11-2', text: 'Monday', reference: 'Ref', url: 'sdachurchapp://bible' },
  ];
  let cache: Map<string, string>;
  let service: typeof import('@/services/VerseOfTheDayWidget.android');
  let widget: { updateSnapshot: jest.Mock };
  let loadDays: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 2, 9) });
    cache = new Map();
    jest.isolateModules(() => {
      const CacheStore = require('@/services/CacheStore');
      jest.spyOn(CacheStore, 'readCachedText').mockImplementation(async (spec: any) => cache.get(spec.name) ?? null);
      jest.spyOn(CacheStore, 'writeCachedText').mockImplementation(async (spec: any, text: any) => {
        cache.set(spec.name, text);
      });
      loadDays = jest
        .spyOn(require('@/services/VerseOfTheDayWidgetData'), 'loadVerseWidgetDays')
        .mockResolvedValue(week);
      widget = require('@/widgets/VerseOfTheDayWidget').default;
      widget.updateSnapshot = jest.fn();
      service = require('@/services/VerseOfTheDayWidget.android');
    });
  });

  it('hands the widget the week once a day, and again for another language', async () => {
    await service.updateVerseOfTheDayWidget('en', 'Today’s Verse');
    expect(widget.updateSnapshot).toHaveBeenCalledWith({ title: 'Today’s Verse', days: week });

    await service.updateVerseOfTheDayWidget('en', 'Today’s Verse');
    expect(widget.updateSnapshot).toHaveBeenCalledTimes(1);

    await service.updateVerseOfTheDayWidget('zh', '今日經文');
    expect(widget.updateSnapshot).toHaveBeenCalledTimes(2);
    expect(loadDays).toHaveBeenLastCalledWith('zh');

    jest.setSystemTime(new Date(2026, 10, 3, 6));
    await service.updateVerseOfTheDayWidget('zh', '今日經文');
    expect(widget.updateSnapshot).toHaveBeenCalledTimes(3);
  });

  it('keeps only the newest language’s verses when the language changes mid-load', async () => {
    let finishEnglish: (days: VerseWidgetDay[]) => void = () => {};
    loadDays.mockImplementationOnce(() => new Promise((resolve) => (finishEnglish = resolve)));
    const english = service.updateVerseOfTheDayWidget('en', 'Today’s Verse');
    await service.updateVerseOfTheDayWidget('es', 'Versículo de hoy');
    finishEnglish(week);
    await english;
    expect(widget.updateSnapshot).toHaveBeenCalledTimes(1);
    expect(widget.updateSnapshot).toHaveBeenCalledWith({ title: 'Versículo de hoy', days: week });
  });

  it('leaves the widget alone when no verse loads', async () => {
    loadDays.mockResolvedValueOnce([]);
    await service.updateVerseOfTheDayWidget('en', 'Today’s Verse');
    loadDays.mockRejectedValueOnce(new Error('no Bible'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await service.updateVerseOfTheDayWidget('en', 'Today’s Verse');
    expect(widget.updateSnapshot).not.toHaveBeenCalled();
    expect(cache.size).toBe(0);
  });

  it('does nothing on iOS and the web', async () => {
    const { updateVerseOfTheDayWidget } = require('@/services/VerseOfTheDayWidget');
    await expect(updateVerseOfTheDayWidget('en', 'Today’s Verse')).resolves.toBeUndefined();
    expect(widget.updateSnapshot).not.toHaveBeenCalled();
  });
});

describe('the verse text', () => {
  it('is read from the Bible that ships with the app, with its book name', async () => {
    jest.spyOn(BibleService, 'fetchBooks').mockResolvedValue([
      { id: 'PSA', name: 'Psalm' } as BibleService.TranslationBook,
    ]);
    jest.spyOn(BibleService, 'fetchChapter').mockResolvedValue({
      chapter: {
        content: [
          { type: 'verse', number: 1, content: ['The LORD is my shepherd; I shall not want.'] },
        ],
      },
    } as unknown as BibleService.TranslationBookChapter);

    await expect(
      VerseOfTheDayText.loadVerseOfTheDayText('BSB', { bookId: 'PSA', chapter: 23, verse: 1 }),
    ).resolves.toEqual({
      text: 'The LORD is my shepherd; I shall not want.',
      reference: 'Psalm 23:1',
      bookId: 'PSA',
      chapter: 23,
      verse: 1,
    });
    await expect(
      VerseOfTheDayText.loadVerseOfTheDayText('BSB', { bookId: 'PSA', chapter: 23, verse: 9 }),
    ).resolves.toBeNull();
    await expect(
      VerseOfTheDayText.loadVerseOfTheDayText('BSB', { bookId: 'JHN', chapter: 3, verse: 16 }),
    ).resolves.toBeNull();
  });
});

describe('the widget layout', () => {
  type Node = { type: unknown; props: Record<string, any> };

  // Android runs the layout as a string in the widget's own runtime, where
  // Expo UI's components, modifiers, and JSX functions are globals.
  const layout = (): string => require('@/widgets/VerseOfTheDayWidget').default.layout;
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
  const modifier =
    (name: string) =>
    (...args: unknown[]) => ({ $type: name, args });
  const globals: Record<string, unknown> = {
    Button: 'Button',
    Column: 'Column',
    Spacer: 'Spacer',
    Text: 'Text',
    cornerRadius: modifier('cornerRadius'),
    fillMaxSize: modifier('fillMaxSize'),
    height: modifier('height'),
    paddingAll: modifier('paddingAll'),
    _jsx: jsx,
    _jsxs: jsx,
    _jsxDEV: jsx,
    _jsxFileName: 'widget',
  };
  let widgetFunction: ((props: unknown, environment: unknown) => Node) | undefined;
  const render = (props: Partial<VerseWidgetProps> | undefined, colorScheme = 'light'): Node => {
    widgetFunction ??= new Function(...Object.keys(globals), `return (${layout()});`)(
      ...Object.values(globals),
    );
    return widgetFunction!(props, { colorScheme });
  };
  const texts = (node: Node): string[] => {
    const children = [node.props.children].flat().filter(Boolean) as (Node | string)[];
    if (node.type === 'Text') return children.map(String);
    return children.flatMap((child) => (typeof child === 'string' ? [] : texts(child)));
  };
  const day = (key: string, text: string): VerseWidgetDay => ({
    day: key,
    text,
    reference: `Ref ${key}`,
    url: `sdachurchapp://bible?day=${key}`,
  });
  const week: VerseWidgetProps = {
    title: 'Today’s Verse',
    days: [day('2026-11-2', 'Monday'), day('2026-11-3', 'Tuesday'), day('2026-11-4', 'Wednesday')],
  };

  it('is a string for the widget runtime, not a function', () => {
    expect(typeof layout()).toBe('string');
  });

  it('shows the day’s verse, title, and reference', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 14) });
    expect(texts(render(week))).toEqual(['Today’s Verse', 'Tuesday', '— Ref 2026-11-3']);
  });

  it('changes verses at 6 AM, as the app does', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 5, 59) });
    expect(texts(render(week))).toContain('Monday');
    jest.setSystemTime(new Date(2026, 10, 3, 6, 0));
    expect(texts(render(week))).toContain('Tuesday');
  });

  it('picks the same day as the app for every hour of a year', () => {
    jest.useFakeTimers();
    const misses: string[] = [];
    for (let hour = 0; hour < 366 * 24; hour += 1) {
      const now = new Date(2026, 0, 1, hour, 30);
      const key = getVerseOfTheDayDateKey(now);
      jest.setSystemTime(now);
      const shown = texts(render({ title: 'T', days: [day(key, 'Match'), day('later', 'Other')] }));
      if (!shown.includes('Match')) misses.push(now.toString());
    }
    expect(misses).toEqual([]);
  });

  it('keeps the last verse it has after the week runs out', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 20, 9) });
    expect(texts(render(week))).toContain('Wednesday');
  });

  it('asks the reader to open the app before the app has sent any verses', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    for (const props of [undefined, {}, { title: 'Verse', days: [] }]) {
      const tree = render(props);
      expect(texts(tree)).toContain('Open the app to see today’s verse.');
      expect(tree.props.target).toBe('sdachurchapp://');
    }
  });

  it('opens the verse when tapped anywhere', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    const tree = render(week);
    expect(tree.type).toBe('Button');
    expect(tree.props.target).toBe('sdachurchapp://bible?day=2026-11-3');
    expect(tree.props.modifiers).toContainEqual({ $type: 'fillMaxSize', args: [] });
  });

  it('follows the phone’s dark mode with the app’s dark colors', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    expect(render(week, 'light').props.colors.containerColor).toBe('#FAF4EF');
    expect(render(week, 'dark').props.colors.containerColor).toBe('#14130F');
  });

  it('uses smaller type for long verses, counting Chinese characters as wide', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    const fontSize = (text: string) => {
      const column = render({ title: 'T', days: [day('2026-11-3', text)] }).props.children;
      return column.props.children[2].props.style.fontSize;
    };
    expect(fontSize('a'.repeat(100))).toBe(16);
    expect(fontSize('a'.repeat(200))).toBe(14);
    expect(fontSize('a'.repeat(300))).toBe(13);
    expect(fontSize('神'.repeat(100))).toBe(14);
  });
});

describe('the Android widget config plugin', () => {
  it('opens only app links, in the app itself, from the widget’s receiver', () => {
    const kotlin: string = plugin.createProviderKt('org.example.app');
    expect(kotlin).toContain('package org.example.app');
    expect(kotlin).toContain('class VerseOfTheDayProvider : ExpoWidgetsAppWidgetProvider("VerseOfTheDay")');
    expect(kotlin).toContain(`const val LINK_PREFIX = "${appJson.scheme}:"`);
    expect(kotlin).toContain('.setPackage(context.packageName)');
    expect(kotlin).toContain('super.onReceive(context, intent)');
    expect(kotlin).toContain('"widget-${System.currentTimeMillis()}"');
  });

  it('has Android redraw the widget every hour', () => {
    expect(plugin.setUpdatePeriod('<a android:updatePeriodMillis="0" />')).toBe(
      '<a android:updatePeriodMillis="3600000" />',
    );
    expect(() => plugin.setUpdatePeriod('<a />')).toThrow('updatePeriodMillis');
  });

  it('escapes the widget picker’s labels', () => {
    expect(plugin.createLocalizedStringsXml({ displayName: "Jim's & <b>", description: 'd' })).toContain(
      '<string name="verse_of_the_day_display_name">Jim\\\'s &amp; &lt;b&gt;</string>',
    );
  });

  it('uses the widget name the app registers', () => {
    expect(require('@/widgets/VerseOfTheDayWidget').default.name).toBe(plugin.VERSE_WIDGET.name);
    expect(plugin.VERSE_WIDGET.ios).toBeNull();
  });

  it('edits the files expo-widgets writes, after it writes them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'verse-widget-'));
    try {
      const androidRoot = join(root, 'android');
      mkdirSync(androidRoot, { recursive: true });
      const config = plugin({
        name: 'Test',
        slug: 'test',
        android: { package: 'org.example.app' },
        _internal: { projectRoot: root },
      });
      await config.mods.android.dangerous({
        ...config,
        modRequest: {
          projectRoot: root,
          platformProjectRoot: androidRoot,
          platform: 'android',
          modName: 'dangerous',
          introspect: false,
        },
      });

      const read = (path: string) => readFileSync(join(androidRoot, 'app/src/main', path), 'utf8');
      expect(read('java/org/example/app/VerseOfTheDayProvider.kt')).toContain('NYCCSDA_VERSE_WIDGET');
      expect(read('res/xml/verse_of_the_day_info.xml')).toContain(
        'android:updatePeriodMillis="3600000"',
      );
      expect(read('res/values/expo_widgets.xml')).toContain('Today’s Verse');
      expect(read('res/values-b+zh+Hant/verse_widget_strings.xml')).toContain('今日經文');
      expect(read('res/values-b+zh+Hans/verse_widget_strings.xml')).toContain('今日经文');
      expect(read('res/values-es/verse_widget_strings.xml')).toContain('Versículo de hoy');
      expect(JSON.parse(read('expo-widgets-layout-registry.config.json'))).toEqual({
        widgets: [{ name: 'VerseOfTheDay', initialLayout: './widgets/VerseOfTheDayWidget.tsx' }],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps expo-widgets and Expo UI out of the iPhone app', () => {
    expect(appJson.plugins).toContain('./plugins/withAndroidVerseWidget');
    expect(appJson.plugins.flat()).not.toContain('expo-widgets');
    expect(packageJson.expo.autolinking.ios.exclude).toEqual(
      expect.arrayContaining(['expo-widgets', '@expo/ui']),
    );
  });
});
