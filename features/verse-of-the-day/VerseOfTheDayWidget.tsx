import { Button, Column, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  cornerRadius,
  fillMaxSize,
  height,
  paddingAll,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import type { VerseWidgetProps } from '@/services/VerseOfTheDayWidgetData';

/**
 * The Android home screen widget (#235): the verse of the day and its
 * reference, in the app's language. A tap opens the verse in the Bible reader.
 *
 * The 'widget' directive turns this function into a string, which Android
 * runs in its own small JavaScript runtime each time it redraws the widget.
 * So the function can't use imports, hooks, or anything outside itself, only
 * its props, and its comments stay outside it.
 *
 * - Day: before 6 AM it's still the previous day, as in
 *   services/VerseOfTheDay.ts. test/verse-of-the-day-widget.test.ts checks
 *   the two agree. Past the last day the app sent, it keeps that verse.
 * - Before the app first runs there are no props, so it asks the reader to
 *   open the app.
 * - Colors: the app icon's blue (app.json) with light text, the same in light
 *   and dark mode. Android draws a widget's colors once and doesn't redraw it
 *   when the phone switches modes, so colors that followed the mode would be
 *   wrong for up to an hour after each switch.
 * - Long verses get smaller type, so they fit the widget's first size. A
 *   Chinese character is about twice as wide as a letter.
 * - The link goes in the button's `target`, which ButtonProps leaves out but
 *   expo-widgets passes on to the app's widget receiver, which opens it
 *   (plugins/withAndroidVerseWidget.js).
 */
const VerseOfTheDayWidget = (props: Partial<VerseWidgetProps>) => {
  'widget';
  const now = new Date();
  if (now.getHours() < 6) now.setDate(now.getDate() - 1);
  const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const days = (props && props.days) || [];
  const verse = days.find((day) => day.day === today) || days[days.length - 1];

  const background = '#00405C';
  const accent = '#EBCD78';
  const ink = '#FFFFFF';
  const muted = '#BFD3DC';

  let width = 0;
  for (const character of verse ? verse.text : '') {
    width += character.charCodeAt(0) > 0x2e7f ? 2 : 1;
  }
  const fontSize = width > 220 ? 13 : width > 150 ? 14 : 16;
  const open = { target: verse ? verse.url : 'sdachurchapp://' } as object;

  return (
    <Button
      {...open}
      colors={{ containerColor: background, contentColor: ink }}
      modifiers={[fillMaxSize(), cornerRadius(24)]}
    >
      <Column verticalArrangement="center" modifiers={[fillMaxSize(), paddingAll(16)]}>
        <Text color={accent} maxLines={1} style={{ fontSize: 13, fontWeight: 'bold' }}>
          {(props && props.title) || 'Today’s Verse'}
        </Text>
        <Spacer modifiers={[height(6)]} />
        <Text color={ink} style={{ fontSize }}>
          {verse ? verse.text : 'Open the app to see today’s verse.'}
        </Text>
        <Spacer modifiers={[height(6)]} />
        <Text color={muted} maxLines={1} style={{ fontSize: 13, fontWeight: 'bold' }}>
          {verse ? `— ${verse.reference}` : ''}
        </Text>
      </Column>
    </Button>
  );
};

export default createWidget('VerseOfTheDay', VerseOfTheDayWidget);
