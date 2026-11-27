import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { widestWordWidth } from '@/components/WrappingActionButton';
import { DESIGN_TOKENS, getContentWidth } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useContentColumnScale } from '@/hooks/useContentColumnScale';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from 'react-native-paper';

export type Pillar = Readonly<{ title: string; icon: MaterialCommunityIconName }>;

// Paper's labelSmall, which the labels use: 11 points at 100% text.
const LABEL_FONT_SIZE = 11;
const GAP = 8;
// Two points spare, since a word exactly as wide as its line broke on Android.
const SPARE = 2;

/**
 * A label that may break after a hyphen, as in Bible-Centered. Android didn't
 * break there at 125% on a phone, and broke the word instead, as
 * "Bible-Cente" / "red" (#819); a zero-width space marks the place.
 */
export const breakAfterHyphens = (label: string) => label.replace(/-(?=\p{L})/gu, '-\u200b');

/**
 * Whether the pillars fit side by side, a third of `rowWidth` each, with every
 * word of every label whole on a line at `textScale` (the app's size times the
 * phone's). A line may break between words and after a hyphen, so the widest
 * word counts: Centered, not Bible-Centered. Where one doesn't fit, as at 200%
 * on a phone, the pillars take a row each instead, as Home's verse buttons do
 * (#385, #797).
 */
export const pillarsFitSideBySide = (titles: readonly string[], rowWidth: number, textScale: number) => {
  const width = (rowWidth - GAP * (titles.length - 1)) / titles.length;
  const em = LABEL_FONT_SIZE * Math.max(1, textScale);
  return titles.every((title) =>
    breakAfterHyphens(title)
      .split(/[\s\u200b]+/u)
      .every((word) => widestWordWidth(word, em) + SPARE <= width),
  );
};

/**
 * A few of the church's values, each an icon over a short label, such as About
 * Denomination's Bible-Centered, Faith & Love, and Community. They're plain
 * content on the page, not buttons, so they have no card or border, which made
 * them look tappable when a tap did nothing (#819).
 */
export function PillarList({ pillars }: Readonly<{ pillars: readonly Pillar[] }>) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const columnScale = useContentColumnScale();
  // The page's sections sit 16 points in from the content column's sides.
  const rowWidth = getContentWidth(windowWidth, columnScale) - 2 * 16;
  const sideBySide = pillarsFitSideBySide(
    pillars.map((pillar) => pillar.title),
    rowWidth,
    Math.max(1, textScale * fontScale),
  );

  return (
    <View style={[styles.list, sideBySide ? styles.row : styles.column]} testID="pillar-list">
      {pillars.map((pillar) => (
        <View
          accessible
          accessibilityLabel={pillar.title}
          key={pillar.title}
          style={sideBySide ? styles.pillarInRow : styles.pillarOnItsOwn}
        >
          <AppIcon
            color={theme.colors.tertiary}
            name={pillar.icon}
            size={DESIGN_TOKENS.ICON_SIZE_FEATURED}
          />
          <Text
            variant="labelSmall"
            style={[
              styles.label,
              sideBySide ? styles.labelInRow : styles.labelOnItsOwn,
              { color: theme.colors.onSurface },
            ]}
          >
            {breakAfterHyphens(pillar.title)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: GAP,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
  },
  column: {
    flexDirection: 'column',
  },
  pillarInRow: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  pillarOnItsOwn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontWeight: '600',
  },
  labelInRow: {
    marginTop: 4,
    textAlign: 'center',
  },
  labelOnItsOwn: {
    flexShrink: 1,
  },
});
