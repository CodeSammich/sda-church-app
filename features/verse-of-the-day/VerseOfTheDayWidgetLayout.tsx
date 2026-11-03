import { Box, Button, Column, Image, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  size,
} from '@expo/ui/jetpack-compose/modifiers';

import type { VerseWidgetColors, VerseWidgetProps } from '@/services/VerseOfTheDayWidgetData';

// Relative, not '@/': the Android build reads this file without the app's
// import aliases (VerseOfTheDayWidget.tsx).
import { DARK_THEME_COLORS, LIGHT_THEME_COLORS } from '../../constants/ThemeColors';

/** The widget's name, which app.json's plugin and the app's receiver use too. */
export const VERSE_WIDGET_NAME = 'VerseOfTheDay';

/** The widget's colors in light and dark mode: the app's own. */
export const VERSE_WIDGET_COLORS: VerseWidgetProps['colors'] = {
  light: LIGHT_THEME_COLORS,
  dark: DARK_THEME_COLORS,
};

/**
 * The Android home screen widget's layout (#235), styled after YouVersion's
 * Verse of the Day widget: a small heading, the reference under it, a share
 * button, the verse with its number, and the translation at the bottom, in the
 * app's language. A tap anywhere else opens the verse in the Bible reader.
 *
 * The 'widget' directive turns this function into a string, which Android
 * runs in its own small JavaScript runtime each time it redraws the widget.
 * So the function can't use imports, hooks, or anything outside itself, only
 * its props and the phone's light or dark mode, and its comments stay outside
 * it.
 *
 * - Day: before 6 AM it's still the previous day, as in
 *   services/VerseOfTheDay.ts. test/verse-of-the-day-widget.test.ts checks
 *   the two agree. Past the last day the app sent, it keeps that verse.
 * - Before the app first runs there are no verses, so it asks the reader to
 *   open the app. The build gives it the colors (VerseOfTheDayWidget.tsx).
 * - Colors: the theme's background, primary, ink, and muted ink, in the
 *   phone's mode. The app's widget receiver (modules/verse-widget) draws the
 *   layout in both modes, so the widget follows the phone between them.
 * - The verse is the one text without maxLines. The receiver sets it in the
 *   phone's serif font and cuts it to the whole lines the widget's size fits.
 * - Links go in the buttons' `target`, which ButtonProps leaves out but
 *   expo-widgets passes on to the app's receiver: an app link opens the
 *   verse, and `share:` and the text open the share sheet.
 */
export const VerseOfTheDayWidgetLayout = (
  props: Partial<VerseWidgetProps>,
  environment: { colorScheme?: string },
) => {
  'widget';
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const days = (props && props.days) || [];
  const verse = days.find((day) => day.day === today) || days[days.length - 1];

  const palette = props && props.colors;
  const dark = environment && environment.colorScheme === 'dark';
  const colors: Partial<VerseWidgetColors> = (palette && (dark ? palette.dark : palette.light)) || {};
  const open = { target: verse ? verse.url : 'sdachurchapp://' } as object;

  return (
    <Button
      {...open}
      colors={{ containerColor: colors.background, contentColor: colors.onSurface }}
      modifiers={[fillMaxSize(), cornerRadius(24)]}
    >
      <Column modifiers={[fillMaxSize(), paddingAll(16)]}>
        <Box contentAlignment="topEnd" modifiers={[fillMaxWidth()]}>
          <Column modifiers={[fillMaxWidth(), padding(0, 0, 36, 0)]}>
            <Text color={colors.onSurfaceVariant} maxLines={1} style={{ fontSize: 15 }}>
              {(props && props.title) || 'Today’s Verse'}
            </Text>
            {verse ? (
              <Text color={colors.primary} maxLines={1} style={{ fontSize: 20, fontWeight: 'bold' }}>
                {verse.reference}
              </Text>
            ) : null}
          </Column>
          {verse ? (
            <Button {...({ target: `share:${verse.share}` } as object)}>
              <Image
                source={{ uri: 'verse_widget_share' }}
                tint={colors.primary}
                contentDescription={props.shareLabel}
                modifiers={[size(24, 24)]}
              />
            </Button>
          ) : null}
        </Box>
        <Spacer modifiers={[height(16)]} />
        <Text color={colors.onSurface} style={{ fontSize: 18 }}>
          {verse ? `[${verse.verse}]\u00A0${verse.text}` : 'Open the app to see today’s verse.'}
        </Text>
        {verse ? <Spacer modifiers={[height(8)]} /> : null}
        {verse ? (
          <Text color={colors.onSurfaceVariant} maxLines={1} style={{ fontSize: 12 }}>
            {props.translation}
          </Text>
        ) : null}
      </Column>
    </Button>
  );
};
