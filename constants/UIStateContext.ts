import { createContext } from 'react';
import { Animated } from 'react-native';

/**
 * Global UI state shared by the header and the screens under it.
 *
 * - `menuAnim` shows and hides the surrounding app chrome (reader mode).
 * - `bibleControlsStacked` says whether the Bible reader's header put the
 *   translation button on its own row. The header decides by measuring, and
 *   the reader reads it to pad its text below the taller header.
 */
export const UIStateContext = createContext<{
  menuAnim: Animated.Value;
  setMenuVisible: (visible: boolean) => void;
  bibleControlsStacked: boolean;
  setBibleControlsStacked: (stacked: boolean) => void;
}>({
  menuAnim: new Animated.Value(1),
  setMenuVisible: () => {},
  bibleControlsStacked: false,
  setBibleControlsStacked: () => {},
});
