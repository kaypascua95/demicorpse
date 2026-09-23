import { useEffect, useMemo, useState } from 'react';
import { Media } from '@/components/CmsContent';
import { entryTimestamp, errorMessage, listEntries, type Entry } from '@/lib/cms';
import { SiteLink } from '@/lib/navigation';

function safeVideoUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='www.twitch.tv'||u.hostname==='twitch.tv'||u.hostname==='youtu.be'||u.hostname==='www.youtube.com'||u.hostname==='youtube.com')?u.toString():''}catch{return ''}}
export default function Play(){
 const[entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('ALL');
 useEffect(()=>{listEntries('play').then(setEntries).catch(e=>setError(errorMessage(e))).finally(()=>setLoading(false))},[]);
 const games=useMemo(()=>Array.from(new Set(entries.map(e=>e.game).filter(Boolean))),[entries]);
 const visible=filter==='ALL'?entries:entries.filter(e=>e.game===filter||e.tags.includes(filter));
 const featured=entries.find(e=>e.featured)||entries[0];
 if(loading)return <main className="inner-page"><p className="cms-muted">Opening the archive…</p></main>;
 return <main className="inner-page play-page"><header className="page-head"><span>05 / PLAY</span><h1>The other lives<br/><em>I live.</em></h1><p>Streams, late nights, clips, and the worlds I disappear into for a while.</p></header>
 {error&&<p role="alert">{error}</p>}
 {featured&&<section className="play-feature"><div className="play-feature-media">{featured.cover_image?<Media path={featured.cover_image}/>:<div className="play-placeholder">DEMICORPSE / VOD</div>}</div><div className="play-feature-copy"><p className="cms-eyebrow">FEATURED / {featured.game||'STREAM'}</p><h2>{featured.title}</h2><p>{featured.excerpt||featured.content.slice(0,180)}</p><p className="cms-muted">{entryTimestamp(featured)}{featured.duration?` · ${featured.duration}`:''}</p><div className="cms-actions"><SiteLink className="cms-button" href={`/play/${featured.slug}`}>View entry →</SiteLink>{safeVideoUrl(featured.video_url)&&<a className="cms-button cms-primary" href={safeVideoUrl(featured.video_url)} target="_blank" rel="noopener noreferrer">Watch VOD ↗</a>}</div></div></section>}
 {!!entries.length&&<><nav className="play-filters" aria-label="Filter streams">{['ALL',...games].map(item=><button key={item} aria-pressed={filter===item} onClick={()=>setFilter(item)}>{item}</button>)}</nav><section className="play-grid">{visible.map(entry=><article className="play-card" key={entry.id}><SiteLink href={`/play/${entry.slug}`}><div className="play-card-media">{entry.cover_image?<Media path={entry.cover_image}/>:<div className="play-placeholder">VOD</div>}</div><time>{entryTimestamp(entry)}</time><h2>{entry.title}</h2><p>{entry.game}{entry.duration?` · ${entry.duration}`:''}</p></SiteLink>{safeVideoUrl(entry.video_url)&&<a className="play-watch" href={safeVideoUrl(entry.video_url)} target="_blank" rel="noopener noreferrer">WATCH VOD ↗</a>}</article>)}</section></>}
 {!entries.length&&!error&&<section className="cms-empty"><h2>Nothing archived <em>yet.</em></h2><p>The first stream will appear here when you publish it from Admin.</p></section>}
 </main>
}