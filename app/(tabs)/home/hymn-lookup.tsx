import { isHymnalBookId } from '@/features/hymnal/Hymnals';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * The English–Chinese hymn lookup was folded into the hymnal page: its search
 * finds a number in every hymnal, and each 1985 or 505 hymn shows the other's
 * number. Saved routes and older links to the lookup land there, on the hymn
 * they had picked.
 */
export default function HymnLookupRedirect() {
  const { sourceHymnalId, sourceNumber } = useLocalSearchParams<{
    sourceHymnalId?: string;
    sourceNumber?: string;
  }>();

  return (
    <Redirect
      href={
        (isHymnalBookId(sourceHymnalId) && sourceNumber && /^\w+$/.test(sourceNumber)
          ? `/home/hymnal-selection?hymnal=${sourceHymnalId}&hymnNum=${sourceNumber}`
          : '/home/hymnal-selection') as any
      }
    />
  );
}
