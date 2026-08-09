import type { HymnalId } from './HymnalNumberMappings';

/**
 * The hymnals treated as primary by this church's bilingual bulletin.
 *
 * These IDs are the final selection point, not a complete hymnal plugin system.
 * A fork must first add the hymnal's mapping metadata, searchable catalog,
 * BulletinHymnalService adapter, and reader route. See the bulletin hymn
 * resolution design document for the extension checklist.
 */
export const PRIMARY_BULLETIN_HYMNALS = {
  english: 'sdah-1985-en',
  chinese: 'chinese-hymnal-505',
} as const satisfies Record<'english' | 'chinese', HymnalId>;

export const BULLETIN_HYMNAL_DISPLAY_NAMES = {
  english: 'SDA Hymnal (1985)',
  chinese: '505',
} as const;
