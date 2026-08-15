import { createDocumentStyles } from '@/styles/DocumentStyles';
import { getBibleReaderUiTextScale } from '@/constants/AppPreferences';
import { getGlobalHeaderHeightForScale } from '@/hooks/useGlobalHeaderHeight';
import { getBottomTabContentHeight } from '@/constants/Layout';
import { createNavigationStyles } from '@/styles/NavigationStyles';
import {
  createReaderStyles,
  getBulletinVerseScrollOffset,
  getBibleDockLayout,
  getBibleDockViewportLayout,
} from '@/styles/ReaderStyles';
import { StyleSheet } from 'react-native';

describe('Bible reader text scaling', () => {
  it('positions bulletin-linked verses slightly above the viewport midpoint', () => {
    expect(getBulletinVerseScrollOffset(700, 800)).toBe(420);
    expect(700 - getBulletinVerseScrollOffset(700, 800)).toBe(280);
  });

  it('does not create a negative offset for verses near the chapter start', () => {
    expect(getBulletinVerseScrollOffset(100, 800)).toBe(0);
  });

  it('applies the full 200% app preference to scripture and document text', () => {
    const reader = createReaderStyles(2);
    const document = createDocumentStyles(2);

    expect(StyleSheet.flatten(reader.verseText)).toMatchObject({
      fontSize: 38,
      lineHeight: 48.64,
    });
    expect(StyleSheet.flatten(reader.detailText)).toMatchObject({
      fontSize: 32,
      lineHeight: 48,
    });
    expect(StyleSheet.flatten(document.description)).toMatchObject({
      fontSize: 32,
      lineHeight: 44,
    });
    expect(StyleSheet.flatten(reader.pillText)).toMatchObject({
      fontSize: 19.5,
      lineHeight: 26,
    });
  });

  it('uses tighter scripture leading and wider reading space at 200%', () => {
    const ordinary = createReaderStyles(1);
    const enlarged = createReaderStyles(2);

    expect(StyleSheet.flatten(ordinary.scrollContent).paddingHorizontal).toBe(20);
    expect(StyleSheet.flatten(enlarged.scrollContent).paddingHorizontal).toBe(8);
    expect(StyleSheet.flatten(enlarged.verseContainer)).toMatchObject({
      fontSize: 36,
      lineHeight: 46.08,
    });
    expect(StyleSheet.flatten(enlarged.selahMarker)).toMatchObject({
      fontSize: 36,
      lineHeight: 46.08,
    });
    expect(StyleSheet.flatten(enlarged.pill).paddingHorizontal).toBe(8);
  });

  it('keeps Bible controls compact while honoring OS font scaling', () => {
    const appOnlyScale = getBibleReaderUiTextScale(2);
    const withTwoHundredPercentOsText = appOnlyScale * 2;
    const appOnly = getBibleDockLayout(390, appOnlyScale);
    const withOsText = getBibleDockLayout(390, withTwoHundredPercentOsText);

    expect(appOnlyScale).toBe(1.3);
    expect(appOnly.stackControls).toBe(false);
    expect(withOsText.stackControls).toBe(true);
    expect(withOsText.controlHeight).toBeGreaterThan(
      appOnly.controlHeight,
    );
    expect(withOsText.dockHeight).toBeGreaterThan(
      appOnly.dockHeight,
    );
    expect(withOsText.audioDockHeight).toBeGreaterThan(
      appOnly.audioDockHeight,
    );
  });

  it('stacks reader controls when space is narrow or text is enlarged', () => {
    expect(getBibleDockLayout(320, 1).stackControls).toBe(false);
    expect(getBibleDockLayout(390, 1).stackControls).toBe(false);
    expect(getBibleDockLayout(900, 1).stackControls).toBe(false);
    expect(getBibleDockLayout(320, 2).stackControls).toBe(true);
    expect(getBibleDockLayout(320, 3).stackControls).toBe(true);
    expect(getBibleDockLayout(900, 1.5).stackControls).toBe(true);
  });

  it('reserves navigation content space for both font scales and safe areas', () => {
    const compact = createNavigationStyles(1, { bottomInset: 0, fontScale: 1 });
    const enlarged = createNavigationStyles(2, {
      bottomInset: 24,
      fontScale: 2,
    });

    expect(StyleSheet.flatten(enlarged.contentContainer).paddingBottom).toBeGreaterThan(
      StyleSheet.flatten(compact.contentContainer).paddingBottom as number,
    );
    expect(StyleSheet.flatten(enlarged.subheader).fontSize).toBe(32);
  });

  it('keeps app-scaled Bible controls on one header row', () => {
    const appOnlyScale = getBibleReaderUiTextScale(2);
    const ordinaryHeader = getGlobalHeaderHeightForScale(appOnlyScale);
    const bibleHeader = getGlobalHeaderHeightForScale(appOnlyScale, false);
    const withOsText = getGlobalHeaderHeightForScale(appOnlyScale * 2, true);

    expect(bibleHeader).toBe(ordinaryHeader);
    expect(withOsText).toBeGreaterThan(bibleHeader);
  });

  it.each([
    { effectiveScale: 3, viewportHeight: 568 },
    { effectiveScale: 4, viewportHeight: 800 },
  ])(
    'keeps the full audio and selection dock reachable at 320x$viewportHeight and $effectiveScale× effective text',
    ({ effectiveScale, viewportHeight }) => {
      const dock = getBibleDockLayout(320, effectiveScale);
      const contentHeight =
        dock.dockHeight + dock.audioDockHeight + dock.selectionBarHeight;
      const headerHeight = getGlobalHeaderHeightForScale(effectiveScale, true);
      const viewport = getBibleDockViewportLayout({
        bottomInset: 0,
        bottomTabHeight: getBottomTabContentHeight(effectiveScale),
        contentHeight,
        headerHeight,
        viewportHeight,
      });

      expect(contentHeight).toBeGreaterThan(viewportHeight);
      expect(viewport.maxVisibleHeight).toBeLessThan(viewportHeight);
      expect(viewport.hiddenHeight).toBe(viewport.maxVisibleHeight);
      expect(viewport.visibleHeight).toBe(viewport.maxVisibleHeight);
      expect(viewport.hiddenNeedsScroll).toBe(true);
      expect(viewport.visibleNeedsScroll).toBe(true);
      expect(viewport.visibleHeight + headerHeight).toBeLessThanOrEqual(
        viewportHeight,
      );
    },
  );

  it('preserves the natural dock height at 100% when scrolling is unnecessary', () => {
    const dock = getBibleDockLayout(390, 1);
    const bottomTabHeight = getBottomTabContentHeight(1);
    const viewport = getBibleDockViewportLayout({
      bottomInset: 0,
      bottomTabHeight,
      contentHeight: dock.dockHeight,
      headerHeight: getGlobalHeaderHeightForScale(1, true),
      viewportHeight: 800,
    });

    expect(viewport.hiddenHeight).toBe(dock.dockHeight);
    expect(viewport.visibleHeight).toBe(dock.dockHeight + bottomTabHeight);
    expect(viewport.hiddenNeedsScroll).toBe(false);
    expect(viewport.visibleNeedsScroll).toBe(false);
  });

  it('keeps full audio controls and the verse selector visible when chrome hides', () => {
    const effectiveScale = getBibleReaderUiTextScale(1);
    const dock = getBibleDockLayout(390, effectiveScale);
    const fullContentHeight = dock.dockHeight + dock.audioDockHeight;
    const viewport = getBibleDockViewportLayout({
      bottomInset: 0,
      bottomTabHeight: getBottomTabContentHeight(effectiveScale),
      contentHeight: fullContentHeight,
      headerHeight: getGlobalHeaderHeightForScale(effectiveScale, true),
      hiddenContentHeight: fullContentHeight,
      viewportHeight: 800,
    });

    expect(viewport.hiddenHeight).toBe(fullContentHeight);
    expect(viewport.visibleHeight).toBeGreaterThan(viewport.hiddenHeight);
    expect(viewport.visibleHeight - viewport.hiddenHeight).toBe(
      getBottomTabContentHeight(effectiveScale),
    );
  });

  it('places the audio dock breathing room above its controls', () => {
    const reader = createReaderStyles(2);
    const audioDock = StyleSheet.flatten(reader.audioDock);
    const audioSettings = StyleSheet.flatten(reader.audioSettingsContent);

    expect(audioDock.paddingTop).toBe(8);
    expect(audioDock).not.toHaveProperty('paddingBottom');
    expect(audioSettings).toMatchObject({
      borderRadius: 24,
      marginTop: 'auto',
      maxHeight: '82%',
    });
  });
});
