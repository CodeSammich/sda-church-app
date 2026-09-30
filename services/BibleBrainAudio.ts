import { BIBLE_BRAIN_AUDIO } from '@/constants/ExternalLinks';

/**
 * Cantonese chapters' audio links, from the church's Bible Brain Apps Script (#241).
 *
 * The app knows each Cantonese chapter by the script's address for it, which never
 * changes, so the narrator list and saved choices work like any other recording.
 * A player can't use that address, though: the script answers with the chapter's
 * link on FCBH's servers, and those links expire. So before playing, the app looks
 * up the links for the chapter and the ones queued after it, keeps them in memory
 * only, and hands the player only links that will still work when their chapter
 * plays.
 */

type BibleBrainConfig = typeof BIBLE_BRAIN_AUDIO;

type BibleBrainLink = Readonly<{ url: string; expiresAt: number; durationMs: number }>;

const MAX_CHAPTERS_PER_REQUEST = 30;
const LOOKUP_TIMEOUT_MS = 15_000;
// FCBH's links say when they expire. One that doesn't is assumed to last this long.
const ASSUMED_LINK_LIFETIME_MS = 30 * 60_000;
// A chapter without a length from FCBH, or another narrator's, is assumed to take this long.
const ASSUMED_CHAPTER_MS = 6 * 60_000;
// A link has to outlast its chapter by this much, since the player keeps
// requesting parts of the file while it plays.
const LINK_MARGIN_MS = 5 * 60_000;

// Script address → link, and link → script address. In memory only.
const links = new Map<string, BibleBrainLink>();
const addressByLink = new Map<string, string>();

/** The script's address for one chapter: `<script>?fileset=<id>&chapters=MAT.1`. */
export const getBibleBrainChapterAddress = (
  fileset: string,
  bookId: string,
  chapter: number,
  config: BibleBrainConfig = BIBLE_BRAIN_AUDIO,
) => {
  const url = new URL(config.scriptUrl);
  url.searchParams.set('fileset', fileset);
  url.searchParams.set('chapters', `${bookId}.${chapter}`);
  return url.toString();
};

const parseAddress = (address: string, config: BibleBrainConfig) => {
  if (!config.scriptUrl) return null;
  try {
    const url = new URL(address);
    const script = new URL(config.scriptUrl);
    if (url.origin !== script.origin || url.pathname !== script.pathname) return null;
    const fileset = url.searchParams.get('fileset');
    const chapter = url.searchParams.get('chapters');
    if (!fileset || !chapter || chapter.includes(',')) return null;
    return { fileset, chapter };
  } catch {
    return null;
  }
};

/** Whether a URL is a Cantonese chapter's script address, or a link looked up for one. */
export const isBibleBrainAudioUrl = (url: string, config: BibleBrainConfig = BIBLE_BRAIN_AUDIO) =>
  !!parseAddress(url, config) || addressByLink.has(url);

/**
 * When a signed link expires, from its own query: CloudFront's `Expires`, or
 * S3's `X-Amz-Date` plus `X-Amz-Expires`. Null if it doesn't say.
 */
export const getSignedLinkExpiry = (link: string): number | null => {
  try {
    const params = new URL(link).searchParams;
    const expires = Number(params.get('Expires'));
    if (Number.isFinite(expires) && expires > 0) return expires * 1000;
    const signedAt = params.get('X-Amz-Date')?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    const seconds = Number(params.get('X-Amz-Expires'));
    if (signedAt && seconds > 0) {
      const [year, month, day, hour, minute, second] = signedAt.slice(1).map(Number);
      return Date.UTC(year, month - 1, day, hour, minute, second) + seconds * 1000;
    }
  } catch {
    // Not a URL: treated as saying nothing.
  }
  return null;
};

const lastsFor = (link: BibleBrainLink | undefined, from: number) =>
  !!link && link.expiresAt - LINK_MARGIN_MS >= from + link.durationMs;

const remember = (address: string, found: { url: string; duration?: unknown }, now: number) => {
  const previous = links.get(address);
  if (previous) addressByLink.delete(previous.url);
  const duration = Number(found.duration);
  links.set(address, {
    url: found.url,
    expiresAt: getSignedLinkExpiry(found.url) ?? now + ASSUMED_LINK_LIFETIME_MS,
    durationMs: Number.isFinite(duration) && duration > 0 ? duration * 1000 : ASSUMED_CHAPTER_MS,
  });
  addressByLink.set(found.url, address);
};

