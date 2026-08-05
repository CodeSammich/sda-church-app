import { createContext, useContext } from 'react';
import { DEFAULT_TEXT_SCALE, type TextScale } from './AppPreferences';

interface TextSizeContextValue {
  setTextScale: (scale: TextScale) => Promise<void>;
  textScale: TextScale;
}

export const TextSizeContext = createContext<TextSizeContextValue>({
  setTextScale: async () => {},
  textScale: DEFAULT_TEXT_SCALE,
});

export const useTextSize = () => useContext(TextSizeContext);
