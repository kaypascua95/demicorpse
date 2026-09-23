import { useState } from 'react';
import { Markdown, Media } from '@/components/CmsContent';
import type { Entry } from '@/lib/cms';
import { SiteLink } from '@/lib/navigation';

export default function FragmentFeed({ entries }: { entries: Entry[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  return <section className="fragment-feed" aria-label="Fragments">
    {entries.map(entry => {
      const date = new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
      return <article className={`fragment-card${entry.media.length ? ' fragment-card-media' : ''}`} key={entry.id}>
        <header><time dateTime={entry.date}>{date}</time><span>fragment</span></header>
        <Markdown content={entry.content.trim()} />
        {!!entry.media.length && <div className={`fragment-media-grid fragment-media-${Math.min(entry.media.length,4)}`}>
          {entry.media.slice(0,4).map((path,index) => <div className="fragment-media-cell" key={path} onClick={() => /\.(jpg|png|webp|gif)$/.test(path) && setLightbox(path)}>
            <Media path={path} alt={entry.content.replace(/[#*_\x60]/g,'').slice(0,160)} />
            {index === 3 && entry.media.length > 4 && <span className="fragment-more">+{entry.media.length-4}</span>}
          </div>)}
        </div>}
        <footer><SiteLink href={`/fragments/${entry.slug}`}>Permalink ↗</SiteLink><span>{entry.media.length ? `${entry.media.length} attachment${entry.media.length===1?'':'s'}` : 'text'}</span></footer>
      </article>;
    })}
    {lightbox && <div className="fragment-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
      <button aria-label="Close image">×</button><div onClick={e => e.stopPropagation()}><Media path={lightbox} /></div>
    </div>}
  </section>;
}
