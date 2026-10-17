import { archiveLinks, parseSpotifyPlaylistUrl, parseSupportProfileUrl } from '@/lib/archive-links';
import '@/archive-corners.css';

export function ArchiveCorners() {
  const support = parseSupportProfileUrl(archiveLinks.supportUrl);
  const playlist = parseSpotifyPlaylistUrl(archiveLinks.spotifyPlaylistUrl);

  return <section className="archive-corners" aria-label="Support and listening">
    <article className="archive-corner" aria-labelledby="archive-support-title">
      <div className="archive-corner-heading">
        <p className="archive-corner-label">A little encouragement</p>
        {!support && <span className="archive-corner-preview">Preview</span>}
      </div>
      <div className="archive-corner-body">
        <span className="archive-corner-symbol" aria-hidden="true">♡</span>
        <div><h2 id="archive-support-title">Support the archive</h2>
          <p>A small kindness for this little corner of the internet.</p></div>
      </div>
      {support ? <a className="archive-corner-action" href={support} target="_blank" rel="noopener noreferrer">
        Open support page<span aria-hidden="true">↗</span><span className="archive-corner-sr-only"> (opens in a new tab)</span>
      </a> : <button className="archive-corner-action" type="button" disabled>Support link coming soon<span aria-hidden="true">↗</span></button>}
    </article>
    <article className="archive-corner" aria-labelledby="archive-listening-title">
      <div className="archive-corner-heading">
        <p className="archive-corner-label">Spotify / In the margins</p>
        {!playlist && <span className="archive-corner-preview">Preview</span>}
      </div>
      <div className="archive-corner-body">
        <span className="archive-corner-record" aria-hidden="true"><span /></span>
        <div><h2 id="archive-listening-title">Listening corner</h2>
          <p>{playlist ? 'A soundtrack for wandering through the archive.' : 'A space for the songs that keep me company.'}</p></div>
      </div>
      {playlist ? <a className="archive-corner-action" href={playlist} target="_blank" rel="noopener noreferrer">
        Open playlist on Spotify<span aria-hidden="true">↗</span><span className="archive-corner-sr-only"> (opens in a new tab)</span>
      </a> : <button className="archive-corner-action" type="button" disabled>Playlist not connected<span aria-hidden="true">♫</span></button>}
    </article>
  </section>;
}
