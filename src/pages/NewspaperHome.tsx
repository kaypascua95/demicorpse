import { EditorialReveal } from '@/components/EditorialReveal';
import { InkCalligraphy } from '@/components/InkCalligraphy';
import { useEffect, useState, type CSSProperties } from 'react';
import GradientMenu from '@/components/ui/gradient-menu';
import { NewspaperMasthead } from '@/components/NewspaperMasthead';
import { listEntries, publicCms, type Entry } from '@/lib/cms';
import { SiteLink } from '@/lib/navigation';

type Photograph = {
  id: string; caption: string; image_url: string; storage_path: string | null;
  date: string; location: string;
};
type ResolvedPhotograph = Photograph & { src: string };
type LoadState = 'loading' | 'ready' | 'error';

function formatDate(date: string) {
  const value = new Date(`${date.slice(0, 10)}T12:00:00`);
  return Number.isNaN(value.getTime()) ? date : value.toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  });
}
function plainText(value: string) {
  return value.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
}

export default function NewspaperHome() {
  const [fragments, setFragments] = useState<Entry[]>([]);
  const [photographs, setPhotographs] = useState<ResolvedPhotograph[]>([]);
  const [fragmentState, setFragmentState] = useState<LoadState>('loading');
  const [galleryState, setGalleryState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    // A retry replaces this edition rather than retaining stale CMS rows or
    // object URLs revoked by the previous attempt's cleanup.
    setFragments([]);
    setPhotographs([]);
    setFragmentState('loading');
    setGalleryState('loading');
    listEntries('fragments').then(entries => {
      if (active) { setFragments(entries.slice(0, 3)); setFragmentState('ready'); }
    }).catch(() => { if (active) setFragmentState('error'); });
    async function loadPhotographs() {
      if (!publicCms) { if (active) setGalleryState('ready'); return; }
      const { data, error } = await publicCms.from('gallery_items')
        .select('id,caption,image_url,storage_path,date,location')
        .eq('status', 'published').order('date', { ascending: false }).order('id').limit(4);
      if (error) throw error;
      const resolved = await Promise.all((data as Photograph[]).map(async photo => {
        if (photo.image_url) return { ...photo, src: photo.image_url };
        if (!photo.storage_path) return null;
        const { data: image, error: imageError } = await publicCms!.storage.from('cms-media').download(photo.storage_path);
        if (imageError || !image || !active) return null;
        const src = URL.createObjectURL(image);
        objectUrls.push(src);
        return { ...photo, src };
      }));
      if (active) {
        setPhotographs(resolved.filter((photo): photo is ResolvedPhotograph => photo !== null));
        setGalleryState('ready');
      }
    }
    loadPhotographs().catch(() => { if (active) setGalleryState('error'); });
    return () => { active = false; objectUrls.forEach(URL.revokeObjectURL); };
  }, [attempt]);

  const cover = photographs[0];
  return <main className="newspaper-page" id="newspaper" tabIndex={-1}>
    <NewspaperMasthead home />
    <div className="newspaper-inscription"><InkCalligraphy /></div>

    <section className="newspaper-feature" aria-label="From the archive">
      <figure className="newspaper-cover">
        <SiteLink href="/gallery/" className="newspaper-cover-link" aria-label="Explore the photography gallery">
          <img src={cover?.src || '/hero-still.png'} alt={cover?.caption || 'Moonlight over the water in the DemiCorpse entrance film'} fetchPriority="high" />
          <span className="newspaper-photo-open">View gallery <span aria-hidden="true">↗</span></span>
        </SiteLink>
        <figcaption><span>{cover?.caption || 'DemiCorpse / Photographs'}</span>
          <span>{cover ? [cover.location, formatDate(cover.date)].filter(Boolean).join(' / ') : 'DemiCorpse / The moving archive'}</span>
        </figcaption>
      </figure>
      <aside className="newspaper-moon">
        <EditorialReveal as="p" className="newspaper-label">001 / Coming Soon</EditorialReveal>
        <EditorialReveal as="h2" delay={0.15}><SiteLink href="/dear-moon/">Dear<br />Moon</SiteLink></EditorialReveal>
        <span className="newspaper-short-rule" aria-hidden="true" />
        <EditorialReveal as="p" className="newspaper-moon-note" delay={0.3}>A collection of prose and poetry, coming soon.</EditorialReveal>
        <div className="newspaper-moon-bottom">
          <SiteLink className="newspaper-text-link" href="/dear-moon/">Visit Dear Moon <span aria-hidden="true">↗</span></SiteLink>
        </div>
      </aside>
    </section>

    <div className="newspaper-paper">
      <section className="newspaper-latest" aria-label="Recent additions">
        <div className="newspaper-fragments">
          <header className="newspaper-section-head"><EditorialReveal as="h2">Recent fragments</EditorialReveal><SiteLink href="/fragments/" aria-label="All fragments">Index <span aria-hidden="true">↗</span></SiteLink></header>
          {fragmentState === 'loading' ? <p className="newspaper-status" role="status">Gathering the latest fragments…</p>
            : fragmentState === 'error' ? <div className="newspaper-status" role="status"><p>The fragments couldn’t be loaded.</p><button onClick={() => setAttempt(value => value + 1)}>Try again ↗</button></div>
            : fragments.length ? <ol className="newspaper-fragment-list">{fragments.map((entry, index) => {
              const content = plainText(entry.excerpt || entry.content);
              const title = entry.title || content || 'Untitled fragment';
              return <li key={entry.id}><SiteLink href={`/fragments/${entry.slug}`}>
                <span className="newspaper-fragment-number">{String(index + 1).padStart(2, '0')}</span>
                <div><h3>{title}</h3>{entry.title && content && <p>{content}</p>}</div>
                <time dateTime={entry.date}>{formatDate(entry.date)}<span aria-hidden="true">↗</span></time>
              </SiteLink></li>;
            })}</ol> : <p className="newspaper-status">No fragments yet. Small things are being gathered.</p>}
        </div>
        <div className="newspaper-contact-sheet">
          <header className="newspaper-section-head"><EditorialReveal as="h2">Contact sheet</EditorialReveal><SiteLink href="/gallery/">Gallery <span aria-hidden="true">↗</span></SiteLink></header>
          {photographs.length ? <div className="newspaper-frames" style={{'--frame-count': photographs.length} as CSSProperties}>{photographs.map((photo, index) => <SiteLink key={photo.id} href="/gallery/" className="newspaper-frame" aria-label={`View photograph: ${photo.caption || 'Untitled'}`}>
            <span className="newspaper-film-edge" aria-hidden="true" />
            <img src={photo.src} alt={photo.caption || 'From the DemiCorpse gallery'} loading="lazy" />
            <span className="newspaper-frame-number">{String(index + 1).padStart(2, '0')}<span aria-hidden="true">◇</span></span>
          </SiteLink>)}</div> : <div className="newspaper-contact-empty"><span aria-hidden="true">◯</span><p role="status">{galleryState === 'loading' ? 'The photographs are developing…' : galleryState === 'error' ? 'The photographs couldn’t be loaded.' : 'Nothing framed yet. Photographs will gather here.'}</p>{galleryState === 'error' && <button onClick={() => setAttempt(value => value + 1)}>Try again ↗</button>}</div>}
          <p className="newspaper-contact-caption">Things I saw. <span>Proof of ordinary days.</span></p>
        </div>
      </section>

      <section className="newspaper-about" id="about">
        <div><p className="newspaper-label">002 / About</p><EditorialReveal as="h2">Welcome to my<br />little corner of<br /><em>the internet.</em></EditorialReveal></div>
        <div className="newspaper-about-copy">
          <EditorialReveal as="p" className="newspaper-about-lead">I’m Kayla, though around here,<br />I go by DemiCorpse.</EditorialReveal>
          <div className="newspaper-about-columns">
            <p>I’m an engineer by profession, which means I spend a perfectly reasonable portion of my life solving problems. Unfortunately, this has done very little to stop me from creating new ones in the form of unfinished poems, half-formed ideas, excessive screenshots, late-night gaming sessions, and an alarming number of thoughts saved to my Notes app.</p>
            <p>This is where some of those things eventually end up.</p>
            <p>It’s part journal, part creative outlet, and part archive of things that might otherwise disappear—writing, photographs, games, memories, and ordinary moments that seemed worth keeping.</p>
            <p>There is no particular reason all of these things should belong in the same place.</p>
            <p>They simply belong to the same person.</p>
          </div>
        </div>
      </section>
      <footer className="newspaper-footer" id="elsewhere">
        <div><p className="newspaper-label">003 / Elsewhere</p><EditorialReveal as="h2">Leave your mark.<br /><em>Find me elsewhere.</em></EditorialReveal><p>Follow along through the other corners of the internet where DemiCorpse still wanders.</p></div>
        <GradientMenu />
        <div className="newspaper-colophon"><span>DemiCorpse</span><SiteLink href="/colophon/">Colophon ↗</SiteLink></div>
      </footer>
    </div>
  </main>;
}
