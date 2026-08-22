import {
  AppIcon,
  type MaterialCommunityIconName,
} from '@/components/AppIcon';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

export interface SourceNoticeItem {
  icon: MaterialCommunityIconName;
  text: string;
}

interface SourceNoticePanelProps {
  items: readonly SourceNoticeItem[];
  legalLabel: string;
  onLegalPress: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
}

export function SourceNoticePanel({
  items,
  legalLabel,
  onLegalPress,
  style,
  title,
}: SourceNoticePanelProps) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const styles = useMemo(() => createStyles(textScale), [textScale]);

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.outlineVariant,
        },
        style,
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
      <View style={styles.rows}>
        {items.map((item, index) => (
          <View key={`${item.icon}-${index}`} style={styles.row}>
            <View
              pointerEvents="none"
              style={[
                styles.icon,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <AppIcon
                color={theme.colors.tertiary}
                name={item.icon}
                size={20}
              />
            </View>
            <Text
              style={[
                styles.description,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {item.text}
            </Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        accessibilityLabel={legalLabel}
        accessibilityRole="link"
        onPress={onLegalPress}
        style={[
          styles.legalLink,
          { borderTopColor: theme.colors.outlineVariant },
        ]}
      >
        <Text style={[styles.legalLinkText, { color: theme.colors.primary }]}>
          {legalLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
) =>
  StyleSheet.create({
    panel: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
    },
    title: {
      fontSize: scaleTypographyMetric(17, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(24, textScale),
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    rows: {
      gap: 14,
      padding: 16,
    },
    row: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 12,
    },
    icon: {
      alignItems: 'center',
      borderRadius: 18,
      flexShrink: 0,
      height: 36,
      justifyContent: 'center',
      width: 36,
    },
    description: {
      flex: 1,
      fontSize: scaleTypographyMetric(14, textScale),
      lineHeight: scaleTypographyMetric(21, textScale),
      minWidth: 0,
    },
    legalLink: {
      alignItems: 'center',
      alignSelf: 'stretch',
      borderTopWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 16,
    },
    legalLinkText: {
      fontSize: scaleTypographyMetric(13, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(19, textScale),
      textAlign: 'center',
    },
  });
