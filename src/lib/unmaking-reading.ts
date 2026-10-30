/**
 * The Unmaking's reading place is private to the current browser, with no
 * account, network request, or changes to the publishing CMS.
 *
 * A paragraph index plus fractional offset survives viewport/font changes
 * better than storing scrollY pixels alone. Store a separate manual bookmark:
 * automatic progress should never silently replace a deliberate bookmark.
 */
export interface UnmakingReadingPlace {
  version: 1;
  chapterSlug: 'chapter-01';
  paragraphIndex: number;
  paragraphFraction: number;
  percent: number;
  savedAt: number;
}

const LAST_READ_KEY = 'demicorpse:unmaking:last-read:v1';
const BOOKMARK_KEY = 'demicorpse:unmaking:bookmark:v1';
export const UNMAKING_READING_UPDATED = 'demicorpse:unmaking-reading-updated';
export const UNMAKING_RESUME_HREF = '/the-unmaking/chapter-01?resume=1';

export function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function validatePlace(value: unknown): UnmakingReadingPlace | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<UnmakingReadingPlace>;
  if (item.version !== 1 || item.chapterSlug !== 'chapter-01') return null;
  if (typeof item.paragraphIndex !== 'number' || !Number.isInteger(item.paragraphIndex) ||
      item.paragraphIndex < 0 || item.paragraphIndex > 10000) return null;
  if (typeof item.paragraphFraction !== 'number' || !Number.isFinite(item.paragraphFraction) ||
      item.paragraphFraction < 0 || item.paragraphFraction > 1) return null;
  if (typeof item.percent !== 'number' || !Number.isFinite(item.percent) ||
      item.percent < 0 || item.percent > 100) return null;
  if (typeof item.savedAt !== 'number' || !Number.isFinite(item.savedAt)) return null;
  return item as UnmakingReadingPlace;
}

function read(key: string): UnmakingReadingPlace | null {
  try {
    const text = window.localStorage.getItem(key);
    return text ? validatePlace(JSON.parse(text)) : null;
  } catch { return null; }
}
export function getLastRead(): UnmakingReadingPlace | null {
  return read(LAST_READ_KEY);
}
export function getBookmark(): UnmakingReadingPlace | null {
  return read(BOOKMARK_KEY);
}

function save(key: string, place: UnmakingReadingPlace): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(place));
    window.dispatchEvent(new Event(UNMAKING_READING_UPDATED));
    return true;
  } catch { return false; }
}
export function saveLastRead(place: UnmakingReadingPlace): boolean {
  return save(LAST_READ_KEY, place);
}
export function saveBookmark(place: UnmakingReadingPlace): boolean {
  return save(BOOKMARK_KEY, place);
}
export function removeBookmark(): boolean {
  try {
    window.localStorage.removeItem(BOOKMARK_KEY);
    window.dispatchEvent(new Event(UNMAKING_READING_UPDATED));
    return true;
  } catch { return false; }
}

/** Returns a stable paragraph and scroll progress for the chapter's prose ONLY. */
export function captureReadingPlace(prose: HTMLElement): UnmakingReadingPlace | null {
  const paragraphs = Array.from(prose.querySelectorAll<HTMLElement>(':scope > p'));
  if (!paragraphs.length) return null;
  const anchor = Math.min(260, Math.max(135, innerHeight * .27));
  const paragraphIndex = Math.max(0, paragraphs.findIndex(p => p.getBoundingClientRect().bottom > anchor));
  const chosenIndex = paragraphs[paragraphIndex]?.getBoundingClientRect().bottom > anchor
    ? paragraphIndex : paragraphs.length - 1;
  const rect = paragraphs[chosenIndex].getBoundingClientRect();
  const top = scrollY + prose.getBoundingClientRect().top;
  const denominator = Math.max(1, prose.offsetHeight - innerHeight);
  return {
    version: 1,
    chapterSlug: 'chapter-01',
    paragraphIndex: chosenIndex,
    paragraphFraction: clamp01((anchor - rect.top) / Math.max(1, rect.height)),
    percent: Math.round(clamp01((scrollY - top) / denominator) * 100),
    savedAt: Date.now(),
  };
}

/** Restores the saved visible paragraph, independent of the old viewport height. */
export function restoreReadingPlace(prose: HTMLElement, place: UnmakingReadingPlace): boolean {
  const paragraphs = prose.querySelectorAll<HTMLElement>(':scope > p');
  const paragraph = paragraphs.item(Math.min(place.paragraphIndex, paragraphs.length - 1));
  if (!paragraph) return false;
  const anchor = Math.min(260, Math.max(135, innerHeight * .27));
  const rect = paragraph.getBoundingClientRect();
  const top = scrollY + rect.top + rect.height * place.paragraphFraction - anchor;
  window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'instant' });
  return true;
}
