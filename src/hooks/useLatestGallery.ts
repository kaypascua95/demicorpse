import { useEffect, useState } from 'react';
import { publicCms } from '@/lib/cms';
import { GALLERY_CHANGE_EVENT, GALLERY_CHANGE_KEY } from '@/lib/gallery-updates';

export type Photograph = {
  id: string; caption: string; image_url: string; storage_path: string | null;
  date: string; location: string; created_at: string; updated_at: string;
};
export type ResolvedPhotograph = Photograph & { src: string };
type LoadState = 'loading' | 'ready' | 'error';

/** Upload & publish inserts a new gallery row after Storage succeeds. Its server
 * created_at is upload order; the editable photo date is not upload order. */
export function useLatestGallery(attempt: number) {
  const [photographs, setPhotographs] = useState<ResolvedPhotograph[]>([]);
  const [galleryState, setGalleryState] = useState<LoadState>('loading');
  useEffect(() => {
    let active = true, inFlight = false, queued = false, signature = '';
    let displayedUrls: string[] = [];
    const ownedUrls = new Set<string>();
    const retirementFrames = new Set<number>();
    setPhotographs([]);
    setGalleryState('loading');
    const revoke = (url: string) => { URL.revokeObjectURL(url); ownedUrls.delete(url); };

    async function refresh() {
      if (!active) return;
      if (inFlight) { queued = true; return; }
      if (!publicCms) { setGalleryState('ready'); return; }
      inFlight = true;
      try {
        const { data, error } = await publicCms.from('gallery_items')
          .select('id,caption,image_url,storage_path,date,location,created_at,updated_at')
          .eq('status', 'published')
          .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(4);
        if (error) throw error;
        if (!active) return;
        const rows = (data || []) as Photograph[];
        const nextSignature = JSON.stringify(rows);
        if (nextSignature === signature) { setGalleryState('ready'); return; }
        const nextUrls: string[] = [];
        const resolved = await Promise.all(rows.map(async photo => {
          if (photo.image_url) return { ...photo, src: photo.image_url };
          if (!photo.storage_path) return null;
          try {
            const { data: image, error: imageError } = await publicCms!.storage.from('cms-media').download(photo.storage_path);
            if (!active || imageError || !image) return null;
            const src = URL.createObjectURL(image);
            ownedUrls.add(src); nextUrls.push(src);
            return { ...photo, src };
          } catch { return null; }
        }));
        if (!active) { nextUrls.forEach(revoke); return; }
        const next = resolved.filter((photo): photo is ResolvedPhotograph => photo !== null);
        // A temporary failed download must not replace a working image with
        // an older photograph. Try the newest row again at the next refresh.
        if (rows.length && !resolved[0]) { nextUrls.forEach(revoke); throw new Error('Latest photograph is unavailable.'); }
        const previousUrls = displayedUrls;
        displayedUrls = nextUrls;
        // Retry a partially unavailable contact sheet on the next refresh.
        signature = next.length === rows.length ? nextSignature : '';
        setPhotographs(next); setGalleryState('ready');
        // Let React replace the old image before retiring its blob URL.
        const frame = requestAnimationFrame(() => { previousUrls.forEach(revoke); retirementFrames.delete(frame); });
        retirementFrames.add(frame);
      } catch {
        // Refresh failures retain the last good photograph; explicit Retry or
        // a route remount starts clean and still exposes a truthful error.
        if (active) setGalleryState('error');
      } finally {
        inFlight = false;
        if (active && queued) { queued = false; void refresh(); }
      }
    }
    const visibleRefresh = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    const storageRefresh = (event: StorageEvent) => { if (event.key === GALLERY_CHANGE_KEY) visibleRefresh(); };
    void refresh();
    window.addEventListener('focus', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    window.addEventListener(GALLERY_CHANGE_EVENT, visibleRefresh);
    window.addEventListener('storage', storageRefresh);
    // Covers uploads from another device without requiring Realtime setup.
    const interval = window.setInterval(visibleRefresh, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', visibleRefresh);
      document.removeEventListener('visibilitychange', visibleRefresh);
      window.removeEventListener(GALLERY_CHANGE_EVENT, visibleRefresh);
      window.removeEventListener('storage', storageRefresh);
      retirementFrames.forEach(cancelAnimationFrame);
      ownedUrls.forEach(url => URL.revokeObjectURL(url));
      ownedUrls.clear();
    };
  }, [attempt]);
  return { photographs, galleryState };
}
