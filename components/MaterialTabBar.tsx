import { getSelectedTabTint, getTabItems, TABLET_TAB_BAR_MIN_WIDTH, type TabBarProps } from '@/components/TabBarItems';
import type { AppTheme } from '@/constants/Themes';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

/** The colour of Android's tab bar, and of the Bible's dock docked above it. */
export const getMaterialBarColor = (theme: AppTheme) => theme.colors.surface;

/**
 * The tab bar on Android (#589), Material 3's navigation bar: full width along
 * the bottom, in the app's warm card colour, with a pill behind the selected
 * tab's icon. On a tablet the label sits beside the icon, inside the pill, as
 * Material's bar does in a medium-width window, and the tabs stay within the
 * content column. The Bible's dock docks flush above it in the same colour.
 * The icons and labels are the app's own, so they follow its text size.
 */
export function MaterialTabBar({
  bottomInset,
  sideInset,
  theme,
  windowWidth,
  ...props
}: TabBarProps & { bottomInset: number; sideInset: number; theme: AppTheme; windowWidth: number }) {
  const beside = windowWidth >= TABLET_TAB_BAR_MIN_WIDTH;
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: getMaterialBarColor(theme), paddingBottom: bottomInset, paddingHorizontal: sideInset },
      ]}
    >
      {getTabItems(props).map((item) => {
        const tint = item.focused ? { backgroundColor: getSelectedTabTint(theme) } : null;
        return (
          <Pressable
            key={item.key}
            accessibilityLabel={item.accessibilityLabel}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.focused }}
            onLongPress={item.onLongPress}
            onPress={item.onPress}
            style={styles.item}
            testID={item.testID}
          >
            {beside ? (
              <View style={[styles.besidePill, tint]}>
                {item.icon(24)}
                {item.label}
              </View>
            ) : (
              <>
                <View style={[styles.iconPill, tint]}>{item.icon(24)}</View>
                {item.label}
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 6,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  // Material's active indicator: a 56 × 32 pill behind the icon.
  iconPill: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    marginBottom: 2,
    minHeight: 32,
    minWidth: 56,
    paddingHorizontal: 16,
  },
  besidePill: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 16,
  },
});
