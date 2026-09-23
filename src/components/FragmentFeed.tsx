import { useState } from 'react';
import { Markdown, Media } from '@/components/CmsContent';
import { Marquee } from '@/components/ui/marquee';
import { entryTimestamp, type Entry } from '@/lib/cms';
import { SiteLink } from '@/lib/navigation';

function FragmentCard({ entry, onImage }: { entry: Entry; onImage: (path:string)=>void }) {
  const lead=entry.cover_image||entry.media[0];
  return <article className="fragment-marquee-card">
    <header><time dateTime={entry.published_at || entry.created_at}>{entryTimestamp(entry)}</time><span>{entry.media.length?'EVIDENCE':'THOUGHT'}</span></header>
    {lead && <button className="fragment-marquee-media" onClick={()=>/\.(jpg|png|webp|gif)$/.test(lead)&&onImage(lead)}><Media path={lead} alt={entry.content.replace(/[#*_\x60]/g,'').slice(0,120)}/></button>}
    <div className="fragment-marquee-copy"><Markdown content={entry.content.trim()}/></div>
    <footer><SiteLink href={`/fragments/${entry.slug}`}>OPEN ↗</SiteLink>{entry.media.length>1&&<span>+{entry.media.length-1} MORE</span>}</footer>
  </article>;
}
export default function FragmentFeed({entries}:{entries:Entry[]}) {
  const [lightbox,setLightbox]=useState<string|null>(null);
  if(!entries.length) return <section className="fragment-marquee-empty"><span>NO FRAGMENTS YET</span><p>The timeline is waiting for its first little piece of evidence.</p></section>;
  const midpoint=Math.ceil(entries.length/2), first=entries.slice(0,midpoint), second=entries.slice(midpoint);
  return <section className="fragment-marquee-stage" aria-label="Fragments">
    <div className="fragment-marquee-columns">
      <Marquee pauseOnHover vertical repeat={entries.length<3?4:2} className="fragment-marquee-track [--duration:34s]">
        {first.map(entry=><FragmentCard key={entry.id} entry={entry} onImage={setLightbox}/>)}
      </Marquee>
      <Marquee reverse pauseOnHover vertical repeat={entries.length<3?4:2} className="fragment-marquee-track fragment-marquee-second [--duration:38s]">
        {(second.length?second:first).map(entry=><FragmentCard key={entry.id} entry={entry} onImage={setLightbox}/>)}
      </Marquee>
    </div>
    <div className="fragment-marquee-fade fragment-marquee-fade-top"/><div className="fragment-marquee-fade fragment-marquee-fade-bottom"/>
    {lightbox&&<div className="fragment-lightbox" role="dialog" aria-modal="true" onClick={()=>setLightbox(null)}><button aria-label="Close image">×</button><div onClick={e=>e.stopPropagation()}><Media path={lightbox}/></div></div>}
  </section>;
}