/**
 * Looks up links for the script addresses that have none, or one that won't last
 * through its chapter if it started now: one request per fileset and 30
 * chapters. A chapter the lookup can't find is left without a link, and the
 * player gets the chapters before it. Never rejects.
 */
export const lookUpBibleBrainAudio = async (
  addresses: readonly string[],
  {
    config = BIBLE_BRAIN_AUDIO,
    fetchJson = fetch,
    now = Date.now(),
  }: { config?: BibleBrainConfig; fetchJson?: typeof fetch; now?: number } = {},
) => {
  const wanted = new Map<string, Map<string, string>>();
  for (const address of new Set(addresses)) {
    const parsed = parseAddress(address, config);
    if (!parsed || lastsFor(links.get(address), now)) continue;
    const chapters = wanted.get(parsed.fileset) ?? new Map<string, string>();
    chapters.set(parsed.chapter, address);
    wanted.set(parsed.fileset, chapters);
  }

  const requests = [...wanted].flatMap(([fileset, chapters]) => {
    const ids = [...chapters.keys()];
    return Array.from({ length: Math.ceil(ids.length / MAX_CHAPTERS_PER_REQUEST) }, (_, index) => ({
      fileset,
      chapters,
      ids: ids.slice(index * MAX_CHAPTERS_PER_REQUEST, (index + 1) * MAX_CHAPTERS_PER_REQUEST),
    }));
  });

  await Promise.all(
    requests.map(async ({ fileset, chapters, ids }) => {
      const url = new URL(config.scriptUrl);
      url.searchParams.set('fileset', fileset);
      url.searchParams.set('chapters', ids.join(','));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      try {
        const response = await fetchJson(url.toString(), { signal: controller.signal });
        if (!response.ok) return;
        const body = await response.json();
        for (const id of ids) {
          const found = body?.links?.[id];
          if (typeof found?.url === 'string' && found.url.startsWith('https://')) {
            remember(chapters.get(id)!, found, now);
          }
        }
      } catch {
        // Offline, slow, or not set up: these chapters stay without links.
      } finally {
        clearTimeout(timeout);
      }
    }),
  );
};

/** The link to play a chapter's script address with now, if one will last through it. */
export const getPlayableBibleBrainUrl = (address: string, now = Date.now()) => {
  const link = links.get(address);
  return lastsFor(link, now) ? link!.url : null;
};

/** Forgets a link that failed, so the next Play looks the chapter up again. */
export const forgetBibleBrainLink = (url?: string | null) => {
  const address = url ? addressByLink.get(url) ?? url : null;
  const link = address ? links.get(address) : undefined;
  if (!address || !link) return;
  links.delete(address);
  addressByLink.delete(link.url);
};

type QueueItemWithSource = { source: unknown; fallbacks?: unknown[] };

const sourceUri = (source: unknown) =>
  source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string'
    ? source.uri
    : null;

/**
 * Swaps the script addresses in an upcoming queue for FCBH's links, and ends the
 * queue at the first Cantonese chapter without a link that will still work when
 * it's reached. `current` is the chapter playing before the queue starts.
 */
export const withBibleBrainLinks = <T extends QueueItemWithSource>(
  items: readonly T[],
  current: string | undefined,
  now = Date.now(),
  config: BibleBrainConfig = BIBLE_BRAIN_AUDIO,
): T[] => {
  let startsAt = now + (current ? links.get(current)?.durationMs ?? ASSUMED_CHAPTER_MS : 0);
  const queue: T[] = [];
  for (const item of items) {
    const address = sourceUri(item.source);
    if (!address || !parseAddress(address, config)) {
      queue.push(item);
      startsAt += ASSUMED_CHAPTER_MS;
      continue;
    }
    const link = links.get(address);
    if (!lastsFor(link, startsAt)) break;
    queue.push({
      ...item,
      source: { ...(item.source as object), uri: link!.url },
      fallbacks: [],
    });
    startsAt += link!.durationMs;
  }
  return queue;
};

/** Forgets every link. For tests. */
export const clearBibleBrainLinks = () => {
  links.clear();
  addressByLink.clear();
};
