import type { ComponentProps } from 'react';
export function navigate(href: string) {
  if (!window.dispatchEvent(new Event('demicorpse:before-navigate', { cancelable: true }))) return;
  history.pushState({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}
export function SiteLink({ href, children, ...props }: ComponentProps<'a'>) {
  return <a href={href} {...props} onClick={event => {
    if (href?.startsWith('/') && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault(); navigate(href);
    }
  }}>{children}</a>;
}
