import { useEffect } from 'react';
import { SiteLink } from '@/lib/navigation';
import { getUnmakingChapter, UNMAKING_CHAPTERS } from '@/lib/unmaking';
import { NovellaHeader } from './TheUnmaking';

export default function UnmakingReader({ slug }: { slug: string }) {
  const chapter = getUnmakingChapter(slug);
  const index = chapter ? UNMAKING_CHAPTERS.indexOf(chapter) : -1;
  const previous = index > 0 ? UNMAKING_CHAPTERS[index - 1] : undefined;
  const next = index >= 0 && index < UNMAKING_CHAPTERS.length - 1 ? UNMAKING_CHAPTERS[index + 1] : undefined;

  useEffect(() => {
    const oldTitle = document.title;
    document.title = chapter ? chapter.title + ' — The Unmaking / DemiCorpse' : 'Chapter not found — The Unmaking';
    return () => { document.title = oldTitle; };
  }, [chapter]);

  return <div className="unmaking-site unmaking-reading-site">
    <NovellaHeader reading />
    <main className="unmaking-reader" id="reader">
      {!chapter ? <section className="unmaking-reader-missing">
        <span className="unmaking-reader-kicker">THE UNMAKING / ERROR</span>
        <h1>Nothing written here.</h1>
        <p>This chapter doesn't belong to the current index.</p>
        <SiteLink href="/the-unmaking/">Return to the table of contents ↗</SiteLink>
      </section> : <>
        <nav className="unmaking-reader-breadcrumb" aria-label="Reading location">
          <SiteLink href="/the-unmaking/">← Table of contents</SiteLink>
          <span>THE UNMAKING / {chapter.roman} OF VI</span>
        </nav>
        <article className="unmaking-reader-sheet">
          <header className="unmaking-reader-title">
            <p>A NOVELLA BY DEMICORPSE</p>
            <span className="unmaking-reader-number">{chapter.roman}</span>
            <h1>{chapter.title}</h1>
            <div className="unmaking-reader-flourish" aria-hidden="true">✦</div>
          </header>
          <section className="unmaking-reader-manuscript" aria-label="Manuscript preview status">
            <p className="unmaking-reader-opening">The manuscript is still being revised.</p>
            <p>This page previews the typography, pacing, and navigation of the finished novella. The chapter text has intentionally not been published or replaced with invented prose.</p>
            <p>Once the final manuscript is ready, the story will appear here in a quiet, distraction-free reading column.</p>
          </section>
          <div className="unmaking-reader-endmark" aria-hidden="true">✦</div>
        </article>
        <nav className="unmaking-reader-next" aria-label="Chapter navigation">
          {previous ? <SiteLink href={'/the-unmaking/' + previous.slug}><span>← PREVIOUS</span><strong>{previous.title}</strong></SiteLink> : <SiteLink href="/the-unmaking/"><span>← INDEX</span><strong>Table of contents</strong></SiteLink>}
          {next ? <SiteLink href={'/the-unmaking/' + next.slug}><span>NEXT →</span><strong>{next.title}</strong></SiteLink> : <SiteLink href="/the-unmaking/"><span>BACK TO THE ARCHIVE →</span><strong>The Unmaking</strong></SiteLink>}
        </nav>
      </>}
    </main>
    <footer className="unmaking-reader-footer">DEMICORPSE <span aria-hidden="true">✦</span> THE UNMAKING</footer>
  </div>;
}
