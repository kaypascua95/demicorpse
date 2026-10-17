import { useEffect, useId, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import '../ink-calligraphy.css';

// Original, hand-drawn vector lettering. No font or image asset is required.
// Each thin pen path is also the reveal mask for its heavier downstrokes.
type Letter = { width: number; pen: string; pressure?: string };
const letters: Record<string, Letter> = {
  w: { width: 43, pen: 'M0 43 C5 41 9 30 12 24 C9 34 7 43 11 45 C16 47 21 33 24 25 C21 35 19 43 23 45 C29 48 36 33 37 25 C37 22 34 22 34 26 C34 32 38 43 43 43', pressure: 'M12 24 C9 34 7 43 11 45 M24 25 C21 35 19 43 23 45' },
  o: { width: 36, pen: 'M0 43 C6 41 10 28 19 25 C29 21 31 31 26 40 C22 48 12 47 12 39 C12 30 20 24 25 27 C22 35 28 44 36 43', pressure: 'M28 28 C29 32 27 38 24 42 M12 39 C12 33 15 28 20 26' },
  r: { width: 30, pen: 'M0 43 C6 39 10 29 13 24 C10 26 12 30 17 29 C26 24 26 26 22 32 C17 41 20 47 30 43', pressure: 'M22 32 C17 41 20 47 26 45' },
  d: { width: 38, pen: 'M0 43 C6 40 9 29 18 26 C27 23 29 29 24 38 C18 48 10 46 12 37 C14 28 23 24 28 27 C33 17 40 1 35 3 C30 4 24 28 23 38 C21 47 28 47 38 43', pressure: 'M12 37 C14 28 20 25 24 26 M33 10 C29 18 24 31 23 38 C21 44 24 47 28 46' },
  s: { width: 30, pen: 'M0 43 C7 40 13 30 17 24 C17 31 13 34 16 38 C21 43 20 49 13 48 C8 47 11 42 16 43 C20 46 25 46 30 43', pressure: 'M17 24 C17 31 13 34 16 38 C19 41 20 45 17 47' },
  ',': { width: 15, pen: 'M4 48 C8 45 8 51 2 55', pressure: 'M4 48 C8 45 8 51 5 53' },
  a: { width: 35, pen: 'M0 43 C5 40 9 29 18 26 C28 22 30 29 24 38 C19 47 10 46 12 38 C14 29 21 24 27 26 C24 33 20 44 25 46 C28 47 32 44 35 43', pressure: 'M12 38 C14 29 21 24 27 26 M27 26 C24 33 20 44 25 46' },
  n: { width: 37, pen: 'M0 43 C5 41 10 31 13 25 L8 43 C15 31 21 22 27 26 C31 29 21 41 26 45 C29 47 33 44 37 43', pressure: 'M13 25 L8 43 M27 26 C31 29 21 41 26 45' },
  e: { width: 29, pen: 'M0 43 C8 40 21 32 20 27 C18 20 9 29 9 38 C9 48 18 48 29 43', pressure: 'M12 28 C9 32 8 39 11 43 C13 47 18 47 21 46' },
  v: { width: 32, pen: 'M0 43 C5 40 10 31 13 25 C10 34 7 44 12 46 C18 48 27 32 27 26 C27 22 23 25 25 31 C26 36 28 42 32 43', pressure: 'M13 25 C10 34 7 44 12 46' },
  y: { width: 36, pen: 'M0 43 C5 40 9 30 12 25 C9 34 7 43 12 44 C18 45 24 32 27 25 C22 40 18 57 10 64 C3 70 1 62 9 56 C17 51 27 48 36 43', pressure: 'M12 25 C9 34 7 43 12 44 M27 25 C22 40 18 57 10 64' },
  t: { width: 26, pen: 'M0 43 C8 35 19 16 23 7 C18 18 10 35 11 42 C12 48 19 47 26 43 M7 26 C14 25 21 24 28 25', pressure: 'M21 12 C17 22 10 36 11 42 C12 46 15 47 18 46' },
  h: { width: 37, pen: 'M0 43 C9 36 29 8 23 3 C17 -2 12 21 7 44 C15 32 21 23 27 26 C32 29 21 41 26 45 C29 47 33 44 37 43', pressure: 'M19 5 C14 12 10 30 7 44 M27 26 C32 29 21 41 26 45' },
  i: { width: 22, pen: 'M0 43 C6 40 10 31 13 26 C10 34 6 43 11 46 C14 47 18 44 22 43 M16 16 L16.6 15', pressure: 'M13 26 C10 34 6 43 11 46' },
  g: { width: 38, pen: 'M0 43 C6 40 9 29 18 26 C28 22 30 29 24 38 C19 47 10 46 12 38 C14 29 22 24 28 26 C24 39 20 57 12 64 C5 70 2 62 10 56 C17 51 28 47 38 43', pressure: 'M12 38 C14 29 21 24 27 26 M28 26 C24 39 20 57 12 64' },
  b: { width: 35, pen: 'M0 43 C9 35 29 8 23 3 C17 -2 10 24 9 39 C9 49 20 47 26 37 C33 24 21 22 18 28 C15 36 26 46 35 43', pressure: 'M19 5 C14 12 10 27 9 39 C9 44 12 46 16 45 M27 28 C30 31 28 37 24 41' },
};

const phrase = 'words, words and everything in between';
const lines = ['words, words and', 'everything in between'];
// Keep the completed inscription across CMS rerenders and route remounts.
// A fresh page load is a fresh reading, but hover/focus never starts it again.
let hasWritten = false;

function makeLine(text: string, firstIndex: number) {
  let x = 10;
  let index = firstIndex;
  const glyphs = Array.from(text).flatMap((character) => {
    if (character === ' ') { x += 19; return []; }
    const letter = letters[character];
    const glyph = { ...letter, x, index: index++ };
    x += letter.width;
    return [glyph];
  });
  return { glyphs, width: x + 12, nextIndex: index };
}
const firstLine = makeLine(lines[0], 0);
const secondLine = makeLine(lines[1], firstLine.nextIndex);
const inscription = [firstLine, secondLine];

export function InkCalligraphy({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reducedMotion = useReducedMotion();
  const [alreadyWritten] = useState(() => hasWritten);
  const started = alreadyWritten || inView || !!reducedMotion;
  const instant = alreadyWritten || !!reducedMotion;

  useEffect(() => {
    if (started) hasWritten = true;
  }, [started]);

  return <div ref={ref} className={`ink-calligraphy ${className}`} data-ink-started={started}>
    <span className="ink-calligraphy-readable">{phrase}</span>
    <div className="ink-calligraphy-lines" aria-hidden="true">
      {inscription.map((line, lineIndex) => <svg
        key={lineIndex}
        className={`ink-calligraphy-line ink-calligraphy-line-${lineIndex + 1}`}
        viewBox={`0 -5 ${line.width} 85`}
        focusable="false"
        style={{ flexGrow: line.width }}
      >
        {line.glyphs.map((glyph) => {
          const mask = `${id}-ink-${glyph.index}`;
          return <g key={glyph.index} transform={`translate(${glyph.x} 0)`}>
            <defs>
              <mask id={mask} maskUnits="userSpaceOnUse" x="-6" y="-10" width={glyph.width + 22} height="90">
                <motion.path
                  className="ink-calligraphy-mask"
                  d={glyph.pen}
                  fill="none"
                  stroke="white"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: instant ? 1 : 0 }}
                  animate={{ pathLength: started ? 1 : 0 }}
                  transition={instant ? { duration: 0 } : {
                    duration: 0.38,
                    delay: 0.18 + glyph.index * 0.105,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              </mask>
            </defs>
            <g mask={`url(#${mask})`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d={glyph.pen} strokeWidth="0.95" />
              {glyph.pressure && <path d={glyph.pressure} strokeWidth="2.35" />}
            </g>
          </g>;
        })}
      </svg>)}
    </div>
  </div>;
}

export default InkCalligraphy;
