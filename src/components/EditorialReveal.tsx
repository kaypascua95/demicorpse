import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Same unhurried reveal language as Dear Moon, once per mounted text block. */
export function EditorialReveal({ as = 'div', children, className = '', delay = 0 }: {
  as?: 'div' | 'p' | 'h2'; children: ReactNode; className?: string; delay?: number;
}) {
  const reduced = useReducedMotion();
  const Tag = as === 'p' ? motion.p : as === 'h2' ? motion.h2 : motion.div;
  return <Tag className={`newspaper-reveal ${className}`}
    initial={reduced ? false : { opacity: 0, y: 22, filter: 'blur(5px)' }}
    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ delay: reduced ? 0 : delay, duration: reduced ? 0 : 1.4, ease: [.16, 1, .3, 1] }}>
    {children}
  </Tag>;
}
