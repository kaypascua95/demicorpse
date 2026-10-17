import type { ReactNode } from 'react';
import { SiteLink } from '@/lib/navigation';

export const newspaperSections: Record<string, string> = {
  '/journal': 'Journal', '/fragments': 'Fragments', '/gallery': 'Gallery',
  '/play': 'Play', '/dear-moon': 'Dear Moon', '/likas': 'Likas',
  '/archive': 'Archive', '/colophon': 'Colophon',
};

export function NewspaperMasthead({ home = false, section = 'DemiCorpse' }: { home?: boolean; section?: string }) {
  const logo = <img className="newspaper-original-logo" src="/demicorpse-logo.png" alt="DemiCorpse" />;
  return <header className="newspaper-masthead">
    {home ? <h1 className="newspaper-logo-lockup">{logo}</h1>
      : <SiteLink className="newspaper-logo-lockup" href="/?enter=1" aria-label="DemiCorpse home">{logo}</SiteLink>}
    <div className="newspaper-edition">{!home && <span>{section}</span>}<i aria-hidden="true" /></div>
    <p className="newspaper-masthead-note">Writing<br />Photographs<br />Ordinary moments<br /><span>Worth keeping.</span></p>
  </header>;
}

export function NewspaperSection({ section, children }: { section: string; children: ReactNode }) {
  return <div className="newspaper-page newspaper-section-shell" id="newspaper" tabIndex={-1}>
    <NewspaperMasthead section={section} />
    <div className="newspaper-section-paper">{children}</div>
    <footer className="newspaper-section-footer"><SiteLink href="/?enter=1">Back to the archive ↗</SiteLink></footer>
  </div>;
}
