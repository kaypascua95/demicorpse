import { motion, useReducedMotion } from 'framer-motion';
const copy: Record<string, [string, string]> = {
  journal: ['JOURNAL', 'The words are still finding their way here.'],
  fragments: ['FRAGMENTS', 'Small things are being gathered.'],
  gallery: ['GALLERY', 'The photographs are still developing.'],
  'dear-moon': ['DEAR MOON', 'A collection of prose and poetry, coming soon.'],
  play: ['PLAY', 'The other lives are still loading.'],
  archive: ['ARCHIVE', 'Not everything has been filed yet.'],
  colophon: ['COLOPHON', 'The details are still being written.'],
};
const ease = [.16, 1, .3, 1] as const;
export default function ComingSoon({ page }: { page: string }) {
  const [title, note] = copy[page] || ['DEMICORPSE', 'This room is not ready yet.'];
  const reduced = useReducedMotion();
  return <main className="coming-page"><div className="coming-inner">
    <motion.span initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 1.2, ease }}>COMING SOON</motion.span>
    <div className="coming-title-mask"><motion.h1 initial={reduced ? false : { y: '110%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }} transition={{ delay: reduced ? 0 : .3, duration: reduced ? 0 : 1.65, ease }}>{title}</motion.h1></div>
    <motion.p initial={reduced ? false : { opacity: 0, y: 16, filter: 'blur(5px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: reduced ? 0 : 1.05, duration: reduced ? 0 : 1.6, ease }}>{note}</motion.p>
  </div><motion.footer initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
    transition={{ delay: reduced ? 0 : 2.1, duration: reduced ? 0 : 1.2 }}><span>DEMICORPSE</span></motion.footer></main>;
}
