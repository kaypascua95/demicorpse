import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { Bold, Code, ImagePlus, Italic, Link, List, ListOrdered, LoaderCircle, Paperclip, Quote, Send, Trash2, X } from 'lucide-react';
import { editable, errorMessage, mediaTypes, newEntry, removeMedia, saveEntry, uploadMedia, type Entry } from '@/lib/cms';

export default function FragmentComposer({ onPublished }: { onPublished: (entry: Entry) => void }) {
  const [textValue, setTextValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  function format(before: string, after = before) { const el=editor.current;if(!el)return;const start=el.selectionStart,end=el.selectionEnd,selected=textValue.slice(start,end);setTextValue(textValue.slice(0,start)+before+selected+after+textValue.slice(end));requestAnimationFrame(()=>{el.focus();el.setSelectionRange(start+before.length,end+before.length);}); }
  const tools=[['Bold',Bold,()=>format('**')],['Italic',Italic,()=>format('*')],['Quote',Quote,()=>format('> ','')],['Bullet list',List,()=>format('- ','')],['Numbered list',ListOrdered,()=>format('1. ','')],['Code',Code,()=>format('`')],['Link',Link,()=>format('[','](https://)')]] as const;

  function addFiles(incoming: File[]) {
    const valid = incoming.filter(file => mediaTypes[file.type] && file.size > 0 && file.size <= 25 * 1024 * 1024);
    setFiles(current => [...current, ...valid].slice(0, 12));
    if (valid.length !== incoming.length) setError('Some files were skipped. Use images, GIFs, MP4/WebM video or MP3/OGG audio up to 25 MB each.');
    else setError('');
  }
  function onDrop(event: DragEvent) { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }
  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length) { event.preventDefault(); addFiles(pasted); }
  }
  async function publish() {
    if ((!textValue.trim() && !files.length) || busy) return;
    setBusy(true); setError('');
    let saved: Entry | null = null; const paths: string[] = [];
    try {
      const draft = newEntry('fragments');
      draft.content = textValue.trim() || ' ';
      saved = await saveEntry(draft, false);
      for (const file of files) paths.push(await uploadMedia(saved.id, file));
      const next = editable(saved); next.media = paths; next.cover_image = paths.find(path => /\.(jpg|png|webp|gif)$/.test(path)) || null; next.status = 'published';
      saved = await saveEntry(next, true, saved.updated_at);
      setTextValue(''); setFiles([]); onPublished(saved);
    } catch (cause) {
      if (saved && paths.length) await removeMedia(paths).catch(() => {});
      setError(errorMessage(cause));
    } finally { setBusy(false); }
  }
  return <section className="fragment-composer" onDragOver={event => event.preventDefault()} onDrop={onDrop}>
    <div className="fragment-composer-label"><span>QUICK CAPTURE</span><span>text · markdown · media</span></div>
    <div className="trace-toolbar">{tools.map(([label,Icon,action])=><button key={label} type="button" title={label} aria-label={label} onClick={action}><Icon size={15}/></button>)}<button type="button" className="trace-clear" title="Clear" aria-label="Clear" onClick={()=>setTextValue('')}><Trash2 size={15}/></button></div>
    <textarea ref={editor} value={textValue} onChange={e => setTextValue(e.target.value)} onPaste={onPaste}
      placeholder="Leave a fragment…" aria-label="New fragment" rows={4} maxLength={200000} />
    {!!files.length && <div className="fragment-file-preview">{files.map((file, index) => <div key={file.name + file.lastModified + index}>
      {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} alt="" /> : <span><Paperclip size={16}/>{file.name}</span>}
      <button aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X size={14}/></button>
    </div>)}</div>}
    {error && <p className="cms-message cms-error" role="alert">{error}</p>}
    <div className="fragment-composer-actions">
      <div><button className="fragment-icon-button" onClick={() => input.current?.click()} title="Add media"><ImagePlus size={18}/><span>Add media</span></button>
      <span className="fragment-drop-hint">or drop / paste files here</span></div>
      <button className="fragment-publish" disabled={busy || (!textValue.trim() && !files.length)} onClick={publish}>
        {busy ? <><LoaderCircle className="fragment-spin" size={16}/> Posting…</> : <><Send size={15}/> Post fragment</>}
      </button>
    </div>
    <input ref={input} hidden type="file" multiple accept={Object.keys(mediaTypes).join(',')} onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value=''; }} />
  </section>;
}
