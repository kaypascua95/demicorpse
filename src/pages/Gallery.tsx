import { FilmstripGallery, type FilmstripImage } from "@/components/ui/filmstrip-gallery"

const images:FilmstripImage[]=[
 {src:"https://cdn.21st.dev/assets/mirror/ca/ca905300194e1d0ffc3223cfd3ba226477f36706c5461ffcd97c6f9e15344b8e.jpg",alt:"Mountains above cloud at sunrise",caption:"ordinary light — frame 01"},
 {src:"https://cdn.21st.dev/assets/mirror/39/396e97451e55c77f7cfd6ecc90ba207f12a606c5dfc6aa59fcdb52725bc2c75d.jpg",alt:"Rock pinnacles above hazy hills",caption:"somewhere I stopped — frame 02"},
 {src:"https://cdn.21st.dev/assets/mirror/61/61594ee61e92b6be0b47dad10261528fc8260d3d515846218ee0a47902f57d27.jpg",alt:"Sunlight through a forest path",caption:"the road kept the light — frame 03"},
 {src:"https://cdn.21st.dev/assets/mirror/41/41f5cd800f8ffac39cb893c6732da838cbc40ce82b1ea10fb71e3cbd1f5a3db8.jpg",alt:"Empty road through red rock",caption:"after dark, before home — frame 04"},
 {src:"https://cdn.21st.dev/assets/mirror/e4/e45c1ddf5f7ab48524d48682ba018968b1e4c1a2a21f75efea616d8c3b9578c9.jpg",alt:"Blue sea swell",caption:"things worth remembering — frame 05"},
]
export default function Gallery(){return <main className="inner-page"><header className="page-head"><span>03 / GALLERY</span><h1>Things<br/><em>I saw.</em></h1><p>Proof of ordinary days. Places, light, weather, blur, and whatever made me stop long enough to look.</p></header><section style={{marginTop:"clamp(3rem,8vw,7rem)",marginInline:"calc(50% - 50vw)",width:"100vw"}}><div style={{maxWidth:"1200px",margin:"0 auto",padding:"0 clamp(1rem,4vw,3rem)"}}><FilmstripGallery images={images} defaultIndex={2} frameWidth={300} aspect="3 / 2" negative mask={0.58} film="DEMICORPSE · 35MM · ARCHIVE" stripColor="#26221e" inkColor="#dfd0a8"/></div></section><p style={{marginTop:"2.5rem",opacity:.45,fontSize:".72rem",letterSpacing:".18em",textTransform:"uppercase"}}>scroll the roll · click the developed frame to open the print</p></main>}
