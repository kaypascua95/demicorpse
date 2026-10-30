import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import InkHero from '@/components/ui/ink-hero';
import { SiteLink } from '@/lib/navigation';
import { UNMAKING_CHAPTERS, UNMAKING_HERO_IMAGE } from '@/lib/unmaking';

export function NovellaHeader({ reading = false, revealed = true }: { reading?: boolean; revealed?: boolean }) {
  return <header className={'unmaking-header' + (revealed ? ' is-revealed' : '')} aria-hidden={!revealed}>
    <SiteLink className="unmaking-brand" href="/?enter=1" aria-label="Return to DemiCorpse">
      <img src="/demicorpse-logo.png" alt="DemiCorpse" />
    </SiteLink>
    <span className="unmaking-imprint">THE LIVING ARCHIVE <span> / </span> FICTION</span>
    <nav className="unmaking-navigation" aria-label="Novella navigation">
      <SiteLink href="/?enter=1">Home</SiteLink>
      <SiteLink href="/the-unmaking/" aria-current={!reading ? 'page' : undefined}>The Unmaking</SiteLink>
      {reading
        ? <SiteLink href="/the-unmaking/">Chapters</SiteLink>
        : <a href="#unmaking-contents">Chapters</a>}
      <SiteLink href="/journal/">Journal</SiteLink>
    </nav>
  </header>;
}

export default function TheUnmaking() {
  const [revealed, setRevealed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const onRevealChange = useCallback((value: boolean) => {
    setRevealed(previous => previous === value ? previous : value);
  }, []);
  // Entering from a scrolled Journal page must start at the blank first frame,
  // even though the rest of DemiCorpse normally uses smooth scrolling.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  useEffect(() => {
    const previous = document.title;
    document.title = 'The Unmaking — DemiCorpse';
    return () => { document.title = previous; };
  }, []);

  return <div className="unmaking-site" id="unmaking-top">
    <a href="#unmaking-contents" className="unmaking-skip">Skip the introduction and view chapters</a>
    <NovellaHeader revealed={revealed} />
    <InkHero imageSrc={UNMAKING_HERO_IMAGE} imageAlt="A dim, old hallway with a chair and a window" onRevealChange={onRevealChange} />

    <main id="unmaking-contents" className="unmaking-contents">
      <div className="unmaking-contents-heading">
        <p>THE UNMAKING <span aria-hidden="true">/</span> AN INDEX</p>
        <span>THE SIX PARTS</span>
      </div>
      <div className="unmaking-content-columns">
        <aside className="unmaking-index-art" aria-label="Novella cover design">
          <figure className="unmaking-cover-figure">
            <img src="/the-unmaking-cover.svg" alt="The Unmaking: a dark, aged-paper cover with an open doorway, an empty chair, and two cups" loading="lazy" />
            <figcaption>COVER DESIGN / STUDY NO. 01</figcaption>
          </figure>
        </aside>
        <section className="unmaking-chapters" aria-labelledby="unmaking-index-title">
          <h2 id="unmaking-index-title">Table of <em>contents.</em></h2>
          <p className="unmaking-index-subtitle">Six chapters on grief, memory, and the shape of absence.</p>
          <ol>
            {UNMAKING_CHAPTERS.map(chapter => <li key={chapter.slug}>
              <SiteLink href={'/the-unmaking/' + chapter.slug} aria-label={'Preview ' + chapter.title}>
                <span className="unmaking-chapter-numeral">{chapter.roman}</span>
                <span className="unmaking-chapter-title">{chapter.title}<small>Reader layout preview</small></span>
                <span className="unmaking-chapter-arrow" aria-hidden="true">↗</span>
              </SiteLink>
            </li>)}
          </ol>
        </section>
        <aside className="unmaking-index-note">
          <p className="unmaking-small-label">A NOTE FROM THE ARCHIVE</p>
          <h3>The things<br/>we leave <em>behind.</em></h3>
          <p>A psychological horror novella where the familiar becomes unsettling, and grief finds its way into the smallest rituals.</p>
          <div className="unmaking-note-rule" />
          <p className="unmaking-preview-status">This is a design preview. Chapter titles are provisional; the prose remains unpublished while the novella is revised.</p>
          <SiteLink href="/the-unmaking/chapter-01">Explore the reading layout <span aria-hidden="true">↗</span></SiteLink>
        </aside>
      </div>
      <footer className="unmaking-footer">
        <span>DEMICORPSE / THE UNMAKING</span>
        <SiteLink href="/?enter=1">Return to the archive <span aria-hidden="true">↗</span></SiteLink>
        <span>AN ORIGINAL DEMICORPSE FICTION EXPERIENCE</span>
      </footer>
    </main>
  </div>;
}
