import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cms, entryTimestamp, publicCms, type Entry, type EntryInput } from '@/lib/cms';

export function Media({ path, preview = false, alt = '' }: { path: string; preview?: boolean; alt?: string }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true, objectUrl = '';
    setUrl(''); setFailed(false);
    const db = preview ? cms : publicCms;
    db?.storage.from('cms-media').download(path).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) { setFailed(true); return; }
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, preview]);
  if (failed) return <p className="cms-muted">This media is unavailable.</p>;
  if (!url) return <p className="cms-muted" role="status">Loading media…</p>;
  if (/\.(mp4|webm)$/.test(path)) return <video className="cms-media" controls preload="metadata" src={url} />;
  if (/\.(mp3|ogg)$/.test(path)) return <audio className="cms-media" controls preload="metadata" src={url} />;
  return <img className="cms-media" src={url} alt={alt} loading="lazy" />;
}

export function Markdown({ content }: { content: string }) {
  // Raw HTML and inline remote images are deliberately not rendered. Uploaded
  // media goes through Storage RLS; links are restricted to safe web protocols.
  return <div className="cms-prose"><ReactMarkdown skipHtml components={{
    img: () => null,
    a: ({ href, children }) => href && /^(https?:\/\/|mailto:|\/[^/]|#)/i.test(href)
      ? <a href={href} rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
  }}>{content}</ReactMarkdown></div>;
}

export function EntryView({ entry, preview = false }: { entry: EntryInput | Entry; preview?: boolean }) {
  const timestamp = 'created_at' in entry ? entryTimestamp(entry) : null;
  return <article className="cms-entry">
    <header><p className="cms-eyebrow">{entry.collection} / <time dateTime={timestamp && "created_at" in entry ? (entry.published_at || entry.created_at) : entry.date}>{timestamp || entry.date}</time></p>
      {entry.title && <h1>{entry.title}</h1>}
      {entry.game && <p className="cms-muted">{entry.game}{entry.duration ? ` · ${entry.duration}` : ''}</p>}
      {entry.type && <p className="cms-muted">{entry.type}</p>}
      {entry.excerpt && <p className="cms-excerpt">{entry.excerpt}</p>}{entry.collection === 'play' && entry.video_url && /^https:\/\//.test(entry.video_url) && <p><a className="cms-button cms-primary" href={entry.video_url} target="_blank" rel="noopener noreferrer">Watch VOD ↗</a></p>}
    </header>
    {entry.collection === 'journal' ? <div className={`journal-story journal-layout-${entry.media_layout || 'full'}`}>
      {entry.cover_image && <div className="journal-lead-media"><Media path={entry.cover_image} preview={preview} /></div>}
      {entry.quote && <blockquote className="journal-pullquote">“{entry.quote}”</blockquote>}
      <div className="journal-story-copy"><Markdown content={entry.content} /></div>
      {!!entry.media.filter(path => path !== entry.cover_image).length && <div className="journal-secondary-media">{entry.media.filter(path => path !== entry.cover_image).map(path => <Media key={path} path={path} preview={preview} />)}</div>}
    </div> : <>
      {entry.cover_image && <Media path={entry.cover_image} preview={preview} />}
      <Markdown content={entry.collection === 'archive' ? entry.description : entry.content} />
      {entry.media.filter(path => path !== entry.cover_image).map(path => <Media key={path} path={path} preview={preview} />)}
    </>}
    {!!entry.tags.length && <p className="cms-tags">{entry.tags.join(' / ')}</p>}
  </article>;
}
