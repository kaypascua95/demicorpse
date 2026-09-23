import { useEffect, useState } from 'react';
import ComingSoon from './ComingSoon';
import { EntryView } from '@/components/CmsContent';
import FragmentFeed from '@/components/FragmentFeed';
import TraceSection from '@/components/TraceSection';
import { entryTimestamp, errorMessage, listEntries, publicCms, type Collection, type Entry } from '@/lib/cms';
import { SiteLink } from '@/lib/navigation';
import { SqueezeCarousel, type SqueezeSlide } from '@/components/ui/carousel-squeeze';

const copy = {
  journal: ['01 / JOURNAL', 'Things I wanted', 'to remember.', 'Longer thoughts, stories, and the things that refused to stay in my head.'],
  fragments: ['02 / FRAGMENTS', 'Loose', 'evidence.', 'Things too small to become stories, but too alive to throw away.'],
  play: ['05 / PLAY', 'The other lives', 'I live.', 'Games, streams, late nights, screenshots, and The Graveyard.'],
  archive: ['ARCHIVE', 'Everything', 'kept.', 'A chronological record of whatever survived long enough to end up here.'],
};
function JournalSqueeze({entries}:{entries:Entry[]}) {
  const slides:SqueezeSlide[]=entries.slice(0,7).map(entry=>({id:entry.id,title:entry.title,description:entry.excerpt||entry.quote||'Open the journal entry.',href:`/journal/${entry.slug}`,action:'Read entry',overlay:<span>{entryTimestamp(entry)}</span>,image:undefined}));
  return <section className="journal-featured"><p className="cms-eyebrow">FROM THE JOURNAL</p><SqueezeCarousel slides={slides} label="Journal entries"/></section>;
}
export default function CollectionPage({ collection, slug }: { collection: Collection; slug?: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const fetchData = async () => {
      if (slug) {
        if (!publicCms) return [];
        const { data, error } = await publicCms.from('cms_entries').select('*')
          .eq('collection', collection).eq('slug', slug).eq('status', 'published').maybeSingle();
        if (error) throw error;
        return data ? [data as Entry] : [];
      }
      return listEntries(collection, page);
    };
    fetchData().then(data => { if (active) { setEntries(data); setMore(!slug && data.length === 20); } })
      .catch(error => { if (active) setError(errorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [collection, slug, page, retry]);
  if (loading) return <main className="inner-page"><p role="status" className="cms-muted">Opening the archive…</p></main>;
  if (error) return <main className="inner-page"><p role="alert">The archive couldn’t be loaded.</p><button className="cms-button" onClick={() => setRetry(retry + 1)}>Try again</button></main>;
  if (slug) return <main className="inner-page"><SiteLink className="cms-back" href={`/${collection}/`}>← {collection}</SiteLink>
    {entries[0] ? <><EntryView entry={entries[0]} />{collection === 'fragments' && <TraceSection fragmentId={entries[0].id} />}</> : <div className="cms-entry"><h1>Nothing here.</h1><p>This entry isn’t available.</p></div>}</main>;
  if (!entries.length && page === 0 && collection !== 'fragments') return <ComingSoon page={collection} />;
  const [label, first, second, note] = copy[collection];
  return <main className="inner-page"><header className="page-head"><span>{label}</span><h1>{first}<br /><em>{second}</em></h1><p>{note}</p></header>
    {collection === 'journal' && entries.length > 0 && <JournalSqueeze entries={entries} />}
    {collection === 'fragments' ? <FragmentFeed entries={entries} /> : <section className="entry-index">{entries.map(entry => <SiteLink key={entry.id} href={`/${collection}/${entry.slug}`}>
      <time dateTime={entry.published_at || entry.created_at}>{entryTimestamp(entry)}</time><div><strong>{entry.title}</strong>{entry.excerpt && <p className="cms-muted">{entry.excerpt}</p>}</div><span>{entry.game || entry.type || collection} →</span>
    </SiteLink>)}</section>}
    <nav className="cms-pagination" aria-label="Entries">{page > 0 && <button className="cms-button" onClick={() => setPage(page - 1)}>← Newer</button>}
      {more && <button className="cms-button" onClick={() => setPage(page + 1)}>Older →</button>}</nav>
  </main>;
}
