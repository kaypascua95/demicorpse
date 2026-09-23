import { type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode, useCallback, useId, useState } from "react";
import { cn } from "@/lib/utils";
export type SqueezeSlide={id?:string|number;title:string;description?:string;image?:string;imageAlt?:string;background?:string;overlay?:ReactNode;action?:string;href?:string;onAction?:()=>void};
type Size=number|string; const size=(v:Size)=>typeof v==="number"?`${v}px`:v;
export function SqueezeCarousel({slides,defaultIndex=0,height="clamp(220px,32cqi,360px)",gap=16,radius=6,duration=900,controls=true,label="Featured",className,...props}:{slides:SqueezeSlide[];defaultIndex?:number;height?:Size;gap?:Size;radius?:Size;duration?:number;controls?:boolean;label?:string;className?:string}&Omit<ComponentProps<"div">,"onSelect">){
 const [open,setOpen]=useState(defaultIndex); const id=useId(); const count=slides.length;
 const step=useCallback((by:number)=>setOpen(v=>(v+by+count)%count),[count]);
 const onKey=(e:KeyboardEvent<HTMLDivElement>)=>{if(e.key==="ArrowRight"){e.preventDefault();step(1)}if(e.key==="ArrowLeft"){e.preventDefault();step(-1)}};
 if(!count)return null;
 return <div {...props} className={cn("journal-squeeze",className)} style={{"--sq-h":size(height),"--sq-gap":size(gap),"--sq-radius":size(radius),"--sq-ms":`${duration}ms`} as CSSProperties}>
  {controls&&count>1&&<div className="journal-squeeze-controls"><button onClick={()=>step(-1)} aria-label="Previous">←</button><button onClick={()=>step(1)} aria-label="Next">→</button></div>}
  <div className="journal-squeeze-strip" role="tablist" aria-label={label} onKeyDown={onKey}>
   {slides.map((slide,i)=><button key={slide.id??i} id={`${id}-${i}`} role="tab" aria-selected={i===open} onClick={()=>setOpen(i)} className={cn("journal-squeeze-panel",i===open&&"is-open")} style={{background:slide.background}}>
    {slide.image&&<img src={slide.image} alt={slide.imageAlt??""}/>} {slide.overlay&&<span className="journal-squeeze-overlay">{slide.overlay}</span>}
   </button>)}
  </div>
  <div className="journal-squeeze-copy">{slides.map((slide,i)=><div key={slide.id??i} className={cn("journal-squeeze-copy-item",i===open&&"is-open")}><p><strong>{slide.title}</strong>{slide.description&&<> <span>{slide.description}</span></>}</p>{slide.action&&(slide.href?<a href={slide.href}>{slide.action} →</a>:<button onClick={slide.onAction}>{slide.action} →</button>)}</div>)}</div>
 </div>;
}