import type { HymnalId } from './HymnalNumberMappings';

/**
 * The hymnals treated as primary by this church's bilingual bulletin.
 *
 * A fork for another church should change these IDs after adding that hymnal's
 * catalog/reader and its cross-reference data to HymnalNumberMappings.json.
 * BulletinHymnalService intentionally reads this configuration instead of
 * embedding a denomination choice throughout its matching logic.
 */
export const PRIMARY_BULLETIN_HYMNALS = {
  english: 'sdah-1985-en',
  chinese: 'chinese-hymnal-505',
} as const satisfies Record<'english' | 'chinese', HymnalId>;

export const BULLETIN_HYMNAL_DISPLAY_NAMES = {
  english: 'SDA Hymnal (1985)',
  chinese: '505',
} as const;
