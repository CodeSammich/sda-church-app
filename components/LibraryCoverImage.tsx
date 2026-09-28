import { AppIcon } from '@/components/AppIcon';
import { useAppTheme } from '@/constants/Themes';
import { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

type LibraryCoverImageProps = Readonly<{
  blurRadius?: number;
  coverSource?: ImageSourcePropType;
  /** Remote covers to try in order before the bundled `coverSource`. */
  coverUrls?: readonly string[];
}>;

/** A book cover that fills its frame, or a book icon when there is none. */
export function LibraryCoverImage({ blurRadius, coverSource, coverUrls }: LibraryCoverImageProps) {
  const theme = useAppTheme();
  const [remoteCoverIndex, setRemoteCoverIndex] = useState(0);
  const remoteCoverKey = coverUrls?.join('\n') || '';
  const remoteCoverUrl = coverUrls?.[remoteCoverIndex];
  const displayedCoverSource = remoteCoverUrl
    ? { uri: remoteCoverUrl }
    : coverSource;

  useEffect(() => setRemoteCoverIndex(0), [remoteCoverKey]);

  return displayedCoverSource ? (
    <Image
      accessible={false}
      blurRadius={blurRadius}
      onError={remoteCoverUrl
        ? () => setRemoteCoverIndex((index) => index + 1)
        : undefined}
      resizeMode="cover"
      source={displayedCoverSource}
      style={styles.cover}
    />
  ) : (
    <View style={styles.placeholderCover}>
      <AppIcon name="book-open-page-variant" size={44} color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: '100%',
    width: '100%',
  },
  placeholderCover: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
