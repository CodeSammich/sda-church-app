import { createContext, createElement, useContext } from 'react';
import { View } from 'react-native';

export const BottomTabHeightContext = createContext<number | null>(null);

export const useBottomTabHeight = () => useContext(BottomTabHeightContext);

/**
 * How far a page's content runs under a floating tab bar: the capsule's
 * (CapsuleTabBar) height on iPhone, iPad and the web, where pages run to the
 * bottom edge; 0 under Android's bar, which pages stop above.
 */
export const TabBarClearanceContext = createContext(0);

export const useTabBarClearance = () => useContext(TabBarClearanceContext);

/**
 * Room at the end of a tab's scrolling page, so its last lines can scroll clear
 * of a floating tab bar. Nothing where pages stop above the bar.
 */
export function TabBarSpacer() {
  const clearance = useTabBarClearance();
  return clearance > 0 ? createElement(View, { style: { height: clearance } }) : null;
}
