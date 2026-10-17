/**
 * Public, optional home-page destinations. Replace null only with the owner's
 * real Ko-fi / Buy Me a Coffee profile or Spotify playlist URL. No credentials,
 * checkout URLs, iframe markup or environment variables belong here. Missing
 * links remain previews. The Spotify player contacts Spotify only after a click.
 */
export type ArchiveLinks = Readonly<{
  supportUrl: string | null;
  spotifyPlaylistUrl: string | null;
  playlistTitle: string | null;
}>;

export const archiveLinks: ArchiveLinks = {
  supportUrl: 'https://ko-fi.com/demic0rpse',
  spotifyPlaylistUrl: 'https://open.spotify.com/playlist/5hXIZZcqf438PiHmjDfMHI',
  playlistTitle: 'femme fatale',
};

function publicHttpsUrl(value: string | null | undefined): URL | null {
  if (!value || value !== value.trim() || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

/** Accept direct public profiles only, not payment, account or redirect routes. */
export function parseSupportProfileUrl(value: string | null | undefined): string | null {
  const url = publicHttpsUrl(value);
  if (!url || url.search || url.hash) return null;
  const allowedHosts = ['ko-fi.com', 'www.ko-fi.com', 'buymeacoffee.com', 'www.buymeacoffee.com'];
  const profile = /^\/([a-zA-Z0-9][a-zA-Z0-9_-]{1,49})\/?$/.exec(url.pathname)?.[1];
  const reserved = /^(about|account|api|blog|checkout|contact|dashboard|donate|explore|help|home|login|logout|membership|payments?|privacy|register|search|settings|shop|signup|support|terms)$/i;
  if (!allowedHosts.includes(url.hostname) || !profile || reserved.test(profile)) return null;
  return `https://${url.hostname.replace(/^www\./, '')}/${profile}`;
}

/** Share URLs may carry Spotify's `si` parameter; output is always canonical. */
export function parseSpotifyPlaylistUrl(value: string | null | undefined): string | null {
  const url = publicHttpsUrl(value);
  if (!url || url.hostname !== 'open.spotify.com' || url.hash) return null;
  if ([...url.searchParams.keys()].some(key => key !== 'si') || url.searchParams.getAll('si').length > 1) return null;
  const playlistId = /^\/playlist\/([a-zA-Z0-9]{22})\/?$/.exec(url.pathname)?.[1];
  if (!playlistId) return null;
  return `https://open.spotify.com/playlist/${playlistId}`;
}
