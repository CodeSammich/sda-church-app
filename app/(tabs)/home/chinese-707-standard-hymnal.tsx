import { HymnalScreen } from '@/features/hymnal/HymnalScreen';

/**
 * The hymnal page with the 707 Standard Edition picked. Older links open this
 * route.
 */
export default function Chinese707StandardHymnalScreen() {
  return <HymnalScreen defaultHymnalId="chinese-hymnal-707-v3" />;
}
