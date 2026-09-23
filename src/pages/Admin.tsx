import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EntryView, Media } from '@/components/CmsContent';
import { client, cms, collections, editable, errorMessage, listEntries, mediaTypes, newEntry, removeMedia, saveEntry, slugify, uploadMedia, type Collection, type Entry, type EntryInput } from '@/lib/cms';
import { SiteLink } from '@/lib/navigation';
import OwnerMfa from '@/components/OwnerMfa';

export default function Admin() {
  const [access, setAccess] = useState<'checking' | 'login' | 'denied' | 'mfa' | 'owner'>('checking');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [collection, setCollection] = useState<Collection>('journal');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<EntryInput | null>(null);
  const [savedEntry, setSavedEntry] = useState<Entry | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const authGeneration = useRef(0);

  useEffect(() => {
    if (!cms) { setAccess('login'); return; }
    let alive = true;
    const check = async () => {
      const generation = ++authGeneration.current;
      try {
        const { data: { session }, error } = await client().auth.getSession();
        if (error) throw error;
        const identity = session ? await client().rpc('cms_is_owner_account') : null;
        if (identity?.error) throw identity.error;
        const result = identity?.data === true ? await client().rpc('cms_is_owner') : null;
        if (result?.error) throw result.error;
        if (!alive || generation !== authGeneration.current) return;
        const next = !session ? 'login' : identity?.data !== true ? 'denied' : result?.data === true ? 'owner' : 'mfa';
        setAccess(next);
        if (next !== 'owner') { setDraft(null); setSavedEntry(null); setEntries([]); setDirty(false); }
      } catch (error) { if (alive) { setAccess('login'); setError(errorMessage(error)); } }
    };
    void check();
    const { data: { subscription } } = cms.auth.onAuthStateChange(() => {
      // Defer database calls until the auth callback releases its internal lock.
      window.setTimeout(() => { if (alive) void check(); }, 0);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (access !== 'owner') return;
    let active = true; setListLoading(true);
    listEntries(collection, page, true).then(data => { if (active) setEntries(data); })
      .catch(error => { if (active) setError(errorMessage(error)); })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [access, collection, page, revision]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    const navigate = (event: Event) => {
      if (busy || (dirty && !window.confirm('Leave without saving your changes?'))) event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('demicorpse:before-navigate', navigate);
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener('demicorpse:before-navigate', navigate); };
  }, [dirty, busy]);

  function change(field: keyof EntryInput, value: string | string[] | null) {
    setDraft(current => current ? { ...current, [field]: value } : current); setDirty(true); setNotice('');
  }
  function choose(entry: Entry | null, next = collection) {
    if (busy || (dirty && !window.confirm('Discard unsaved changes?'))) return;
    setDraft(entry ? editable(entry) : newEntry(next)); setSavedEntry(entry); setDirty(false); setPreview(false); setError(''); setNotice('');
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  async function persist(next: EntryInput) {
    const result = await saveEntry(next, !!savedEntry, savedEntry?.updated_at);
    setSavedEntry(result); setDraft(editable(result)); setDirty(false); setRevision(value => value + 1);
    return result;
  }
  function save(status: EntryInput['status']) {
    if (!draft) return;
    if (status === 'published' && !(draft.collection === 'fragments' ? draft.content.trim() : draft.title.trim())) {
      setError(draft.collection === 'fragments' ? 'Write your fragment before publishing.' : 'Add a title before publishing.'); return;
    }
    void run(async () => {
      await persist({ ...draft, status });
      setNotice(status === 'published' ? 'Published. Your entry is live.' : 'Draft saved. Only you can see it.');
    });
  }
  function upload(file?: File) {
    if (!file || !draft || !savedEntry) return;
    void run(async () => {
      const path = await uploadMedia(draft.id, file);
      const next = { ...draft, media: [...draft.media, path] };
      try { await persist(next); }
      catch (error) { await removeMedia([path]).catch(() => {}); throw error; }
      setNotice('Media uploaded and saved.');
    });
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const { error } = await client().auth.signInWithPassword({ email, password });
      setPassword(''); if (error) throw error;
    });
  }
  const fields = (name: keyof EntryInput, label: string, multiline = false, maxLength?: number) => <label className="cms-field" key={name}>{label}
    {multiline ? <textarea rows={name === 'content' || name === 'description' ? 14 : 3} maxLength={maxLength} value={String(draft?.[name] ?? '')} onChange={e => change(name, e.target.value)} />
      : <input type={name === 'date' ? 'date' : 'text'} required={name === 'date' || name === 'slug'} maxLength={maxLength} value={String(draft?.[name] ?? '')} onChange={e => change(name, e.target.value)} />}
  </label>;

  return <main className="inner-page cms-admin"><header className="cms-heading"><div><p className="cms-eyebrow">DEMICORPSE / PRIVATE</p><h1>Archive <em>control.</em></h1><p className="cms-muted">A place for the things you want to keep.</p></div>
    {access === 'owner' && <button className="cms-button" disabled={busy} onClick={() => {
      if (dirty && !window.confirm('Sign out and discard unsaved changes?')) return;
      void run(async () => { const { error } = await client().auth.signOut(); if (error) throw error; });
    }}>Sign out</button>}</header>
    {error && <p className="cms-message cms-error" role="alert">{error}</p>}
    {notice && <p className="cms-message" role="status">{notice}</p>}
    {!cms ? <section className="cms-login"><h2>The archive is being connected.</h2><p>Publishing will be available here once your private account is ready.</p></section>
      : access === 'checking' ? <p role="status">Checking your account…</p>
      : access === 'mfa' ? <OwnerMfa />
      : access === 'login' ? <form className="cms-login" onSubmit={login}><h2>Welcome back.</h2><p className="cms-muted">Sign in to tend your archive.</p>
        <label className="cms-field">Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="cms-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="cms-button cms-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>
      : access === 'denied' ? <section className="cms-login"><h2>This room is private.</h2><p>Your account does not have publishing access.</p><button className="cms-button" onClick={() => void run(async () => { const { error } = await client().auth.signOut(); if (error) throw error; })}>Sign out</button></section>
      : <><nav className="cms-tabs" aria-label="Collections">{collections.map(item => <button key={item} aria-current={collection === item ? 'page' : undefined} disabled={busy} onClick={() => {
        if (dirty && !window.confirm('Discard unsaved changes?')) return;
        setCollection(item); setPage(0); setDraft(null); setSavedEntry(null); setDirty(false); setPreview(false); setError(''); setNotice('');
      }}>{item}</button>)}</nav><div className="cms-workspace"><aside className="cms-sidebar"><button className="cms-button cms-primary" disabled={busy} onClick={() => choose(null)}>+ New {collection === 'fragments' ? 'fragment' : 'entry'}</button>
        {listLoading ? <p role="status">Loading entries…</p> : !entries.length ? <p className="cms-muted">An empty room. Start with a draft.</p> : entries.map(entry => <button className="cms-list-item" key={entry.id} disabled={busy} aria-pressed={draft?.id === entry.id} onClick={() => choose(entry)}><span>{entry.status} / {entry.date}</span><strong>{entry.title || entry.content.slice(0, 65) || 'Untitled draft'}</strong></button>)}
        <div className="cms-pagination">{page > 0 && <button disabled={busy} className="cms-button" onClick={() => setPage(page - 1)}>Newer</button>}{entries.length === 20 && <button disabled={busy} className="cms-button" onClick={() => setPage(page + 1)}>Older</button>}</div>
      </aside><section className="cms-editor">{!draft ? <div className="cms-empty"><h2>Still <em>becoming.</em></h2><p>Choose an entry, or start something new.</p></div> : <>
        <div className="cms-editor-top"><p className="cms-eyebrow">{savedEntry ? draft.status : 'NEW DRAFT'}{dirty ? ' / UNSAVED' : ''}</p><button className="cms-button" disabled={busy} onClick={() => setPreview(!preview)}>{preview ? 'Back to writing' : 'Preview'}</button></div>
        {preview ? <><p className="cms-preview-label">PRIVATE PREVIEW · includes unsaved changes</p><EntryView entry={draft} preview /></> : <form onSubmit={event => { event.preventDefault(); save(draft.status); }}><fieldset disabled={busy}>
          {collection !== 'fragments' && fields('title', 'Title', false, 300)}
          <div className="cms-field-row">{fields('date', 'Date')}{collection !== 'fragments' && fields('slug', 'Address / slug', false, 180)}</div>
          {collection !== 'fragments' && <button type="button" className="cms-text-button" onClick={() => change('slug', slugify(draft.title) || draft.id)}>Use title for address</button>}
          {collection === 'journal' && fields('excerpt', 'A few words before the entry', true, 2000)}
          {collection === 'play' && fields('game', 'Game', false, 300)}
          {collection === 'archive' && fields('type', 'Type of memory', false, 100)}
          {fields(collection === 'archive' ? 'description' : 'content', collection === 'fragments' ? 'Fragment' : 'Writing / Markdown', true, collection === 'archive' ? 20000 : 200000)}
          {collection === 'journal' && <label className="cms-field">Tags / separated by commas<input value={draft.tags.join(',')} onChange={e => change('tags', e.target.value.split(',').slice(0, 30))} /></label>}
          {collection !== 'fragments' && <section className="cms-uploads"><h3>Media</h3><p className="cms-muted">Images, audio, and video · up to 25 MB each. Save a draft before uploading. Uploads save your current edits.</p>
            <input ref={fileInput} type="file" aria-label="Upload media" accept={Object.keys(mediaTypes).join(',')} disabled={!savedEntry || draft.media.length >= 30} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            {draft.media.map(path => <div className="cms-upload" key={path}><Media path={path} preview /><div className="cms-actions">
              {/\.(jpg|png|webp|gif)$/.test(path) && <button type="button" className="cms-button" onClick={() => change('cover_image', draft.cover_image === path ? null : path)}>{draft.cover_image === path ? 'Remove cover' : 'Use as cover'}</button>}
              <button type="button" className="cms-button" onClick={() => {
                if (!window.confirm('Permanently remove this media? This also saves your current edits.')) return;
                void run(async () => { await persist({ ...draft, cover_image: draft.cover_image === path ? null : draft.cover_image, media: draft.media.filter(item => item !== path) }); await removeMedia([path]); setNotice('Media removed.'); });
              }}>Delete media</button></div></div>)}
          </section>}
          <div className="cms-actions"><button className="cms-button cms-primary" type="submit">{busy ? 'Saving…' : draft.status === 'published' ? 'Save published changes' : 'Save draft'}</button>
            {draft.status === 'draft' && <button className="cms-button" type="button" onClick={() => save('published')}>Publish</button>}
            {draft.status === 'published' && <button className="cms-button" type="button" onClick={() => { if (window.confirm('Unpublish this entry? It will become a private draft.')) save('draft'); }}>Unpublish</button>}
          </div>
        </fieldset></form>}
        {savedEntry && <div className="cms-editor-footer">{savedEntry.status === 'published' && <SiteLink href={`/${collection}/${savedEntry.slug}`}>View public entry →</SiteLink>}
          <button className="cms-text-button cms-danger" disabled={busy} onClick={() => {
            if (!window.confirm('Permanently delete this entry and all of its uploaded media?')) return;
            void run(async () => {
              const hidden = await saveEntry({ ...editable(savedEntry), status: 'draft' }, true, savedEntry.updated_at);
              setSavedEntry(hidden); setDraft(editable(hidden)); setDirty(false); setRevision(value => value + 1);
              // Unpublish before deleting media; failures leave a recoverable private draft.
              const { data: objects, error: listError } = await client().storage.from('cms-media').list(hidden.id, { limit: 1000 });
              if (listError) throw listError;
              await removeMedia((objects || []).map(object => `${hidden.id}/${object.name}`));
              const { data, error } = await client().from('cms_entries').delete().eq('id', hidden.id).eq('updated_at', hidden.updated_at).select('id').single();
              if (error || !data) throw error || new Error('Entry changed; reopen it to delete.');
              setDraft(null); setSavedEntry(null); setDirty(false); setRevision(value => value + 1); setNotice('Entry deleted.');
            });
          }}>Delete entry</button></div>}
      </>}</section></div></>}
  </main>;
}
