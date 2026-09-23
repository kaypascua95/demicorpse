"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface FilmstripImage { src:string; alt:string; caption?:string }
export interface FilmstripGalleryProps extends Omit<React.ComponentProps<"section">,"children"> {
 images:FilmstripImage[]; defaultIndex?:number; frameWidth?:number; aspect?:string; negative?:boolean; mask?:number;
 film?:string; stripColor?:string; inkColor?:string; showCaption?:boolean; showControls?:boolean; lightbox?:boolean;
}
const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n))
const look=(i:number,s:number,sa:number,h:number,c:number,b:number)=>`invert(${i}) sepia(${s}) saturate(${sa}) hue-rotate(${h}deg) contrast(${c}) brightness(${b})`
const POSITIVE=look(0,0,1,0,1,1)
function Arrow({dir}:{dir:"left"|"right"}){return <svg aria-hidden viewBox="0 0 16 16" className={cn("size-4",dir==="left"&&"rotate-180")} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8h10M9 4l4 4-4 4"/></svg>}
function Perforation({id}:{id:string}){return <svg aria-hidden className="block h-4 w-full" preserveAspectRatio="none"><defs><pattern id={id} width="22" height="16" patternUnits="userSpaceOnUse"><rect x="5" y="4" width="12" height="8" rx="2" fill="var(--color-background,#0d0d0c)" stroke="var(--fsg-ink)" strokeOpacity=".28"/></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`}/></svg>}
export function FilmstripGallery({images,defaultIndex=0,frameWidth=280,aspect="3 / 2",negative=true,mask=.6,film="35MM · ISO 400 · DEMICORPSE",stripColor="#24211e",inkColor="#d9c9a1",showCaption=true,showControls=true,lightbox=true,className,...rest}:FilmstripGalleryProps){
 const last=Math.max(0,images.length-1),[active,setActive]=React.useState(clamp(defaultIndex,0,last)),[open,setOpen]=React.useState(false)
 const refs=React.useRef<(HTMLLIElement|null)[]>([]),dialog=React.useRef<HTMLDialogElement|null>(null),uid=React.useId().replace(/[^a-zA-Z0-9]/g,"")
 const goTo=(i:number)=>{const next=clamp(i,0,last);setActive(next);refs.current[next]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})}
 React.useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open&&dialog.current?.open)dialog.current.close()},[open])
 const strength=clamp(mask,0,1),NEGATIVE=look(1,.3+.45*strength,.9+.5*strength,-14*strength,.9,.94)
 const control="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white transition hover:bg-white/10 disabled:opacity-30"
 return <section className={cn("relative w-full",className)} style={{"--fsg-strip":stripColor,"--fsg-ink":inkColor} as React.CSSProperties} {...rest}>
  <div className="relative w-full overflow-hidden rounded-sm" style={{background:"var(--fsg-strip)"}}>
   <Perforation id={uid+"t"}/>
   <ul role="list" aria-label="Frames" className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-[50%] py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {images.map((image,i)=>{const selected=i===active;return <li key={image.src+i} ref={n=>{refs.current[i]=n}} className="relative shrink-0 snap-center" style={{width:frameWidth}}>
     <div aria-hidden className="flex h-3 items-center justify-between px-1 font-mono text-[8px] uppercase tracking-[.18em] opacity-70" style={{color:"var(--fsg-ink)"}}><span>{String(i+1).padStart(2,"0")}</span><span>{i%3===0?film:""}</span><span>{String(i+1).padStart(2,"0")}A</span></div>
     <button type="button" aria-label={selected?`${image.alt}. Open print`:`Show ${image.alt}`} onClick={()=>selected&&lightbox?setOpen(true):goTo(i)} className="relative block w-full cursor-pointer overflow-hidden rounded-[2px]" style={{aspectRatio:aspect}}>
      <img src={image.src} alt="" draggable={false} className="block h-full w-full object-cover transition duration-500" style={{filter:selected?POSITIVE:negative?NEGATIVE:"brightness(.72)",transform:selected?"scale(1)":"scale(.97)"}}/>
      {selected&&<span aria-hidden className="pointer-events-none absolute inset-0 ring-2 ring-inset" style={{color:"var(--fsg-ink)"}}/>}
     </button><div className="h-3"/>
    </li>})}
   </ul><Perforation id={uid+"b"}/>
  </div>
  {(showCaption||showControls)&&<div className="mt-4 flex items-center justify-between gap-4">
   {showCaption?<p className="min-w-0 text-sm opacity-70">{images[active]?.caption??images[active]?.alt}<span className="ml-2 font-mono text-xs">{String(active+1).padStart(2,"0")} / {String(images.length).padStart(2,"0")}</span></p>:<span/>}
   {showControls&&<div className="flex gap-2"><button className={control} disabled={active===0} onClick={()=>goTo(active-1)} aria-label="Previous frame"><Arrow dir="left"/></button><button className={control} disabled={active===last} onClick={()=>goTo(active+1)} aria-label="Next frame"><Arrow dir="right"/></button></div>}
  </div>}
  {lightbox&&<dialog ref={dialog} onClose={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}} className="m-auto max-h-[100dvh] max-w-[100vw] bg-transparent p-5 text-white backdrop:bg-black/90 backdrop:backdrop-blur-sm"><div className="flex flex-col items-center gap-4"><img src={images[active]?.src} alt={images[active]?.alt??""} className="max-h-[80dvh] max-w-full object-contain shadow-2xl"/><p className="text-sm opacity-70">{images[active]?.caption??images[active]?.alt}</p><button className={control} onClick={()=>setOpen(false)} aria-label="Close">×</button></div></dialog>}
 </section>
}
export default FilmstripGallery
