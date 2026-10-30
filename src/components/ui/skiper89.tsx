import { useEffect, useState, type RefObject } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { UnmakingReadingPlace } from '@/lib/unmaking-reading';

interface Skiper89Props {
  targetRef: RefObject<HTMLElement | null>;
  bookmark: UnmakingReadingPlace | null;
  hasLastRead: boolean;
  onSaveBookmark: () => void;
  onResumeBookmark: () => void;
  onResumeLatest: () => void;
  onRemoveBookmark: () => void;
}

/**
 * Adapted from the supplied Skiper89 demo. The same motion-driven circular
 * progress indicator is scoped to the chapter prose (not the entire site).
 * Uses installed framer-motion and a light tabular counter instead of adding
 * two redundant runtime packages. No demo filler or draggable CTA.
 */
export function Skiper89({
  targetRef, bookmark, hasLastRead,
  onSaveBookmark, onResumeBookmark, onResumeLatest, onRemoveBookmark,
}: Skiper89Props) {
  const [open, setOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const { scrollYProgress } = useScroll({ target: targetRef, offset: ['start start', 'end end'] });
  const clampedProgress = useTransform(scrollYProgress, value => Math.min(1, Math.max(0, value)));
  const percentage = useTransform(clampedProgress, value => Math.round(value * 100));

  useMotionValueEvent(percentage, 'change', value => setProgressPercent(value));
  useEffect(() => { setProgressPercent(percentage.get()); }, [percentage]);

  const svgRadius = 18;
  return <aside className="unmaking-progress-widget" aria-label="Chapter reading progress and bookmarks">
    <div className={cn('unmaking-progress-popup', open && 'is-open')} id="unmaking-progress-options" hidden={!open}>
      <span className="unmaking-progress-eyebrow">CHAPTER I / YOUR PLACE</span>
      <p className="unmaking-progress-heading">Your reading place.</p>
      <p className="unmaking-progress-description">Progress is saved in this browser as you read.</p>
      <div className="unmaking-progress-actions">
        <button type="button" onClick={() => { onSaveBookmark(); setOpen(false); }}>Save Bookmark</button>
        {bookmark && <button type="button" onClick={() => { onResumeBookmark(); setOpen(false); }}>
          Return to bookmark <span>{bookmark.percent}%</span>
        </button>}
        {hasLastRead && <button type="button" onClick={() => { onResumeLatest(); setOpen(false); }}>Resume last read</button>}
        {bookmark && <button type="button" className="unmaking-progress-remove" onClick={() => { onRemoveBookmark(); setOpen(false); }}>Remove bookmark</button>}
      </div>
    </div>
    <div className="unmaking-progress-affordance">
      <output className="unmaking-progress-tooltip" aria-live="off">{progressPercent}% of Chapter I</output>
      <motion.button
        type="button"
        className={cn('unmaking-progress-button', open && 'is-open', bookmark && 'has-bookmark')}
        aria-controls="unmaking-progress-options"
        aria-expanded={open}
        aria-label={'Chapter reading progress ' + progressPercent + ' percent. Open bookmark options'}
        onClick={() => setOpen(value => !value)}
        title="Reading progress and bookmarks"
      >
        <svg viewBox="0 0 48 48" className="unmaking-progress-ring" aria-hidden="true">
          <circle cx="24" cy="24" r={svgRadius} stroke="currentColor" strokeWidth="3" opacity=".22" fill="none"/>
          <motion.circle cx="24" cy="24" r={svgRadius}
            stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * svgRadius}
            style={{ pathLength: clampedProgress, rotate: -90, transformOrigin: '50% 50%' }}
          />
        </svg>
        <span className="unmaking-progress-value" aria-hidden="true">{progressPercent}%</span>
        {bookmark && <span className="unmaking-progress-bookmark-dot" aria-hidden="true"/>}
      </motion.button>
    </div>
  </aside>;
}
export default Skiper89;
