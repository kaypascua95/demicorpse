import { Markdown, Media } from '@/components/CmsContent';
import type { Entry } from '@/lib/cms';
import { SiteLink } from '@/lib/navigation';

export default function FragmentFeed({ entries }: { entries: Entry[] }) {
  return <section className="fragment-feed" aria-label="Fragments">
    {entries.map(entry => {
      const lead = entry.cover_image || entry.media[0];
      const additional = entry.media.filter(path => path !== lead).length;
      const date = new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      return <article className={`fragment-card${lead ? ' fragment-card-media' : ''}`} key={entry.id}>
        <header><time dateTime={entry.date}>{date}</time><span>{lead ? 'A little evidence' : 'A passing thought'}</span></header>
        {lead && <Media path={lead} alt={entry.content.replace(/[#*_`]/g, '').slice(0, 160)} />}
        <Markdown content={entry.content} />
        <footer>
          <SiteLink href={`/fragments/${entry.slug}`} aria-label={`Open fragment from ${date}`}>Keep reading ↗</SiteLink>
          {additional > 0 && <span>+{additional} more {additional === 1 ? 'attachment' : 'attachments'}</span>}
        </footer>
      </article>;
    })}
  </section>;
}
