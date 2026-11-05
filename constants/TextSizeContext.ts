import { createContext, useContext } from 'react';
import { DEFAULT_TEXT_SCALE, type TextScale } from './AppPreferences';

interface TextSizeContextValue {
  setTextScale: (scale: TextScale) => Promise<void>;
  /**
   * The size to draw with: the chosen size, reduced only when the phone's own
   * text size is so large that together they'd pass MAX_COMBINED_TEXT_SCALE.
   */
  textScale: TextScale;
  /**
   * The size the reader chose, for the Text size setting itself. Where it's
   * missing, as in tests, use textScale.
   */
  preferredTextScale?: TextScale;
  /**
   * The size this device starts at, which Reset returns to: 150% on a tablet,
   * 125% elsewhere (getDefaultTextScale). Where it's missing, as in tests, use
   * DEFAULT_TEXT_SCALE.
   */
  defaultTextScale?: TextScale;
}

export const TextSizeContext = createContext<TextSizeContextValue>({
  setTextScale: async () => {},
  textScale: DEFAULT_TEXT_SCALE,
  preferredTextScale: DEFAULT_TEXT_SCALE,
  defaultTextScale: DEFAULT_TEXT_SCALE,
});

export const useTextSize = () => useContext(TextSizeContext);
