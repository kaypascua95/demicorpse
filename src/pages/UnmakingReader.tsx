import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { SiteLink } from '@/lib/navigation';
import { getUnmakingChapter, rememberUnmakingReveal, UNMAKING_CHAPTERS, UNMAKING_CONTENTS_HREF } from '@/lib/unmaking';
import {
  captureReadingPlace, getBookmark, getLastRead, removeBookmark, restoreReadingPlace,
  saveBookmark, saveLastRead, type UnmakingReadingPlace,
} from '@/lib/unmaking-reading';
import Skiper89 from '@/components/ui/skiper89';
import chapterOne from '@/content/unmaking-chapter-01.md?raw';
import { NovellaHeader } from './TheUnmaking';

export default function UnmakingReader({ slug }: { slug: string }) {
  const chapter = getUnmakingChapter(slug);
  const index = chapter ? UNMAKING_CHAPTERS.indexOf(chapter) : -1;
  const isAvailable = index === 0;
  const upcoming = isAvailable ? UNMAKING_CHAPTERS[1] : undefined;
  const proseRef = useRef<HTMLElement>(null);
  const [bookmark, setBookmark] = useState<UnmakingReadingPlace | null>(() => getBookmark());
  const [lastRead, setLastRead] = useState<UnmakingReadingPlace | null>(() => getLastRead());
  const [notice, setNotice] = useState('');
  const readyToTrack = useRef(false);
  const lastScroll = useRef<UnmakingReadingPlace | null>(null);

  useEffect(() => {
    const oldTitle = document.title;
    document.title = chapter ? chapter.title + ' — The Unmaking / DemiCorpse' : 'Chapter not found — The Unmaking';
    if (chapter) rememberUnmakingReveal();
    return () => { document.title = oldTitle; };
  }, [chapter]);

  useEffect(() => {
    if (!isAvailable) return;
    const update = () => { setBookmark(getBookmark()); setLastRead(getLastRead()); };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [isAvailable]);

  useEffect(() => {
    if (!isAvailable) return;
    let alive = true;
    let pending: number | undefined;
    let debounce: number | undefined;
    let active = false;
    const wantsResume = new URLSearchParams(location.search).get('resume') === '1';

    const capture = () => {
      const prose = proseRef.current;
      if (!prose || !readyToTrack.current) return;
      const rect = prose.getBoundingClientRect();
      if (!active) {
        if (rect.top > innerHeight * .60) return;
        active = true;
      }
      const place = captureReadingPlace(prose);
      if (!place) return;
      lastScroll.current = place;
      // Delay disk writes while the reader is scrolling, but never change the
      // separately saved manual bookmark.
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        if (!alive) return;
        if (saveLastRead(place)) setLastRead(place);
      }, 280);
    };

    const onScroll = () => {
      if (pending !== undefined) return;
      pending = requestAnimationFrame(() => { pending = undefined; capture(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    const restoreInitialPosition = () => {
      if (!alive) return;
      const prose = proseRef.current;
      if (prose && wantsResume) {
        const saved = getLastRead() ?? getBookmark();
        if (saved) restoreReadingPlace(prose, saved);
      }
      readyToTrack.current = true;
      if (wantsResume) active = true;
    };
    // Fonts can change line wraps and paragraph heights. Position after they
    // settle so the same paragraph is returned at all reading widths.
    void document.fonts.ready.then(() => {
      if (!alive) return;
      requestAnimationFrame(() => requestAnimationFrame(restoreInitialPosition));
    });

    return () => {
      alive = false;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.clearTimeout(debounce);
      if (pending !== undefined) cancelAnimationFrame(pending);
      if (active && lastScroll.current) saveLastRead(lastScroll.current);
      readyToTrack.current = false;
    };
  }, [isAvailable, slug]);

  const savePlace = () => {
    const prose = proseRef.current;
    const place = prose && captureReadingPlace(prose);
    if (!place) return;
    if (saveBookmark(place)) {
      setBookmark(place);
      setNotice('Bookmark saved at ' + place.percent + '%.');
    } else {
      setNotice('Your browser is blocking local bookmarks.');
    }
  };

  const goToPlace = (place: UnmakingReadingPlace | null, kind: string) => {
    if (!place || !proseRef.current) return;
    if (restoreReadingPlace(proseRef.current, place)) setNotice('Returned to your ' + kind + '.');
  };

  const clearBookmark = () => {
    if (removeBookmark()) {
      setBookmark(null);
      setNotice('Bookmark removed. Your last reading position is still saved.');
    } else {
      setNotice('Your browser is blocking bookmark changes.');
    }
  };

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
          {isAvailable ? <>
            <div className="unmaking-reader-tools" role="group" aria-label="Bookmark tools">
              <button type="button" onClick={savePlace}><span aria-hidden="true">◇</span> Save Bookmark</button>
              {bookmark && <button type="button" onClick={() => goToPlace(bookmark, 'bookmark')}>Return to bookmark · {bookmark.percent}%</button>}
              {lastRead && <button type="button" onClick={() => goToPlace(getLastRead(), 'last reading place')}>Resume last read</button>}
            </div>
            <p className="unmaking-reader-notice" role="status" aria-live="polite">{notice}</p>
            <section ref={proseRef} className="unmaking-reader-manuscript" aria-label="Chapter I — A Place at the Table">
              <ReactMarkdown skipHtml components={{
                img: () => null,
                a: ({ children }) => <span>{children}</span>,
              }}>{chapterOne}</ReactMarkdown>
            </section>
          </> : <section className="unmaking-reader-manuscript unmaking-reader-coming-soon" aria-label="Chapter publication status">
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
    {isAvailable && <Skiper89
      targetRef={proseRef}
      bookmark={bookmark}
      hasLastRead={Boolean(lastRead)}
      onSaveBookmark={savePlace}
      onResumeBookmark={() => goToPlace(bookmark, 'bookmark')}
      onResumeLatest={() => goToPlace(getLastRead(), 'last reading place')}
      onRemoveBookmark={clearBookmark}
    />}
    <footer className="unmaking-reader-footer">DEMICORPSE <span aria-hidden="true">✦</span> THE UNMAKING</footer>
  </div>;
}
