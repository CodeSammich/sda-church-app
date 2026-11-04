import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { DARK_THEME_COLORS, LIGHT_THEME_COLORS } from '@/constants/ThemeColors';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
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
  loadVerseWidgetWeek,
  type VerseWidgetDay,
  type VerseWidgetProps,
  type VerseWidgetWeek,
  VERSE_WIDGET_THEME_LABELS,
} from '@/services/VerseOfTheDayWidgetData';

// The widgets the app registers, and its redraws through its own receiver.
const mockCreatedWidgets: { name: string; layout: unknown; props: unknown }[] = [];
const mockRedraws: number[] = [];
jest.mock('expo-widgets', () => ({
  createWidget: (name: string, layout: unknown, props?: unknown) => {
    mockCreatedWidgets.push({ name, layout, props });
    return { name, layout };
  },
}));
jest.mock('@/modules/verse-widget', () => ({
  redrawVerseWidget: async () => {
    mockRedraws.push(Date.now());
  },
}));
jest.mock('@expo/ui/jetpack-compose', () => ({}));
jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({}));

const appJson = JSON.parse(readFileSync(resolve(process.cwd(), 'app.json'), 'utf8')).expo;
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
const plugin = require('../plugins/withAndroidVerseWidget');
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const receiverKotlin = read(
  'modules/verse-widget/android/src/main/java/org/nyccsda/versewidget/VerseWidgetReceiver.kt',
);
const englishLabels = { title: 'Today’s Verse', share: 'Share Verse' };

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

  const loadDays = async (language: 'en' | 'zh' | 'es', now: Date) =>
    (await loadVerseWidgetWeek(language, englishLabels, now)).days;

  it('cover a week from today, each day with that day’s verse', async () => {
    const now = new Date(2026, 10, 2, 9, 30);
    const days = await loadDays('en', now);

    expect(days).toHaveLength(VERSE_WIDGET_DAYS);
    days.forEach((day, offset) => {
      const date = new Date(2026, 10, 2 + offset, 12);
      const verse = getVerseOfTheDay(date);
      expect(day.day).toBe(getVerseOfTheDayDateKey(date));
      expect(day.text).toBe(fakeVerse(verse).text);
      expect(day.verse).toBe(verse.verse);
      expect(day.url).toBe(getVerseWidgetUrl(verse, 'en'));
    });
    expect(days[0].day).toBe('2026-11-2');
    expect(days[6].day).toBe('2026-11-8');
  });

  it('come with the home page’s labels and the translation’s name', async () => {
    const week = await loadVerseWidgetWeek('zh', { title: '今日經文', share: '分享經文' }, new Date(2026, 10, 2, 9));
    expect(week).toEqual(
      expect.objectContaining({ title: '今日經文', shareLabel: '分享經文', translation: 'CUV' }),
    );
  });

  it('label the light/dark button in every language', async () => {
    for (const language of ['en', 'zh', 'zh-cn', 'es'] as const) {
      const week = await loadVerseWidgetWeek(language, englishLabels, new Date(2026, 10, 2, 9));
      expect(week.themeLabel).toBe(VERSE_WIDGET_THEME_LABELS[language]);
    }
    expect(Object.values(VERSE_WIDGET_THEME_LABELS)).toEqual([
      'Switch between light and dark',
      '切換淺色／深色',
      '切换浅色／深色',
      'Cambiar entre claro y oscuro',
    ]);
  });

  it('share each verse the way the home page’s Share button does', async () => {
    const [day] = await loadDays('es', new Date(2026, 10, 2, 9));
    expect(day.share).toBe(`${day.text}\n\n— ${day.reference} (RVR09)`);
  });

  it('start from yesterday before 6 AM, as the home page does', async () => {
    const days = await loadDays('en', new Date(2026, 10, 2, 5, 59));
    expect(days[0].day).toBe('2026-11-1');
    expect(days[0].text).toBe(fakeVerse(getVerseOfTheDay(new Date(2026, 10, 2, 5, 59))).text);
  });

  it('come from the language’s own Bible', async () => {
    const load = VerseOfTheDayText.loadVerseOfTheDayText as jest.Mock;
    await loadDays('zh', new Date(2026, 10, 2, 9));
    expect(load).toHaveBeenCalledWith('cmn_cuv', expect.anything());
    await loadDays('es', new Date(2026, 10, 2, 9));
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
    const days = await loadDays('en', new Date(2026, 10, 2, 9));
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
  const day: VerseWidgetDay = {
    day: '2026-11-2',
    text: 'Monday',
    reference: 'Ref 1:1',
    verse: 1,
    url: 'sdachurchapp://bible',
    share: 'Monday\n\n— Ref 1:1 (BSB)',
  };
  const weekIn = (labels: { title: string; share: string }): VerseWidgetWeek => ({
    title: labels.title,
    shareLabel: labels.share,
    themeLabel: 'Switch between light and dark',
    translation: 'BSB',
    days: [day],
  });
  const week = weekIn(englishLabels);
  const spanishLabels = { title: 'Versículo de hoy', share: 'Compartir' };
  const withColors = (w: VerseWidgetWeek) => ({ ...w, colors: { light: LIGHT_THEME_COLORS, dark: DARK_THEME_COLORS } });
  let cache: Map<string, string>;
  let service: typeof import('@/services/VerseOfTheDayWidget.android');
  let loadWeek: jest.SpyInstance;
  const storedProps = () => mockCreatedWidgets.map((widget) => widget.props);

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 2, 9) });
    cache = new Map();
    mockCreatedWidgets.length = 0;
    mockRedraws.length = 0;
    jest.isolateModules(() => {
      const CacheStore = require('@/services/CacheStore');
      jest.spyOn(CacheStore, 'readCachedText').mockImplementation(async (spec: any) => cache.get(spec.name) ?? null);
      jest.spyOn(CacheStore, 'writeCachedText').mockImplementation(async (spec: any, text: any) => {
        cache.set(spec.name, text);
      });
      loadWeek = jest
        .spyOn(require('@/services/VerseOfTheDayWidgetData'), 'loadVerseWidgetWeek')
        .mockImplementation(async (_language, labels) => weekIn(labels as typeof englishLabels));
      service = require('@/services/VerseOfTheDayWidget.android');
    });
  });

  it('stores the week with the theme’s colors without drawing, then redraws through the app’s receiver', async () => {
    await service.updateVerseOfTheDayWidget('en', englishLabels);
    expect(mockCreatedWidgets).toEqual([
      {
        name: 'VerseOfTheDay',
        layout: require('@/features/verse-of-the-day/VerseOfTheDayWidgetLayout').VerseOfTheDayWidgetLayout,
        props: withColors(week),
      },
    ]);
    expect(mockRedraws).toHaveLength(1);
  });

  it('reads a new week once a day, and again for another language', async () => {
    await service.updateVerseOfTheDayWidget('en', englishLabels);
    await service.updateVerseOfTheDayWidget('en', englishLabels);
    expect(loadWeek).toHaveBeenCalledTimes(1);
    expect(mockRedraws).toHaveLength(1);

    const chinese = { title: '今日經文', share: '分享經文' };
    await service.updateVerseOfTheDayWidget('zh', chinese);
    expect(loadWeek).toHaveBeenLastCalledWith('zh', chinese);
    expect(storedProps()).toHaveLength(2);

    jest.setSystemTime(new Date(2026, 10, 3, 6));
    await service.updateVerseOfTheDayWidget('zh', chinese);
    expect(loadWeek).toHaveBeenCalledTimes(3);
    expect(mockRedraws).toHaveLength(3);
  });

  it('hands the widget its last week once each time the app runs, without reading the Bible', async () => {
    const made = ['2026-11-2', 'en', englishLabels.title, englishLabels.share].join('\n');
    cache.set('widget.json', JSON.stringify({ made, week }));
    await service.updateVerseOfTheDayWidget('en', englishLabels);
    await service.updateVerseOfTheDayWidget('en', englishLabels);
    expect(storedProps()).toEqual([withColors(week)]);
    expect(mockRedraws).toHaveLength(1);
    expect(loadWeek).not.toHaveBeenCalled();
  });

  it('reads the week again if its saved copy is unreadable', async () => {
    cache.set('widget.json', '{"made":');
    await service.updateVerseOfTheDayWidget('en', englishLabels);
    expect(loadWeek).toHaveBeenCalledTimes(1);
    expect(storedProps()).toEqual([withColors(week)]);
  });

  it('keeps only the newest language’s verses when the language changes mid-load', async () => {
    let finishEnglish: (w: VerseWidgetWeek) => void = () => {};
    loadWeek.mockImplementationOnce(() => new Promise((resolve) => (finishEnglish = resolve)));
    const english = service.updateVerseOfTheDayWidget('en', englishLabels);
    await service.updateVerseOfTheDayWidget('es', spanishLabels);
    finishEnglish(week);
    await english;
    expect(storedProps()).toEqual([withColors(weekIn(spanishLabels))]);
  });

  it('leaves the widget alone when no verse loads', async () => {
    loadWeek.mockResolvedValueOnce({ ...week, days: [] });
    await service.updateVerseOfTheDayWidget('en', englishLabels);
    loadWeek.mockRejectedValueOnce(new Error('no Bible'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await service.updateVerseOfTheDayWidget('en', englishLabels);
    expect(mockCreatedWidgets).toEqual([]);
    expect(mockRedraws).toEqual([]);
    expect(cache.size).toBe(0);
  });

  it('does nothing on iOS and the web', async () => {
    const { updateVerseOfTheDayWidget } = require('@/services/VerseOfTheDayWidget');
    await expect(updateVerseOfTheDayWidget('en', englishLabels)).resolves.toBeUndefined();
    expect(mockCreatedWidgets).toEqual([]);
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
  const layoutModule = () => require('@/features/verse-of-the-day/VerseOfTheDayWidgetLayout');
  const layout = (): string => layoutModule().VerseOfTheDayWidgetLayout;
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
  const modifier =
    (name: string) =>
    (...args: unknown[]) => ({ $type: name, args });
  const globals: Record<string, unknown> = {
    Box: 'Box',
    Row: 'Row',
    Button: 'Button',
    Column: 'Column',
    Image: 'Image',
    Spacer: 'Spacer',
    Text: 'Text',
    cornerRadius: modifier('cornerRadius'),
    fillMaxSize: modifier('fillMaxSize'),
    fillMaxWidth: modifier('fillMaxWidth'),
    height: modifier('height'),
    padding: modifier('padding'),
    paddingAll: modifier('paddingAll'),
    size: modifier('size'),
    width: modifier('width'),
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
  const nodes = (node: Node): Node[] => {
    const children = [node.props.children].flat().filter((child) => child && typeof child === 'object');
    return [node, ...children.flatMap((child: Node) => nodes(child))];
  };
  const textNodes = (node: Node) => nodes(node).filter((n) => n.type === 'Text');
  const texts = (node: Node): string[] => textNodes(node).map((n) => String(n.props.children));
  const day = (key: string, text: string): VerseWidgetDay => ({
    day: key,
    text,
    reference: `Ref ${key}`,
    verse: 16,
    url: `sdachurchapp://bible?day=${key}`,
    share: `Share ${key}`,
  });
  const week: VerseWidgetProps = {
    title: 'Today’s Verse',
    shareLabel: 'Share Verse',
    themeLabel: 'Switch between light and dark',
    translation: 'BSB',
    days: [day('2026-11-2', 'Monday'), day('2026-11-3', 'Tuesday'), day('2026-11-4', 'Wednesday')],
    colors: layoutModule().VERSE_WIDGET_COLORS,
  };
  const withDays = (days: VerseWidgetDay[]) => ({ ...week, days });

  it('is a string for the widget runtime, not a function', () => {
    expect(typeof layout()).toBe('string');
  });

  it('shows the heading, the reference, the numbered verse, and the translation, as YouVersion’s does', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 14) });
    expect(texts(render(week))).toEqual(['Today’s Verse', 'Ref 2026-11-3', '[16]\u00A0Tuesday', 'BSB']);
  });

  it('changes verses at 6 AM, as the app does', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 5, 59) });
    expect(texts(render(week))).toContain('[16]\u00A0Monday');
    jest.setSystemTime(new Date(2026, 10, 3, 6, 0));
    expect(texts(render(week))).toContain('[16]\u00A0Tuesday');
  });

  it('picks the same day as the app for every hour of a year', () => {
    jest.useFakeTimers();
    const misses: string[] = [];
    for (let hour = 0; hour < 366 * 24; hour += 1) {
      const now = new Date(2026, 0, 1, hour, 30);
      const key = getVerseOfTheDayDateKey(now);
      jest.setSystemTime(now);
      const shown = texts(render(withDays([day(key, 'Match'), day('later', 'Other')])));
      if (!shown.includes('[16]\u00A0Match')) misses.push(now.toString());
    }
    expect(misses).toEqual([]);
  });

  it('keeps the last verse it has after the week runs out', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 20, 9) });
    expect(texts(render(week))).toContain('[16]\u00A0Wednesday');
  });

  it('asks the reader to open the app before the app has sent any verses', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    const buildProps = require('@/features/verse-of-the-day/VerseOfTheDayWidget');
    const atBuild = mockCreatedWidgets.find((widget) => widget.layout === layout())?.props;
    expect(buildProps.default.name).toBe('VerseOfTheDay');
    expect(atBuild).toEqual({ colors: week.colors });
    for (const props of [atBuild as Partial<VerseWidgetProps>, undefined, withDays([])]) {
      const tree = render(props);
      expect(texts(tree)).toContain('Open the app to see today’s verse.');
      expect(tree.props.target).toBe('sdachurchapp://');
      // Only the light/dark button: there's nothing to share yet.
      const icons = nodes(tree).filter((n) => n.type === 'Image');
      expect(icons.map((n) => n.props.source.uri)).toEqual(['verse_widget_theme']);
    }
    expect(render(atBuild as Partial<VerseWidgetProps>).props.colors.containerColor).toBe(
      LIGHT_THEME_COLORS.background,
    );
  });

  it('opens the verse when tapped anywhere but its two buttons', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    const tree = render(week);
    expect(tree.type).toBe('Button');
    expect(tree.props.target).toBe('sdachurchapp://bible?day=2026-11-3');
    expect(tree.props.modifiers).toContainEqual({ $type: 'fillMaxSize', args: [] });

    const buttons = nodes(tree).filter((n) => n.type === 'Button');
    expect(buttons.map((n) => n.props.target)).toEqual([
      'sdachurchapp://bible?day=2026-11-3',
      'theme:',
      'share:Share 2026-11-3',
    ]);
    const icon = (button: Node) => nodes(button).filter((n) => n.type === 'Image')[0].props;
    expect([icon(buttons[1]).source, icon(buttons[1]).contentDescription]).toEqual([
      { uri: 'verse_widget_theme' },
      'Switch between light and dark',
    ]);
    expect([icon(buttons[2]).source, icon(buttons[2]).contentDescription]).toEqual([
      { uri: 'verse_widget_share' },
      'Share Verse',
    ]);
    // The two buttons sit side by side, in the same size and color.
    expect(icon(buttons[1]).modifiers).toEqual(icon(buttons[2]).modifiers);
    expect(icon(buttons[1]).tint).toBe(icon(buttons[2]).tint);
  });

  it('draws in the theme’s colors for the phone’s mode', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    const colorsIn = (colorScheme: string) => {
      const tree = render(week, colorScheme);
      const [title, reference, verse, translation] = textNodes(tree);
      const [icon] = nodes(tree).filter((n) => n.type === 'Image');
      return [
        tree.props.colors.containerColor,
        title.props.color,
        reference.props.color,
        icon.props.tint,
        verse.props.color,
        translation.props.color,
      ];
    };
    for (const [mode, theme] of [
      ['light', customLightTheme],
      ['dark', customDarkTheme],
    ] as const) {
      const c = theme.colors;
      expect(colorsIn(mode)).toEqual([
        c.background,
        c.onSurfaceVariant,
        c.primary,
        c.primary,
        c.onSurface,
        c.onSurfaceVariant,
      ]);
    }
  });

  it('draws the same parts in either mode, so the receiver can pair their colors', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    const shape = (node: Node): unknown => [
      node.type,
      [node.props.children].flat().filter((child) => child && typeof child === 'object').map(shape),
    ];
    expect(shape(render(week, 'dark'))).toEqual(shape(render(week, 'light')));
  });

  it('leaves the line limit off only the verse, which the receiver sets in serif and fits', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 9) });
    const unlimited = textNodes(render(week)).filter((n) => n.props.maxLines === undefined);
    expect(unlimited.map((n) => n.props.children)).toEqual(['[16]\u00A0Tuesday']);
  });
});

