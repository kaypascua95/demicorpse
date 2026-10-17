import { useState } from 'react';
import { archiveLinks, parseSpotifyPlaylistUrl, parseSupportProfileUrl } from '@/lib/archive-links';
import '@/archive-corners.css';

export function ArchiveCorners() {
  const support = parseSupportProfileUrl(archiveLinks.supportUrl);
  const playlist = parseSpotifyPlaylistUrl(archiveLinks.spotifyPlaylistUrl);
  const playlistTitle = archiveLinks.playlistTitle?.trim() || 'Archive';
  const [playerVisible, setPlayerVisible] = useState(false);
  // Derive the iframe URL only from the validated canonical playlist URL.
  const embedUrl = playlist?.replace('/playlist/', '/embed/playlist/');

  return <section className="archive-corners" aria-label="Support and listening">
    <article className="archive-corner" aria-labelledby="archive-support-title">
      <div className="archive-corner-heading">
        <p className="archive-corner-label">04 / Support</p>
        {!support && <span className="archive-corner-preview">Preview</span>}
      </div>
      <div className="archive-corner-body">
        <span className="archive-corner-symbol" aria-hidden="true">♡</span>
        <div><h2 id="archive-support-title">Support the archive</h2>
          <p>A small kindness for this little corner of the internet.</p></div>
      </div>
      {support ? <a className="archive-corner-action archive-support-action cms-button cms-primary" href={support} target="_blank" rel="noopener noreferrer">
        Support on Ko-fi<span aria-hidden="true">↗</span><span className="archive-corner-sr-only"> (opens in a new tab)</span>
      </a> : <button className="archive-corner-action archive-support-action cms-button cms-primary" type="button" disabled>Support link coming soon<span aria-hidden="true">↗</span></button>}
    </article>
    <article className="archive-corner" aria-labelledby="archive-listening-title">
      <div className="archive-corner-heading">
        <p className="archive-corner-label">05 / Spotify</p>
        {!playlist && <span className="archive-corner-preview">Preview</span>}
      </div>
      <div className="archive-corner-body">
        <span className="archive-corner-record" aria-hidden="true"><span /></span>
        <div><h2 id="archive-listening-title">Listening corner</h2>
          <p>{playlist ? playlistTitle : 'A space for the songs that keep me company.'}</p></div>
      </div>
      {playlist ? <>
        <div className="archive-listening-player">
          <p className="archive-player-note" id="archive-player-disclosure">The player stays off until you load it. Loading connects to Spotify and may use cookies.</p>
          <button className="archive-player-toggle" type="button" aria-expanded={playerVisible} aria-controls="archive-spotify-player" aria-describedby="archive-player-disclosure" onClick={() => setPlayerVisible(visible => !visible)}>
            {playerVisible ? 'Hide Spotify player' : 'Load Spotify player'}
          </button>
          <div id="archive-spotify-player">
            {playerVisible && <>
              <iframe className="archive-spotify-frame" title={`${playlistTitle} Spotify playlist`} src={embedUrl} width="100%" height="352" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; fullscreen; picture-in-picture" />
              <p className="archive-player-note">If the player is unavailable, open the playlist in Spotify below.</p>
            </>}
          </div>
        </div>
        <a className="archive-corner-action" href={playlist} target="_blank" rel="noopener noreferrer">
          Open in Spotify<span aria-hidden="true">↗</span><span className="archive-corner-sr-only"> (opens in a new tab)</span>
        </a>
      </> : <button className="archive-corner-action" type="button" disabled>Playlist not connected<span aria-hidden="true">♫</span></button>}
    </article>
  </section>;
}
