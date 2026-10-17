import { publicCms, type Entry } from '@/lib/cms';

export type JournalRecommendation = Pick<Entry, 'id' | 'slug' | 'title' | 'date' | 'collection' | 'status' | 'published_at'>;

/** Move toward newer in the journal's existing date DESC, id ASC index.
 * Typed filters avoid interpolating entry values into raw PostgREST syntax.
 * Each seek fetches at most one small metadata row, never another article body. */
export async function nextJournalEntry(entry: Entry, signal: AbortSignal): Promise<JournalRecommendation | null> {
  if (!publicCms || entry.collection !== 'journal' || entry.status !== 'published'
    || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return null;
  const cutoff = new Date().toISOString();
  const query = () => publicCms!.from('cms_entries')
    .select('id,slug,title,date,collection,status,published_at')
    .eq('collection', 'journal').eq('status', 'published')
    .neq('id', entry.id).lte('published_at', cutoff).limit(1).abortSignal(signal);
  const accept = (data: JournalRecommendation[] | null) => {
    const candidate = data?.[0];
    return candidate && candidate.id !== entry.id && candidate.slug !== entry.slug
      && candidate.collection === 'journal' && candidate.status === 'published'
      && candidate.published_at && Date.parse(candidate.published_at) <= Date.parse(cutoff)
      && /^[a-z0-9][a-z0-9-]{0,179}$/.test(candidate.slug) && candidate.title.trim()
      ? candidate : null;
  };

  const sameDay = await query().eq('date', entry.date).lt('id', entry.id).order('id', { ascending: false });
  if (sameDay.error) throw sameDay.error;
  const tied = accept(sameDay.data);
  if (tied || signal.aborted) return tied;

  const newer = await query().gt('date', entry.date).order('date', { ascending: true }).order('id', { ascending: false });
  if (newer.error) throw newer.error;
  const next = accept(newer.data);
  if (next || signal.aborted) return next;

  // At the newest entry, offer the most recent other piece rather than itself.
  const recent = await query().order('date', { ascending: false }).order('id', { ascending: true });
  if (recent.error) throw recent.error;
  return accept(recent.data);
}