describe('the Android widget config plugin', () => {
  it('writes the receiver expo-widgets looks for, as the app’s own receiver', () => {
    const kotlin: string = plugin.createProviderKt('org.example.app');
    expect(kotlin).toContain('package org.example.app');
    expect(kotlin).toContain('class VerseOfTheDayProvider : VerseWidgetReceiver()');
  });

  it('opens only app links, in the app itself, from the widget’s receiver', () => {
    expect(receiverKotlin).toContain(`private const val LINK_PREFIX = "${appJson.scheme}:"`);
    expect(receiverKotlin).toContain('.setPackage(context.packageName)');
    expect(receiverKotlin).toContain('"widget-${System.currentTimeMillis()}"');
  });

  it('takes only its own widget’s taps, and hands Android’s broadcasts to Glance', () => {
    const onReceive = receiverKotlin.slice(
      receiverKotlin.indexOf('override fun onReceive'),
      receiverKotlin.indexOf('override fun onDeleted'),
    );
    expect(onReceive).toContain(
      'if (intent.action != INTERACTION_ACTION) return super.onReceive(context, intent)',
    );
    expect(onReceive).toContain('if (intent.getStringExtra(SOURCE_EXTRA) != VERSE_WIDGET_NAME) return');
    // Only the widget's own targets; any other tap never reaches expo-widgets.
    expect(onReceive.match(/super\.onReceive/g)).toHaveLength(1);
    expect(onReceive).not.toMatch(/else ->/);
  });

  it('keeps the widget’s receiver to Android and the app', () => {
    const manifest = (receiver: object[]) => ({
      manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' }, receiver }] },
    });
    const widgetReceiver = { $: { 'android:name': '.VerseOfTheDayProvider', 'android:exported': 'true' } };
    const result = plugin.setReceiverNotExported(manifest([{ $: { 'android:name': '.Other' } }, widgetReceiver]));
    expect(result.manifest.application[0].receiver[1].$['android:exported']).toBe('false');
    expect(result.manifest.application[0].receiver[0].$['android:exported']).toBeUndefined();
    expect(() => plugin.setReceiverNotExported(manifest([]))).toThrow('verse widget receiver');
  });

  it('shares the verse through the phone’s share sheet from the widget’s receiver', () => {
    expect(receiverKotlin).toContain('private const val SHARE_PREFIX = "share:"');
    expect(receiverKotlin).toContain('Intent(Intent.ACTION_SEND).setType("text/plain")');
    expect(read('modules/verse-widget/android/src/main/res/drawable/verse_widget_share.xml')).toContain('<vector');
    // Only the layout's JavaScript names the icons, so the release build's
    // resource shrinker has to be told to keep them.
    expect(read('modules/verse-widget/android/src/main/res/raw/verse_widget_keep.xml')).toContain(
      'tools:keep="@drawable/verse_widget_share,@drawable/verse_widget_theme"',
    );
  });

  it('flips one widget between light and dark from its button, without opening the app', () => {
    expect(read('modules/verse-widget/android/src/main/res/drawable/verse_widget_theme.xml')).toContain('<vector');
    expect(receiverKotlin).toContain('private const val THEME_TARGET = "theme:"');
    expect(receiverKotlin).toContain(
      'target == THEME_TARGET -> flipLook(context, intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0))',
    );
    // The tap only knows its target, so the receiver adds which widget it's on.
    expect(receiverKotlin).toContain('intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)');
    // A second tap undoes the first: a look that matches the phone follows the phone again.
    expect(receiverKotlin).toContain('if (nextDark == phoneDark) remove(key(id)) else putBoolean(key(id), nextDark)');
    // A removed widget's choice goes with it.
    expect(receiverKotlin).toContain('WidgetLooks.forget(context, appWidgetIds)');
  });

  it('takes its colors from the app’s themes, with none of its own in the receiver', () => {
    for (const token of ['background', 'primary', 'onSurface', 'onSurfaceVariant'] as const) {
      expect(customLightTheme.colors[token]).toBe(LIGHT_THEME_COLORS[token]);
      expect(customDarkTheme.colors[token]).toBe(DARK_THEME_COLORS[token]);
    }
    // The receiver pairs the colors of the layout drawn in each mode.
    expect(receiverKotlin).not.toMatch(/0x[0-9A-Fa-f]{6,8}|#[0-9A-Fa-f]{6}/);
    expect(receiverKotlin).toContain('Configuration.UI_MODE_NIGHT_YES');
  });

  it('loads in the Android build, which has no import aliases or app libraries', () => {
    // expo-widgets bundles VerseOfTheDayWidget.tsx with only relative imports
    // resolved; every package and '@/' import is empty there.
    expect(read('constants/ThemeColors.ts')).not.toMatch(/^import /m);
    expect(read('features/verse-of-the-day/VerseOfTheDayWidgetLayout.tsx')).not.toMatch(
      /^import (?!type )[^;]*from '@\//m,
    );
    expect(read('features/verse-of-the-day/VerseOfTheDayWidget.tsx')).not.toMatch(/from '@\//);
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
    const name = plugin.VERSE_WIDGET.name;
    expect(require('@/features/verse-of-the-day/VerseOfTheDayWidgetLayout').VERSE_WIDGET_NAME).toBe(name);
    expect(require('@/features/verse-of-the-day/VerseOfTheDayWidget').default.name).toBe(name);
    expect(receiverKotlin).toContain(`const val VERSE_WIDGET_NAME = "${name}"`);
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

      // expo-widgets adds its exported receiver, then the plugin closes it.
      const { modResults } = await config.mods.android.manifest({
        ...config,
        modResults: { manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' } }] } },
        modRequest: {
          projectRoot: root,
          platformProjectRoot: androidRoot,
          platform: 'android',
          modName: 'manifest',
          introspect: false,
        },
      });
      const [receiver] = modResults.manifest.application[0].receiver;
      expect(receiver.$).toEqual(
        expect.objectContaining({ 'android:name': '.VerseOfTheDayProvider', 'android:exported': 'false' }),
      );
      expect(receiver['intent-filter'][0].action.map((action: { $: object }) => action.$)).toContainEqual({
        'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
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
        widgets: [{ name: 'VerseOfTheDay', initialLayout: './features/verse-of-the-day/VerseOfTheDayWidget.tsx' }],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps the widget’s files where git tracks them', () => {
    // The repository's .gitignore lists the folders it tracks, so a file in a
    // new top-level folder would build locally but be missing everywhere else.
    const files = [
      'features/verse-of-the-day/VerseOfTheDayWidget.tsx',
      'features/verse-of-the-day/VerseOfTheDayWidgetLayout.tsx',
      'constants/ThemeColors.ts',
      'modules/verse-widget/expo-module.config.json',
      'modules/verse-widget/index.ts',
      'modules/verse-widget/android/build.gradle',
      'modules/verse-widget/android/src/main/java/org/nyccsda/versewidget/VerseWidgetModule.kt',
      'modules/verse-widget/android/src/main/java/org/nyccsda/versewidget/VerseWidgetReceiver.kt',
      'modules/verse-widget/android/src/main/res/drawable/verse_widget_share.xml',
      'modules/verse-widget/android/src/main/res/drawable/verse_widget_theme.xml',
      'modules/verse-widget/android/src/main/res/raw/verse_widget_keep.xml',
      'services/VerseOfTheDayWidget.ts',
      'services/VerseOfTheDayWidget.android.ts',
      'services/VerseOfTheDayWidgetData.ts',
      'services/VerseOfTheDayText.ts',
      'plugins/withAndroidVerseWidget.js',
    ];
    for (const file of files) {
      const ignored = spawnSync('git', ['check-ignore', '--quiet', file], { cwd: process.cwd() }).status;
      expect([file, ignored]).toEqual([file, 1]);
    }
  });

  it('keeps expo-widgets, Expo UI, and the widget’s module out of the iPhone app', () => {
    const moduleConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'modules/verse-widget/expo-module.config.json'), 'utf8'),
    );
    expect(moduleConfig.platforms).toEqual(['android']);
    expect(appJson.plugins).toContain('./plugins/withAndroidVerseWidget');
    expect(appJson.plugins.flat()).not.toContain('expo-widgets');
    expect(packageJson.expo.autolinking.ios.exclude).toEqual(
      expect.arrayContaining(['expo-widgets', '@expo/ui']),
    );
  });
});
