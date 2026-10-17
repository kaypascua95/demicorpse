import { useEffect, useState } from 'react';
import { BrandMoon } from '@/components/BrandMoon';
import { type Entry } from '@/lib/cms';
import { nextJournalEntry, type JournalRecommendation } from '@/lib/journal-next';
import { SiteLink } from '@/lib/navigation';

export function JournalEnding({ entry }: { entry: Entry }) {
  const [result, setResult] = useState<{ source: Entry; next: JournalRecommendation | null } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    nextJournalEntry(entry, controller.signal).then(next => {
      if (!controller.signal.aborted) setResult({ source: entry, next });
    }).catch(() => {
      // A recommendation is optional. Never turn a readable article into an
      // error page, and keep the journal return link available when offline.
      if (!controller.signal.aborted) setResult({ source: entry, next: null });
    });
    return () => controller.abort();
  }, [entry]);
  const next = result?.source === entry ? result.next : null;
  return <nav className="journal-ending" aria-label="Journal entry ending">
    <div className="journal-ending-divider" aria-hidden="true"><span /><BrandMoon /><span /></div>
    {next && <SiteLink className="journal-read-next" href={`/journal/${next.slug}/`} aria-label={`Read next: ${next.title}`}>
      <span className="journal-ending-label">Read next</span>
      <h2>{next.title}<span aria-hidden="true">↗</span></h2>
    </SiteLink>}
    <SiteLink className="journal-ending-back" href="/journal/">Back to the journal<span aria-hidden="true"> ↗</span></SiteLink>
  </nav>;
}
