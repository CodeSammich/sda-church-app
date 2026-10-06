import { HymnalScreen } from '@/features/hymnal/HymnalScreen';

/**
 * The hymnal page with the SDA Hymnal (1985) picked. The bulletin, the hymn
 * lookup, and older links open this route.
 */
export default function EnglishHymnalScreen() {
  return <HymnalScreen defaultHymnalId="sdah-1985-en" />;
}
