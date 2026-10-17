// A timestamp-only notification. No account information or credentials cross tabs.
export const GALLERY_CHANGE_EVENT = 'demicorpse:gallery-changed';
export const GALLERY_CHANGE_KEY = 'demicorpse-gallery-updated';
export function notifyGalleryChanged() {
  window.dispatchEvent(new Event(GALLERY_CHANGE_EVENT));
  try { window.localStorage.setItem(GALLERY_CHANGE_KEY, String(Date.now())); } catch { /* Focus/poll refresh still works. */ }
}
