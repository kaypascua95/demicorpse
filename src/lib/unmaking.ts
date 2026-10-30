/**
 * Editorial structure only. The six provisional titles are editorial placeholders;
 * the prose is deliberately NOT stored or published by this preview.
 */
export interface UnmakingChapter {
  slug: string;
  roman: string;
  title: string;
}

export const UNMAKING_CHAPTERS: UnmakingChapter[] = [
  { slug: 'chapter-01', roman: 'I', title: 'A Place at the Table' },
  { slug: 'chapter-02', roman: 'II', title: 'The Arrangement of Things' },
  { slug: 'chapter-03', roman: 'III', title: 'In the Next Room' },
  { slug: 'chapter-04', roman: 'IV', title: 'An Account of Small Things' },
  { slug: 'chapter-05', roman: 'V', title: 'The Woman Who Stayed' },
  { slug: 'chapter-06', roman: 'VI', title: 'For Two' },
];

export const UNMAKING_HERO_IMAGE =
  'https://images.unsplash.com/photo-1718286111463-a2bdc0ea91a7?auto=format&fit=crop&w=2200&q=82';

export function getUnmakingChapter(slug: string): UnmakingChapter | undefined {
  return UNMAKING_CHAPTERS.find(chapter => chapter.slug === slug);
}
