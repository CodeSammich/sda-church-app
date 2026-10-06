import { HymnalScreen } from '@/features/hymnal/HymnalScreen';

/**
 * The hymnal page with the 707 New Simplified Notation edition picked. Older
 * links open this route.
 */
export default function Chinese707NewSimplifiedHymnalScreen() {
  return <HymnalScreen defaultHymnalId="chinese-hymnal-707-v1" />;
}
