import { useTextSize } from '@/constants/TextSizeContext';
import { useWindowDimensions } from 'react-native';

/**
 * The text size the content column follows on a wide screen (#324): the
 * app's, as drawn, times the device's. Members enlarge text either way, in the
 * app or in the iPad's own settings, and the column widens with both.
 */
export function useContentColumnScale() {
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  return textScale * (Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1);
}
