import { getGlobalHeaderContentHeight } from '@/constants/Layout';
import { getBibleReaderUiTextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const getGlobalHeaderHeightForScale = (
  effectiveTextScale: number,
  stackBibleControls = false,
  measuredContentHeight = 0,
) => {
  const safeScale = Number.isFinite(effectiveTextScale)
    ? Math.max(1, effectiveTextScale)
    : 1;
  const baseHeight = getGlobalHeaderContentHeight(safeScale);

  const compactControlHeight = Math.ceil(44 + (safeScale - 1) * 24);
  const wrappedControlHeight = Math.max(
    compactControlHeight,
    Math.ceil(40 * safeScale + 12),
  );
  const controlHeight = stackBibleControls
    ? wrappedControlHeight + compactControlHeight + 24
    : 0;
  const safeMeasuredContentHeight = Number.isFinite(measuredContentHeight)
    ? Math.max(0, measuredContentHeight)
    : 0;

  return Math.max(
    baseHeight,
    controlHeight,
    Math.ceil(
      safeMeasuredContentHeight + (safeMeasuredContentHeight > 0 ? 16 : 0),
    ),
  );
};

export const useGlobalHeaderHeight = (stackBibleControls = false) => {
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    insets.top +
    getGlobalHeaderHeightForScale(
      fontScale *
        (stackBibleControls ? getBibleReaderUiTextScale(textScale) : textScale),
      stackBibleControls &&
        fontScale * getBibleReaderUiTextScale(textScale) >= 1.5,
    )
  );
};
