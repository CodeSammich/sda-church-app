import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import {
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { getBiblePinyinLines } from '@/services/BiblePinyinService';

interface PinyinRubyTextProps {
  bold?: boolean;
  number?: number;
  numberColor: string;
  pinyinColor: string;
  rightAlignedLines?: boolean[];
  text: string;
  textColor: string;
  textScale: TextScale;
  variant?: 'primary' | 'supporting';
}

/**
 * Character-level ruby layout for React Native and web. Each pinyin syllable
 * shares a non-breaking flex item with its Han character, so wrapping can
 * never separate the pronunciation from the character it describes.
 */
export function PinyinRubyText({
  bold = false,
  number,
  numberColor,
  pinyinColor,
  rightAlignedLines = [],
  text,
  textColor,
  textScale,
  variant = 'primary',
}: PinyinRubyTextProps) {
  const lines = useMemo(() => getBiblePinyinLines(text), [text]);
  const styles = useMemo(
    () => createStyles(textScale, variant === 'supporting'),
    [textScale, variant],
  );

  return (
    <View
      accessible
      accessibilityLabel={number === undefined ? text : `${number} ${text}`}
      style={styles.container}
    >
      {lines.map((line, lineIndex) => (
        <View
          key={lineIndex}
          style={[
            styles.line,
            rightAlignedLines[lineIndex]
              ? styles.rightAlignedLine
              : styles.hangingLine,
          ]}
        >
          {lineIndex === 0 && number !== undefined && (
            <View style={styles.numberToken}>
              <Text aria-hidden style={styles.blankPinyin}>
                {'\u00a0'}
              </Text>
              <Text style={[styles.number, { color: numberColor }]}>{number}</Text>
            </View>
          )}
          {line.map((token, tokenIndex) => (
            <View
              key={`${lineIndex}-${tokenIndex}`}
              style={[
                styles.group,
                tokenIndex === 0 &&
                  !rightAlignedLines[lineIndex] &&
                  styles.hangingLineFirstGroup,
              ]}
            >
              {token.prefix && (
                <Text aria-hidden style={[styles.character, { color: textColor }]}>
                  {token.prefix}
                </Text>
              )}
              {token.pinyin ? (
                <View style={styles.token}>
                  <Text
                    aria-hidden
                    style={[styles.pinyin, { color: pinyinColor }]}
                  >
                    {token.pinyin}
                  </Text>
                  <Text
                    aria-hidden
                    style={[
                      styles.character,
                      { color: textColor },
                      bold && styles.bold,
                    ]}
                  >
                    {token.text}
                  </Text>
                </View>
              ) : (
              <Text
                aria-hidden
                style={[
                  styles.character,
                  { color: textColor },
                  bold && styles.bold,
                ]}
              >
                {token.text === ' ' ? '\u00a0' : token.text}
              </Text>
              )}
              {token.suffix && (
                <Text aria-hidden style={[styles.character, { color: textColor }]}>
                  {token.suffix}
                </Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const createStyles = (textScale: TextScale, supporting: boolean) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginBottom: supporting ? 14 : 12,
      gap: 3,
    },
    line: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      rowGap: 3,
    },
    rightAlignedLine: {
      justifyContent: 'flex-end',
    },
    hangingLine: {
      paddingLeft: scaleTypographyMetric(8, textScale),
    },
    hangingLineFirstGroup: {
      marginLeft: -scaleTypographyMetric(8, textScale),
    },
    group: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginRight: 1,
    },
    token: {
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    numberToken: {
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginRight: 5,
    },
    pinyin: {
      fontSize: scaleTypographyMetric(supporting ? 8 : 9, textScale),
      lineHeight: scaleTypographyMetric(supporting ? 11 : 12, textScale),
      fontWeight: '600',
    },
    blankPinyin: {
      opacity: 0,
    },
    character: {
      fontSize: scaleTypographyMetric(supporting ? 16 : 18, textScale),
      lineHeight: scaleTypographyMetric(supporting ? 22 : 24, textScale),
    },
    number: {
      fontSize: scaleTypographyMetric(14, textScale),
      lineHeight: scaleTypographyMetric(24, textScale),
      fontWeight: '600',
    },
    bold: {
      fontWeight: 'bold',
    },
  });
