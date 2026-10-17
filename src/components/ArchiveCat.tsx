import { useEffect, useRef, useState, type CSSProperties } from 'react';
import '@/archive-cat.css';

/** An authorized, locally hosted sprite sheet with equal, unpadded grid cells. */
export interface ArchiveCatSpriteConfig {
  src: string;
  columns: number;
  rows: number;
  frameCount: number;
  fps: number;
  /** Zero-based frame shown when animation is disabled. */
  staticFrame: number;
  /** Extra quiet time on the first idle frame between loops. */
  restMs?: number;
}

export interface ArchiveCatProps {
  /** No default art: absent or invalid configuration renders nothing. */
  sprite?: ArchiveCatSpriteConfig | null;
  className?: string;
}

const HIDDEN_KEY = 'demicorpse.archive-cat.hidden';

function validSprite(sprite: ArchiveCatSpriteConfig | null | undefined): sprite is ArchiveCatSpriteConfig {
  if (!sprite || typeof sprite.src !== 'string') return false;
  // Only project-local paths are allowed. In particular, reject protocol-relative
  // URLs, backslash URL normalization, embedded whitespace and data URLs.
  if (!/^\/(?![\/\\])[^\\\u0000-\u0020]*$/.test(sprite.src)) return false;
  const { columns, rows, frameCount, fps, staticFrame, restMs = 0 } = sprite;
  return Number.isSafeInteger(columns) && columns > 0 && columns <= 64
    && Number.isSafeInteger(rows) && rows > 0 && rows <= 64
    && Number.isSafeInteger(frameCount) && frameCount > 0 && frameCount <= columns * rows
    && Number.isFinite(fps) && fps > 0 && fps <= 60
    && Number.isFinite(restMs) && restMs >= 0 && restMs <= 60000
    && Number.isSafeInteger(staticFrame) && staticFrame >= 0 && staticFrame < frameCount;
}

function readHidden() {
  try { return typeof window !== 'undefined' && window.sessionStorage.getItem(HIDDEN_KEY) === '1'; }
  catch { return false; }
}

function SpriteDock({ sprite, className }: { sprite: ArchiveCatSpriteConfig; className?: string }) {
  const { src, columns, rows, frameCount, fps, staticFrame, restMs = 0 } = sprite;
  const dockRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(readHidden);
  const [frame, setFrame] = useState(staticFrame);
  const [cell, setCell] = useState<{ width: number; height: number } | null>(null);
  // Start paused until both accessibility preferences and visibility are known.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [pageVisible, setPageVisible] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const image = new Image();
    let active = true;
    image.onload = () => {
      if (!active || !image.naturalWidth || !image.naturalHeight
        || image.naturalWidth % columns !== 0 || image.naturalHeight % rows !== 0) return;
      setCell({ width: image.naturalWidth / columns, height: image.naturalHeight / rows });
    };
    image.onerror = () => { if (active) setCell(null); };
    image.src = src;
    return () => { active = false; image.onload = null; image.onerror = null; };
  }, [src, columns, rows]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState === 'visible');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(Boolean(entry?.isIntersecting));
    });
    observer.observe(dock);
    return () => observer.disconnect();
  }, [cell]);

  const animate = Boolean(cell) && !hidden && !reducedMotion && pageVisible && inView && frameCount > 1;
  useEffect(() => {
    if (!animate) return;
    // Original frames only, with a quiet resting hold between blink loops.
    const timer = window.setTimeout(() => setFrame(value => (value + 1) % frameCount),
      1000 / fps + (frame === 0 ? restMs : 0));
    return () => window.clearTimeout(timer);
  }, [animate, fps, frameCount, frame, restMs]);

  if (!cell) return null;

  const displayFrame = reducedMotion ? staticFrame : frame;
  const column = displayFrame % columns;
  const row = Math.floor(displayFrame / columns);
  const style: CSSProperties = {
    '--archive-cat-ratio': cell.width / cell.height,
    aspectRatio: `${cell.width} / ${cell.height}`,
    backgroundImage: `url(${JSON.stringify(src)})`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${columns > 1 ? column / (columns - 1) * 100 : 0}% ${rows > 1 ? row / (rows - 1) * 100 : 0}%`,
  } as CSSProperties;

  function toggleHidden() {
    const nextHidden = !hidden;
    setHidden(nextHidden);
    try { window.sessionStorage.setItem(HIDDEN_KEY, nextHidden ? '1' : '0'); }
    catch { /* Decoration still works when storage is unavailable. */ }
  }

  return <div ref={dockRef} className={['archive-cat-dock', className].filter(Boolean).join(' ')}>
    {!hidden && <div className="archive-cat-sprite" aria-hidden="true" data-frame={displayFrame} data-paused={!animate} style={style} />}
    {/* Keep this same control mounted after hiding, so keyboard focus is retained. */}
    <button className="archive-cat-toggle" type="button" aria-label={hidden ? 'Show cat' : 'Hide cat'} onClick={toggleHidden}>
      {hidden ? 'Show cat' : <span aria-hidden="true">×</span>}
    </button>
  </div>;
}

/** Mount only in entered public-page content, never in the intro or admin UI. */
export function ArchiveCat({ sprite, className }: ArchiveCatProps) {
  if (!validSprite(sprite)) return null;
  // Reset loading and frame state whenever the sheet's grid changes.
  return <SpriteDock key={JSON.stringify(sprite)} sprite={sprite} className={className} />;
}

// Owner-supplied Morrow artwork: six clean original idle frames. Only their
// shared transparent canvas was trimmed when packing this lightweight sheet.
export const morrowIdleSprite: ArchiveCatSpriteConfig = {
  src: '/morrow-idle.png', columns: 6, rows: 1, frameCount: 6,
  fps: 5, staticFrame: 0, restMs: 2400,
};
