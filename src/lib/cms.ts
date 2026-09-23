import { createClient } from '@supabase/supabase-js';

export const collections = ['journal', 'fragments', 'play', 'archive'] as const;
export type Collection = typeof collections[number];
export type Entry = {
  id: string; collection: Collection; title: string; slug: string; excerpt: string;
  content: string; game: string; type: string; description: string;
  cover_image: string | null; media: string[]; date: string;
  status: 'draft' | 'published'; tags: string[]; published_at: string | null;
  created_at: string; updated_at: string;
};
export type EntryInput = Omit<Entry, 'created_at' | 'updated_at' | 'published_at'>;
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cms = url && key ? createClient(url, key, {
  auth: { storage: window.sessionStorage, detectSessionInUrl: false },
}) : null;
// Public reads never inherit the owner's session, so public previews obey the
// same policies as visitors even when opened from an authenticated admin tab.
export const publicCms = url && key ? createClient(url, key, {
  auth: { storageKey: "demicorpse-public", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) : null;
export function client() {
  if (!cms) throw new Error('Publishing has not been connected yet. See the setup guide.');
  return cms;
}
export function newEntry(collection: Collection): EntryInput {
  const id = crypto.randomUUID();
  return { id, collection, title: '', slug: id, excerpt: '', content: '', game: '', type: '',
    description: '', cover_image: null, media: [], date: new Date().toLocaleDateString('en-CA'),
    status: 'draft', tags: [] };
}
export function slugify(title: string) {
  return title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180).replace(/-$/, '');
}
export function editable(entry: Entry): EntryInput {
  const { created_at, updated_at, published_at, ...input } = entry;
  return input;
}
export async function listEntries(collection: Collection, page = 0, admin = false) {
  const db = admin ? client() : publicCms;
  if (!db) return [];
  let query = db.from('cms_entries').select('*').eq('collection', collection);
  if (!admin) query = query.eq('status', 'published');
  const { data, error } = await query.order('date', { ascending: false }).order('id').range(page * 20, page * 20 + 19);
  if (error) throw error;
  return data as Entry[];
}
export async function saveEntry(entry: EntryInput, saved: boolean, version?: string) {
  const query = saved
    ? client().from('cms_entries').update(entry).eq('id', entry.id).eq('updated_at', version!)
    : client().from('cms_entries').insert(entry);
  const { data, error } = await query.select().single();
  if (error?.code === 'PGRST116') throw new Error('This entry changed in another window. Reopen it before saving.');
  if (error?.code === '23505') throw new Error('That address is already used. Choose a different slug.');
  if (error) throw error;
  return data as Entry;
}
export const mediaTypes: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg',
};
export async function uploadMedia(entryId: string, file: File) {
  if (!mediaTypes[file.type] || file.size > 25 * 1024 * 1024 || !file.size)
    throw new Error('Choose a JPG, PNG, WebP, GIF, MP4, WebM, MP3 or OGG file, up to 25 MB.');
  const path = `${entryId}/${crypto.randomUUID()}.${mediaTypes[file.type]}`;
  const { error } = await client().storage.from('cms-media').upload(path, file, { upsert: false, cacheControl: '0' });
  if (error) throw error;
  return path;
}
export async function removeMedia(paths: string[]) {
  if (!paths.length) return;
  const { error } = await client().storage.from('cms-media').remove([...new Set(paths)]);
  if (error) throw error;
}
export function errorMessage(error: unknown) {
  return error instanceof Error || (error && typeof error === 'object' && 'message' in error)
    ? String(error.message) : 'Something went wrong. Please try again.';
}
