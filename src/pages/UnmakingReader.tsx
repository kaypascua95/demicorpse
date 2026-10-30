import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { SiteLink } from '@/lib/navigation';
import { getUnmakingChapter, rememberUnmakingReveal, UNMAKING_CHAPTERS, UNMAKING_CONTENTS_HREF } from '@/lib/unmaking';
import chapterOne from '@/content/unmaking-chapter-01.md?raw';
import { NovellaHeader } from './TheUnmaking';

export default function UnmakingReader({ slug }: { slug: string }) {
  const chapter = getUnmakingChapter(slug);
  const index = chapter ? UNMAKING_CHAPTERS.indexOf(chapter) : -1;
  const isAvailable = index === 0;
  const upcoming = isAvailable ? UNMAKING_CHAPTERS[1] : undefined;

  useEffect(() => {
    const oldTitle = document.title;
    document.title = chapter ? chapter.title + ' — The Unmaking / DemiCorpse' : 'Chapter not found — The Unmaking';
    // Browser Back should also return to the complete hero, never a blank reveal.
    if (chapter) rememberUnmakingReveal();
    return () => { document.title = oldTitle; };
  }, [chapter]);

  return <div className="unmaking-site unmaking-reading-site">
    <NovellaHeader reading />
    <main className="unmaking-reader" id="reader">
      {!chapter ? <section className="unmaking-reader-missing">
        <span className="unmaking-reader-kicker">THE UNMAKING / ERROR</span>
        <h1>Nothing written here.</h1>
        <p>This chapter isn't in the current index.</p>
        <SiteLink href={UNMAKING_CONTENTS_HREF}>Return to the table of contents ↗</SiteLink>
      </section> : <>
        <nav className="unmaking-reader-breadcrumb" aria-label="Reading location">
          <SiteLink href={UNMAKING_CONTENTS_HREF}>← Table of contents</SiteLink>
          <span>THE UNMAKING / {chapter.roman} OF VI</span>
        </nav>
        <article className="unmaking-reader-sheet">
          <header className="unmaking-reader-title">
            <p>A NOVELLA BY DEMICORPSE</p>
            <span className="unmaking-reader-number">{chapter.roman}</span>
            <h1>{chapter.title}</h1>
            <div className="unmaking-reader-flourish" aria-hidden="true">✦</div>
          </header>
          {isAvailable ? <section className="unmaking-reader-manuscript" aria-label="Chapter I — A Place at the Table">
            <ReactMarkdown skipHtml components={{
              img: () => null,
              a: ({ children }) => <span>{children}</span>,
            }}>{chapterOne}</ReactMarkdown>
          </section> : <section className="unmaking-reader-manuscript unmaking-reader-coming-soon" aria-label="Chapter publication status">
            <p className="unmaking-coming-label">COMING SOON</p>
            <p>This chapter is still being written. Return to the table of contents to read Chapter I.</p>
            <SiteLink href={UNMAKING_CONTENTS_HREF}>Return to the table of contents ↗</SiteLink>
          </section>}
          <div className="unmaking-reader-endmark" aria-hidden="true">✦</div>
        </article>
        <nav className="unmaking-reader-next" aria-label="Chapter navigation">
          <SiteLink href={UNMAKING_CONTENTS_HREF}><span>← CONTENTS</span><strong>Table of contents</strong></SiteLink>
          {upcoming ? <div className="unmaking-reader-future" aria-label="Next chapter coming soon">
            <span>NEXT · CHAPTER {upcoming.roman}</span><strong>Coming Soon</strong>
          </div> : <div className="unmaking-reader-future">
            <span>THE UNMAKING</span><strong>More to come.</strong>
          </div>}
        </nav>
      </>}
    </main>
    <footer className="unmaking-reader-footer">DEMICORPSE <span aria-hidden="true">✦</span> THE UNMAKING</footer>
  </div>;
}
