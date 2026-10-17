import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { archiveLinks, parseSupportProfileUrl, parseSpotifyPlaylistUrl } from '../../src/lib/archive-links';

const deploymentCsp = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8')
  .match(/^Content-Security-Policy = "([^"]+)"$/m)?.[1] || '';

const fragment = {
  id: '11111111-1111-4111-8111-111111111111',
  collection: 'fragments',
  title: 'A small piece of evidence',
  slug: 'newspaper-small-evidence',
  excerpt: 'A quiet thought kept for another day.',
  content: 'The rain stopped, but the window kept its memory.',
  game: '',
  type: '',
  description: '',
  quote: '',
  video_url: '',
  duration: '',
  featured: false,
  media_layout: 'full',
  cover_image: null,
  media: [],
  date: '2026-10-16',
  status: 'published',
  tags: ['ordinary days'],
  published_at: '2026-10-16T18:00:00Z',
  created_at: '2026-10-16T18:00:00Z',
  updated_at: '2026-10-16T18:00:00Z',
};

const photograph = {
  id: '22222222-2222-4222-8222-222222222222',
  caption: 'Rain on the archive window',
  image_url: '/hero-still.png',
  storage_path: null,
  date: '2026-10-16',
  location: 'By the window',
  status: 'published',
  created_at: '2026-10-16T18:00:00Z',
};

const retiredCopy = /somewhere\s*between\s*alive\s*and\s*archived|the\s*night\s*archive/i;
const calligraphyPhrase = 'words, words and everything in between';
const dearMoonCopy = 'A collection of prose and poetry, coming soon.';

test('archive widget configuration accepts only supported official HTTPS destinations', () => {
  const directives = Object.fromEntries(deploymentCsp.split(';').map(directive => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }));
  expect(directives['frame-src']).toEqual(['https://player.twitch.tv', 'https://www.youtube-nocookie.com', 'https://open.spotify.com']);
  expect(directives['script-src']).toEqual(["'self'"]);
  expect(directives['object-src']).toEqual(["'none'"]);
  expect(directives['frame-ancestors']).toEqual(["'none'"]);
  expect(parseSupportProfileUrl('https://ko-fi.com/examplecreator')).toBe('https://ko-fi.com/examplecreator');
  expect(parseSupportProfileUrl('https://www.buymeacoffee.com/examplecreator')).toBe('https://buymeacoffee.com/examplecreator');
  expect(archiveLinks.supportUrl).toBe('https://ko-fi.com/demic0rpse');
  expect(archiveLinks.spotifyPlaylistUrl).toBe('https://open.spotify.com/playlist/5hXIZZcqf438PiHmjDfMHI');
  const playlist = 'https://open.spotify.com/playlist/0123456789ABCDEFGHIJKL';
  expect(parseSpotifyPlaylistUrl(playlist)).toBe(playlist);
  expect(parseSpotifyPlaylistUrl(`${playlist}?si=shared-token`)).toBe(playlist);
  for (const invalid of [null, '', 'javascript:alert(1)', 'http://ko-fi.com/examplecreator', 'https://ko-fi.com.evil.test/examplecreator', 'https://user:pass@ko-fi.com/examplecreator', 'https://ko-fi.com:444/examplecreator', 'https://ko-fi.com/', 'https://example.test/tips']) {
    expect(parseSupportProfileUrl(invalid), `Reject unsupported support URL: ${invalid}`).toBeNull();
  }
  for (const invalid of [null, '', 'javascript:alert(1)', 'http://open.spotify.com/playlist/0123456789ABCDEFGHIJKL', 'https://open.spotify.com.evil.test/playlist/0123456789ABCDEFGHIJKL', 'https://user:pass@open.spotify.com/playlist/0123456789ABCDEFGHIJKL', 'https://open.spotify.com:444/playlist/0123456789ABCDEFGHIJKL', 'https://open.spotify.com/track/0123456789ABCDEFGHIJKL', 'https://open.spotify.com/playlist/not-a-playlist']) {
    expect(parseSpotifyPlaylistUrl(invalid), `Reject unsupported playlist URL: ${invalid}`).toBeNull();
  }
});

test('approved Ko-fi and Spotify destinations stay private until visitor interaction', async ({ page }, testInfo) => {
  const providerRequests: string[] = [];
  page.on('request', request => {
    if (/spotify|ko-fi|buymeacoffee/i.test(new URL(request.url()).hostname)) providerRequests.push(request.url());
  });
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  const widgets = page.getByRole('region', { name: 'Support and listening', exact: true });
  await widgets.scrollIntoViewIfNeeded();
  await expect(widgets.getByRole('heading', { name: 'Support the archive', exact: true })).toBeVisible();
  await expect(widgets.getByRole('heading', { name: 'Listening corner', exact: true })).toBeVisible();
  await expect(widgets.locator('.archive-corner-label')).toHaveText(['004 / Support', '005 / Spotify']);
  await expect(page.locator('.newspaper-moon > .newspaper-label')).toHaveText('001 / Coming Soon');
  await expect(page.locator('.newspaper-fragments .newspaper-section-head h2')).toHaveText('002 / Recent fragments');
  await expect(page.locator('.newspaper-contact-sheet .newspaper-section-head h2')).toHaveText('003 / Gallery');
  await expect(page.locator('#elsewhere .newspaper-label')).toHaveText('006 / Elsewhere');
  const colophon = page.locator('.newspaper-bottom-colophon');
  await expect(colophon).toContainText('DemiCorpse');
  await expect(colophon.getByRole('link', { name: 'Colophon ↗', exact: true })).toHaveAttribute('href', '/colophon/');
  expect(await page.locator('.newspaper-closing').evaluate(element => {
    const sections = element.querySelector('.archive-corners')!;
    const elsewhere = element.querySelector('#elsewhere')!;
    const footer = element.querySelector('.newspaper-bottom-colophon')!;
    return element.lastElementChild === footer && footer.previousElementSibling === elsewhere
      && elsewhere.previousElementSibling === sections
      && elsewhere.getBoundingClientRect().top >= sections.getBoundingClientRect().bottom
      && footer.getBoundingClientRect().top >= elsewhere.getBoundingClientRect().bottom;
  })).toBe(true);
  await expect(widgets.getByText('Preview', { exact: true })).toHaveCount(0);
  await expect(widgets.getByText('femme fatale', { exact: true })).toBeVisible();
  const support = widgets.getByRole('link', { name: /Support on Ko-fi/ });
  await expect(support).toHaveAttribute('href', 'https://ko-fi.com/demic0rpse');
  await expect(support).toHaveAttribute('target', '_blank');
  await expect(support).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(support).toHaveClass(/flow-button flow-link/);
  expect(await support.evaluate(element => {
    const style = getComputedStyle(element);
    return style.backgroundColor === 'rgb(114, 43, 42)'
      && style.color === 'rgb(239, 232, 220)'
      && style.borderRadius === '9999px' && style.fontFamily.includes('DM Mono')
      && element.getBoundingClientRect().height >= 44;
  })).toBe(true);
  await expect.poll(() => support.locator('.flow-link-fill').evaluate(element => element.getBoundingClientRect().width)).toBe(0);
  if (!testInfo.project.use.isMobile) {
    await support.hover();
    await expect(support).toHaveCSS('border-radius', '12px');
    await expect.poll(() => support.locator('.flow-link-fill').evaluate(element =>
      Math.abs(element.getBoundingClientRect().width - element.parentElement!.clientWidth),
    )).toBeLessThan(1);
    await expect(support.locator('.flow-link-content')).toHaveCSS('color', 'rgb(114, 43, 42)');
    await page.mouse.move(0, 0);
    await expect(support).toHaveCSS('border-radius', '9999px');
  }
  await expect(widgets.getByRole('button', { name: 'Support link coming soon', exact: true })).toHaveCount(0);
  await expect(widgets.getByRole('button', { name: 'Load Spotify player', exact: true })).toBeEnabled();
  await expect(widgets.locator('iframe, audio')).toHaveCount(0);
  await expect(widgets.getByRole('link', { name: /Open in Spotify/ })).toHaveAttribute('href', 'https://open.spotify.com/playlist/5hXIZZcqf438PiHmjDfMHI');
  await expect(widgets).toContainText('Loading connects to Spotify and may use cookies.');
  await expectNoHorizontalOverflow(page);
  expect(await widgets.evaluate(element => [...element.querySelectorAll('button, .archive-corner-action')].every(button => {
    const bounds = button.getBoundingClientRect();
    const card = button.closest('article')!.getBoundingClientRect();
    return bounds.height >= 44 && bounds.left >= card.left - 1 && bounds.right <= card.right + 1;
  }))).toBe(true);
  const path = testInfo.outputPath(`newspaper-kofi-spotify-${testInfo.project.name}.png`);
  for (const reveal of await page.locator('.newspaper-closing .newspaper-reveal').all()) {
    await reveal.scrollIntoViewIfNeeded();
    await expect.poll(() => reveal.evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  }
  await page.locator('.newspaper-closing').screenshot({ path });
  await testInfo.attach(`DemiCorpse numbered support, Spotify and bottom colophon ${testInfo.project.name} (Spotify player not yet loaded)`, { path, contentType: 'image/png' });
  await colophon.getByRole('link', { name: 'Colophon ↗', exact: true }).click();
  await expect(page).toHaveURL(/\/colophon\/$/);
  await page.goBack();
  await expectNewspaper(page);
  await page.getByRole('button', { name: 'JOURNAL', exact: true }).click();
  await expect(widgets).toHaveCount(0);
  await page.getByRole('button', { name: 'DemiCorpse home', exact: true }).click();
  await expect(widgets.getByRole('button', { name: 'Load Spotify player', exact: true })).toBeEnabled();
  expect(providerRequests).toEqual([]);
});

test('Morrow uses the original idle frames, pauses offscreen, and keeps keyboard hide state across navigation', async ({ page }) => {
  await mockCms(page);
  await page.goto('/');
  await expect(page.locator('.archive-cat-dock')).toHaveCount(0);
  await page.getByRole('button', { name: 'ENTER', exact: true }).click();
  await expectNewspaper(page);
  const sprite = page.locator('.archive-cat-sprite');
  await sprite.scrollIntoViewIfNeeded();
  await expect(sprite).toHaveAttribute('aria-hidden', 'true');
  await expect(sprite).toHaveCSS('background-image', /morrow-idle\.png/);
  await expect(sprite).toHaveAttribute('data-paused', 'false');
  await expect.poll(() => sprite.getAttribute('data-frame'), { timeout: 6000 }).not.toBe('0');
  const dock = page.locator('.archive-cat-dock');
  expect(await dock.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const art = element.querySelector('.archive-cat-sprite')!.getBoundingClientRect();
    const footer = element.closest('footer')!;
    return bounds.left >= 0 && bounds.right <= innerWidth
      && [...footer.querySelectorAll('a, button')].every(control => {
        const c = control.getBoundingClientRect();
        return c.right <= art.left || c.left >= art.right || c.bottom <= art.top || c.top >= art.bottom;
      });
  })).toBe(true);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(sprite).toHaveAttribute('data-paused', 'true');
  const pausedFrame = await sprite.getAttribute('data-frame');
  await page.waitForTimeout(400);
  await expect(sprite).toHaveAttribute('data-frame', pausedFrame!);
  const hide = page.getByRole('button', { name: 'Hide cat', exact: true });
  await expect(hide).toHaveCSS('border-top-width', '0px');
  await expect(hide.locator('span')).toHaveCSS('font-size', '14px');
  expect(await hide.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.width >= 44 && bounds.height >= 44;
  })).toBe(true);
  await hide.scrollIntoViewIfNeeded();
  await hide.focus();
  await page.keyboard.press('Enter');
  await expect(sprite).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show cat', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'JOURNAL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show cat', exact: true })).toBeVisible();
  await expect(sprite).toHaveCount(0);
  await page.goBack();
  await expectNewspaper(page);
  const show = page.getByRole('button', { name: 'Show cat', exact: true });
  await show.scrollIntoViewIfNeeded();
  await show.focus();
  await page.keyboard.press('Enter');
  await expect(sprite).toBeVisible();
  await expect(hide).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

test('Morrow is a static original frame under reduced motion and remains dismissible', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  const sprite = page.locator('.archive-cat-sprite');
  await sprite.scrollIntoViewIfNeeded();
  await expect(sprite).toHaveAttribute('data-frame', '0');
  await expect(sprite).toHaveAttribute('data-paused', 'true');
  await page.waitForTimeout(500);
  await expect(sprite).toHaveAttribute('data-frame', '0');
  const path = testInfo.outputPath(`newspaper-morrow-${testInfo.project.name}.png`);
  await page.locator('.newspaper-bottom-colophon').screenshot({ path });
  await testInfo.attach(`Original Morrow cat in the actual ${testInfo.project.name} footer, reduced-motion still`, { path, contentType: 'image/png' });
  await page.getByRole('button', { name: 'Hide cat', exact: true }).click();
  await page.getByRole('button', { name: 'Show cat', exact: true }).click();
  await expect(sprite).toHaveAttribute('data-frame', '0');
  await expect(sprite).toHaveAttribute('data-paused', 'true');
});

test('a missing decorative cat never blocks the archive or leaves broken-image controls', async ({ page }) => {
  let requests = 0;
  await page.route('**/morrow-idle.png', async route => { requests++; await route.abort('failed'); });
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(page.locator('.archive-cat-dock')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Support on Ko-fi/ })).toBeVisible();
  await page.getByRole('link', { name: 'Colophon ↗', exact: true }).click();
  await expect(page).toHaveURL(/\/colophon\/$/);
  await expect(page.locator('.archive-cat-dock')).toHaveCount(0);
});


test('Spotify works under the deployed frame policy with click-to-load and provider-failure fallback', async ({ page }) => {
  const embedUrl = 'https://open.spotify.com/embed/playlist/5hXIZZcqf438PiHmjDfMHI';
  const requests: string[] = [];
  let unavailable = true;
  await page.route('https://open.spotify.com/**', async route => {
    requests.push(route.request().url());
    if (unavailable) await route.abort('failed');
    else await route.fulfill({ status: 503, contentType: 'text/html', body: '<!doctype html><html><body><h1>Fixture provider unavailable</h1></body></html>' });
  });
  // Vite preview does not read Netlify headers. Apply the real policy to this
  // document, substituting only the isolated CMS fixture origin for live data.
  // A missing Spotify frame allowance must block the iframe and fail this test.
  const testCsp = deploymentCsp.replace('https://gzgfiyaqgihbzfmhnvlh.supabase.co', 'https://cms-test.supabase.co');
  await page.route(url => url.origin === 'http://127.0.0.1:4173' && url.pathname === '/', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': testCsp } });
  });
  await mockCms(page);
  const document = await page.goto('/?enter=1');
  expect(document?.headers()['content-security-policy']).toBe(testCsp);
  const widgets = page.getByRole('region', { name: 'Support and listening', exact: true });
  const load = widgets.getByRole('button', { name: 'Load Spotify player', exact: true });
  const fallback = widgets.getByRole('link', { name: /Open in Spotify/ });
  await widgets.scrollIntoViewIfNeeded();
  await expect(load).toBeVisible();
  expect(requests).toEqual([]);
  await load.focus();
  await page.keyboard.press('Enter');
  const iframe = widgets.locator('iframe');
  await expect(iframe).toHaveAttribute('src', embedUrl);
  await expect(iframe).toHaveAttribute('title', 'femme fatale Spotify playlist');
  await expect(iframe).toHaveAttribute('loading', 'lazy');
  await expect(iframe).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  await expect(iframe).toHaveAttribute('allow', 'encrypted-media; fullscreen; picture-in-picture');
  await expect.poll(() => requests.length).toBe(1);
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute('href', 'https://open.spotify.com/playlist/5hXIZZcqf438PiHmjDfMHI');
  await expect(fallback).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(widgets).toContainText('If the player is unavailable, open the playlist in Spotify below.');
  const hide = widgets.getByRole('button', { name: 'Hide Spotify player', exact: true });
  await expect(hide).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(iframe).toHaveCount(0);
  await expect(load).toBeFocused();
  unavailable = false;
  await page.keyboard.press('Enter');
  await expect(widgets.frameLocator('iframe').getByRole('heading', { name: 'Fixture provider unavailable' })).toBeVisible();
  await expect(fallback).toBeVisible();
  expect(await page.locator('.newspaper-closing').evaluate(element =>
    element.querySelector('.newspaper-bottom-colophon')!.getBoundingClientRect().top
      >= element.querySelector('.archive-corners')!.getBoundingClientRect().bottom,
  )).toBe(true);
  await expectNoHorizontalOverflow(page);
  expect(requests).toEqual([embedUrl, embedUrl]);
  // Leaving an open or failed player must remove it, not keep background audio.
  await page.getByRole('button', { name: 'JOURNAL', exact: true }).click();
  await expect(page.locator('.archive-spotify-frame')).toHaveCount(0);
  await page.getByRole('button', { name: 'DemiCorpse home', exact: true }).click();
  await expect(load).toBeVisible();
  await expect(iframe).toHaveCount(0);
  expect(requests).toEqual([embedUrl, embedUrl]);
});

test('Ko-fi opens the exact approved profile in a separate tab and closing it preserves the archive', async ({ page, context }) => {
  const destinations: string[] = [];
  await context.route('https://ko-fi.com/**', async route => {
    destinations.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>Destination fixture</title></head><body><h1>Ko-fi destination fixture</h1><p>No payment service is contacted in this test.</p></body></html>' });
  });
  await mockCms(page);
  await page.goto('/?enter=1');
  const support = page.getByRole('region', { name: 'Support and listening', exact: true }).getByRole('link', { name: /Support on Ko-fi/ });
  await support.scrollIntoViewIfNeeded();
  expect(destinations).toEqual([]);
  for (let attempt = 0; attempt < 2; attempt++) {
    await support.focus();
    await expect(support).toBeFocused();
    const opened = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    const popup = await opened;
    await expect(popup).toHaveURL('https://ko-fi.com/demic0rpse');
    await expect(popup.getByRole('heading', { name: 'Ko-fi destination fixture' })).toBeVisible();
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    await popup.close();
    await page.bringToFront();
    await expect(page).toHaveURL(/\/\?enter=1$/);
    await expectNewspaper(page);
    await expect(support).toBeFocused();
  }
  expect(destinations).toEqual(['https://ko-fi.com/demic0rpse', 'https://ko-fi.com/demic0rpse']);
  await expect(page.getByRole('button', { name: 'Load Spotify player', exact: true })).toBeEnabled();
});

type CmsState = 'content' | 'empty' | 'error';
type CmsResponses = CmsState | { fragments: CmsState; gallery: CmsState };
type MockPhotograph = Omit<typeof photograph, 'storage_path'> & { storage_path: string | null };

/** Keep every content assertion independent of the deployed CMS and its data. */
async function mockCms(page: Page, state: CmsResponses = 'content', photos: MockPhotograph[] = [photograph]) {
  const requests: URL[] = [];
  // Only mock the public tables used here, not auth or other Supabase traffic.
  await page.route(url => /\/rest\/v1\/(?:cms_entries|gallery_items|cms_traces)$/.test(url.pathname), async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    requests.push(url);
    const responseState = typeof state === 'string' ? state
      : url.pathname.endsWith('/gallery_items') ? state.gallery : state.fragments;
    if (responseState === 'error') {
      await route.fulfill({
        status: 503,
        headers,
        json: { code: 'TEST_UNAVAILABLE', message: 'The test archive is unavailable.' },
      });
      return;
    }

    let data: Array<typeof fragment | MockPhotograph> = [];
    if (responseState === 'content') {
      if (url.pathname.endsWith('/cms_entries') && url.searchParams.get('collection') === 'eq.fragments') {
        const slug = url.searchParams.get('slug');
        data = !slug || slug === `eq.${fragment.slug}` ? [fragment] : [];
      }
      if (url.pathname.endsWith('/gallery_items')) {
        // Emulate PostgREST ordering instead of handing the UI a pre-sorted
        // answer: a date-based query must fail the latest-upload regression.
        const order = (url.searchParams.get('order') || '').split(',');
        data = [...photos].sort((left, right) => {
          for (const clause of order) {
            const [column, direction] = clause.split('.');
            const key = column as keyof MockPhotograph;
            const comparison = String(left[key] ?? '').localeCompare(String(right[key] ?? ''));
            if (comparison) return direction === 'desc' ? -comparison : comparison;
          }
          return 0;
        }).slice(0, Number(url.searchParams.get('limit') || photos.length));
      }
    }
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    await route.fulfill({ status: 200, headers, json: single ? data[0] ?? null : data });
  });
  return {
    requests,
    setState(nextState: CmsResponses) { state = nextState; },
    setPhotos(nextPhotos: MockPhotograph[]) { photos = nextPhotos; },
  };
}

async function expectNewspaper(page: Page) {
  await expect(page.locator('main.newspaper-page')).toBeVisible();
  await expect(page.locator('.newspaper-masthead').getByRole('heading', { level: 1, name: 'DemiCorpse', exact: true })).toBeVisible();
  await expect(page.locator('.newspaper-page h1')).toHaveCount(1);
  await expect(page.locator('.main-header')).toHaveCount(1);
  const home = page.getByRole('button', { name: 'DemiCorpse home', exact: true });
  await expect(home.getByRole('img', { name: 'DemiCorpse moon', exact: true })).toBeVisible();
  await expect(home.locator('.brand-moon image')).toHaveAttribute('href', '/demicorpse-logo.png');
  await expect(page.locator('.newspaper-masthead h1 img')).toHaveAttribute('src', '/demicorpse-logo.png');
  await expect(page.locator('.newspaper-established')).toHaveText('Est. 2026');
  await expect(page.locator('.newspaper-established')).toBeVisible();
  await expect(page.locator('#persistent-video')).toHaveCount(1);
}

async function expectInkComplete(page: Page, timeout = 8_000) {
  const ink = page.locator('.ink-calligraphy');
  await expect(ink).toHaveCount(1);
  await expect(ink.locator('.ink-calligraphy-readable')).toHaveText(calligraphyPhrase);
  await expect(ink).toHaveAttribute('data-ink-phase', /^(hold|static)$/, { timeout });
  await expect.poll(() => ink.locator('.ink-calligraphy-mask').evaluateAll(paths => paths.length > 0 && paths.every(path => {
    const style = getComputedStyle(path);
    return (style.strokeDasharray === 'none' || parseFloat(style.strokeDasharray) >= 0.999)
      && Math.abs(parseFloat(style.strokeDashoffset) || 0) < 0.01;
  })), { timeout, message: 'Every calligraphy stroke should be fully revealed' }).toBe(true);
}

async function expectTextRevealed(page: Page, selector: string, timeout = 5_000) {
  await expect.poll(() => page.locator(selector).evaluateAll(elements => elements.length > 0 && elements.every(element => {
    const style = getComputedStyle(element);
    const blur = Number(style.filter.match(/blur\(([\d.]+)px\)/)?.[1] || 0);
    const translation = style.transform === 'none' ? 0 : new DOMMatrix(style.transform).m42;
    return Number(style.opacity) >= 0.99 && blur <= 0.1 && Math.abs(translation) <= 0.5;
  })), { timeout, message: 'Text should be readable without transparent, blurred, or translated reveal states' }).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    bodyFits: document.body.scrollWidth <= window.innerWidth,
  })), { message: 'Neither the document nor the body should overflow horizontally' })
    .toEqual({ documentFits: true, bodyFits: true });
}

test('the original full-logo entrance gates the newspaper and repeated Enter is safe', async ({ page }) => {
  await mockCms(page);
  await page.goto('/');
  const entrance = page.locator('.entrance-hero');
  await expect(entrance).toBeVisible();
  await expect(entrance.locator('.landing-logo')).toHaveAttribute('src', '/demicorpse-logo.png');
  await expect(entrance.locator('.landing-logo')).toHaveAttribute('alt', 'DemiCorpse');
  await expect(entrance.locator('.brand-moon')).toHaveCount(0);
  await expect(entrance).not.toContainText(retiredCopy);
  await expect(page.locator('.newspaper-page')).toHaveCount(0);
  await expect(page.locator('.main-header')).toHaveCount(0);
  const film = await page.locator('#persistent-video').evaluateHandle(element => element);
  await expect(page.locator('#persistent-video')).toHaveAttribute('src', '/demicorpse-hero-muted.mp4');

  // Both clicks land during the existing entrance transition, rather than
  // retrying against a detached button after the first navigation finishes.
  await page.getByRole('button', { name: 'ENTER', exact: true }).dblclick();
  await expectNewspaper(page);
  await expect(entrance).toHaveCount(0);
  await expect(page.locator('.newspaper-page')).toHaveCount(1);
  expect(await film.evaluate(original => original === document.querySelector('#persistent-video'))).toBe(true);
  await film.dispose();
});

test('the direct home route presents real published fragments and photographs', async ({ page }, testInfo) => {
  const { requests } = await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  await expect(page.locator('.entrance-hero')).toHaveCount(0);
  await expect(page.locator('.newspaper-feature')).toBeVisible();
  await expect(page.locator('.newspaper-fragments')).toContainText(fragment.excerpt);
  const photo = page.locator('.newspaper-contact-sheet img').first();
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute('src', photograph.image_url);
  await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  const fragmentRequest = requests.find(url => url.pathname.endsWith('/cms_entries'));
  const galleryRequest = requests.find(url => url.pathname.endsWith('/gallery_items'));
  expect(fragmentRequest?.searchParams.get('collection')).toBe('eq.fragments');
  expect(fragmentRequest?.searchParams.get('status')).toBe('eq.published');
  expect(galleryRequest?.searchParams.get('status')).toBe('eq.published');
  expect(galleryRequest?.searchParams.get('order')).toBe('created_at.desc,id.desc');
  await expectNoHorizontalOverflow(page);
  expect(await page.locator('.newspaper-page').evaluate(element => {
    const paper = getComputedStyle(element).backgroundColor;
    const masthead = element.querySelector('.newspaper-masthead')!;
    const logo = masthead.querySelector('.newspaper-logo-lockup')!.getBoundingClientRect();
    const mastheadBounds = masthead.getBoundingClientRect();
    const centered = Math.abs((logo.left + logo.right) / 2 - (mastheadBounds.left + mastheadBounds.right) / 2) < 2;
    const feature = element.querySelector('.newspaper-feature')!.getBoundingClientRect();
    const moon = element.querySelector('.newspaper-moon')!.getBoundingClientRect();
    const cover = element.querySelector('.newspaper-cover-link')!.getBoundingClientRect();
    return { paper, centered, balancedColumns: innerWidth <= 700 || (moon.width / feature.width > .28 && cover.height < cover.width * .65) };
  })).toEqual({ paper: 'rgb(239, 232, 220)', centered: true, balancedColumns: true });

  // Trigger the real once-only reveals before capturing the entire page;
  // a full-page screenshot alone does not bring offscreen text into view.
  for (const reveal of await page.locator('.newspaper-reveal').all()) {
    await reveal.scrollIntoViewIfNeeded();
    await expect.poll(() => reveal.evaluate(element => Number(getComputedStyle(element).opacity)))
      .toBeGreaterThan(0);
  }
  await expectTextRevealed(page, '.newspaper-reveal');
  await page.locator('.ink-calligraphy').scrollIntoViewIfNeeded();
  await expectInkComplete(page);
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  // Capture a real completed hold, not an intermediate or forced-finished frame.
  await expectInkComplete(page);
  const screenshotPath = testInfo.outputPath(`newspaper-fixture-${testInfo.project.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`Newspaper ${testInfo.project.name} (mock CMS fixtures, not live content)`, {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

test('revised Dear Moon copy and red-ink calligraphy remain correct across home navigation', async ({ page }) => {
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  const moon = page.locator('.newspaper-moon');
  await expect(moon.locator('.newspaper-label')).toHaveText('001 / Coming Soon');
  await expect(moon.locator('.newspaper-moon-note')).toHaveText(dearMoonCopy);
  await expect(moon).not.toContainText(/a quieter room/i);
  await expect(page.locator('body')).not.toContainText(retiredCopy);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(page.locator('.more-dropdown')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(retiredCopy);
  await page.keyboard.press('Escape');

  const ink = page.locator('.ink-calligraphy');
  await ink.scrollIntoViewIfNeeded();
  await expectInkComplete(page);
  expect(await ink.evaluate(element => {
    const [red, green, blue] = (getComputedStyle(element).color.match(/[\d.]+/g) || []).map(Number);
    return red > green * 1.5 && red > blue * 1.5;
  }), 'Calligraphy should use red ink').toBe(true);

  await page.locator('.newspaper-text-link[href="/dear-moon/"]').click();
  await expect(page).toHaveURL(/\/dear-moon\/$/);
  await expect(page.locator('.coming-inner > p')).toHaveText(dearMoonCopy);
  await expect(page.locator('body')).not.toContainText(retiredCopy);
  await page.getByRole('button', { name: 'DemiCorpse home', exact: true }).click();
  await expectNewspaper(page);
  // Remounts may begin a fresh loop; they must still produce readable ink.
  await ink.scrollIntoViewIfNeeded();
  await expectInkComplete(page);
});

test('newspaper columns and masthead fit narrow, tablet, and wide viewports', async ({ page }) => {
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  await expect(page.locator('.newspaper-fragments')).toContainText(fragment.excerpt);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.newspaper-masthead')).toBeVisible();
    // The original landing image must fit its own lockup, not merely a body
    // whose overflow may be hidden. Check the rendered image bounds directly.
    const mastheadLogo = page.locator('.newspaper-masthead h1 img');
    await expect(mastheadLogo).toHaveAttribute('src', '/demicorpse-logo.png');
    await expect.poll(() => mastheadLogo.evaluate(image => {
      const bounds = image.getBoundingClientRect();
      const lockup = image.closest('h1')!.getBoundingClientRect();
      return {
        loaded: (image as HTMLImageElement).naturalWidth > 0,
        fitsLockup: bounds.left >= lockup.left - 1 && bounds.right <= lockup.right + 1,
        withinViewport: bounds.left >= -1 && bounds.right <= innerWidth + 1,
      };
    }), { message: `The original masthead logo must fit at ${width}px` })
      .toEqual({ loaded: true, fitsLockup: true, withinViewport: true });
    // The four calligraphy lines stay stacked and within the Dear Moon
    // column even where body overflow hiding could mask a clipped flourish.
    const ink = page.locator('.newspaper-moon .ink-calligraphy');
    await expect(ink.locator('.ink-calligraphy-line')).toHaveCount(4);
    expect(await ink.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const moon = element.closest('.newspaper-moon')!.getBoundingClientRect();
      const lines = Array.from(element.querySelectorAll('.ink-calligraphy-line')).map(line => line.getBoundingClientRect());
      return bounds.left >= moon.left - 1 && bounds.right <= moon.right + 1
        && bounds.left >= -1 && bounds.right <= innerWidth + 1
        && lines.every((line, index) => line.width > 0 && line.height > 0
          && (!index || line.top > lines[index - 1].top));
    }), `Multiline calligraphy should fit at ${width}px`).toBe(true);
    await expectNoHorizontalOverflow(page);
  }
});

test('the calligraphy writes, holds legibly, resets, and writes again inside Dear Moon', async ({ page }) => {
  await mockCms(page);
  await page.goto('/?enter=1');
  const ink = page.locator('.newspaper-moon-bottom .ink-calligraphy');
  await expect(ink).toHaveCount(1);
  await expect(page.locator('.newspaper-inscription')).toHaveCount(0);
  await ink.scrollIntoViewIfNeeded();
  await expect(ink).toHaveAttribute('data-ink-playing', 'true');
  await expect(ink).toHaveAttribute('data-ink-phase', 'drawing');
  await expect.poll(() => ink.locator('.ink-calligraphy-mask').evaluateAll(paths =>
    paths.some(path => Number.parseFloat(getComputedStyle(path).strokeDashoffset) > 0.1)))
    .toBe(true);
  await expectInkComplete(page);
  const holdStarted = Date.now();
  await expect(ink.locator('.ink-calligraphy-lines')).toHaveCSS('opacity', '1');
  await expect.poll(() => ink.getAttribute('data-ink-phase'), { timeout: 6_000, intervals: [50, 100] }).toBe('reset');
  expect(Date.now() - holdStarted, 'The completed phrase needs a meaningful readable pause').toBeGreaterThan(2_500);
  await expect(ink).toHaveAttribute('data-ink-phase', 'drawing', { timeout: 2_000 });
  await expect.poll(() => ink.locator('.ink-calligraphy-mask').evaluateAll(paths =>
    paths.some(path => Number.parseFloat(getComputedStyle(path).strokeDashoffset) > 0.1)))
    .toBe(true);
  await expectInkComplete(page);
});

test('fragment links, home logo, and browser history retain the same film', async ({ page }) => {
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  const film = await page.locator('#persistent-video').evaluateHandle(element => element);
  const fragmentLink = page.locator(`.newspaper-fragments a[href*="/fragments/${fragment.slug}"]`).first();
  await expect(fragmentLink).toBeVisible();
  await fragmentLink.click();
  await expect(page).toHaveURL(new RegExp(`/fragments/${fragment.slug}/?$`));
  await expect(page.locator('.cms-entry')).toContainText(fragment.content);
  expect(await film.evaluate(original => original === document.querySelector('#persistent-video'))).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/\/\?enter=1$/);
  await expectNewspaper(page);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/fragments/${fragment.slug}/?$`));
  await expect(page.locator('.cms-entry')).toContainText(fragment.content);

  await page.locator('.main-logo').click();
  await expect(page).toHaveURL(/\/\?enter=1$/);
  await expectNewspaper(page);
  await expect(page.locator('.entrance-hero')).toHaveCount(0);
  expect(await film.evaluate(original => original === document.querySelector('#persistent-video'))).toBe(true);
  await film.dispose();
});

test('global primary navigation and newspaper collection links still work', async ({ page }) => {
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  await page.getByRole('button', { name: 'GALLERY', exact: true }).click();
  await expect(page).toHaveURL(/\/gallery\/$/);
  await expect(page.locator('.main-header')).toBeVisible();
  await page.locator('.main-logo').click();
  await expectNewspaper(page);

  const fragmentsIndex = page.locator('.newspaper-page a[href="/fragments/"]').first();
  await expect(fragmentsIndex).toBeVisible();
  await fragmentsIndex.click();
  await expect(page).toHaveURL(/\/fragments\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Loose');
  await page.goBack();
  await expectNewspaper(page);
});

test('secondary menu closes with Escape, outside click, and repeated toggles', async ({ page }) => {
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  const menu = page.locator('.more-dropdown');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(menu.getByRole('link', { name: /COLOPHON/ })).toBeVisible();
  await expect(menu.getByRole('link', { name: /ADMIN/ })).toBeVisible();
  await expect(menu.getByRole('link', { name: /JOURNAL|FRAGMENTS|GALLERY/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toHaveAttribute('aria-expanded', 'false');

  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await expect(menu).toBeVisible();
  // The existing mobile menu overlays the masthead. Blank header space above
  // the menu is a real outside target at every viewport and does not navigate.
  await page.locator('.main-header').click({ position: { x: 5, y: 5 } });
  await expect(menu).toHaveCount(0);
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(/\/\?enter=1$/);
  await expectNewspaper(page);
});

for (const state of ['empty', 'error'] as const) {
  test(`${state} CMS responses do not invent fragments or photographs`, async ({ page }) => {
    const cms = await mockCms(page, state);
    await page.goto('/?enter=1');
    await expectNewspaper(page);
    const fragments = page.locator('.newspaper-fragments');
    const photos = page.locator('.newspaper-contact-sheet');
    const message = state === 'empty'
      ? /no fragments|nothing|waiting|yet|appear|gather|soon/i
      : /unavailable|couldn.t|unable|could not|try again|not.*load/i;
    // Supabase retries 503 three times with 1s + 2s + 4s backoff. Preserve
    // that real retry behavior and wait for its bounded terminal error state.
    const stateTimeout = state === 'error' ? 15_000 : 5_000;
    await expect(fragments).toContainText(message, { timeout: stateTimeout });
    await expect(photos).toContainText(message, { timeout: stateTimeout });
    await expect(fragments.locator('a[href^="/fragments/"]:not([href="/fragments/"])')).toHaveCount(0);
    await expect(photos.locator('img')).toHaveCount(0);
    await expect(fragments).not.toContainText(fragment.title);
    await expect(fragments).not.toContainText(fragment.excerpt);
    await expect(fragments).not.toContainText(fragment.content);
    await expect(photos).not.toContainText(photograph.caption);
    await expectNoHorizontalOverflow(page);

    if (state === 'error') {
      const failedFragmentRequests = cms.requests.filter(url =>
        url.pathname.endsWith('/cms_entries') && url.searchParams.get('collection') === 'eq.fragments');
      expect(failedFragmentRequests.length, '503 must exhaust the initial request plus three retries')
        .toBeGreaterThanOrEqual(4);

      // The public Retry control must fetch current CMS data rather than
      // leaving an error, showing a fabricated fallback, or requiring reload.
      cms.setState('content');
      await fragments.getByRole('button', { name: /Try again/i }).click();
      await expect(fragments).toContainText(fragment.title);
      await expect(fragments).toContainText(fragment.excerpt);
      await expect(fragments.locator(`a[href="/fragments/${fragment.slug}"]`)).toHaveCount(1);
      await expect(fragments.getByRole('button', { name: /Try again/i })).toHaveCount(0);
      await expect(photos.locator('img')).toHaveAttribute('src', photograph.image_url);
      await expect(photos.getByRole('button', { name: /Try again/i })).toHaveCount(0);
      await expect(fragments).not.toContainText('couldn’t be loaded');
      await expect(photos).not.toContainText('couldn’t be loaded');
      await expectNoHorizontalOverflow(page);
    }
  });
}

test('a mixed-result retry removes stale Storage photographs and restores the existing cover still', async ({ page }) => {
  const storedPhoto = { ...photograph, image_url: '', storage_path: 'fixture/newspaper-window.png' };
  const cms = await mockCms(page, { fragments: 'error', gallery: 'content' }, [storedPhoto]);
  await page.route(url => url.pathname === '/storage/v1/object/cms-media/fixture/newspaper-window.png', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({ status: 200, headers, contentType: 'image/png', path: 'public/hero-still.png' });
  });
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  const fragments = page.locator('.newspaper-fragments');
  const photos = page.locator('.newspaper-contact-sheet');
  const cover = page.locator('.newspaper-cover-link img');
  await expect(photos.locator('img')).toHaveAttribute('src', /^blob:/);
  const oldBlob = (await photos.locator('img').getAttribute('src'))!;
  await expect(cover).toHaveAttribute('src', oldBlob);
  await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(fragments).toContainText('couldn’t be loaded', { timeout: 15_000 });
  expect(cms.requests.filter(url => url.pathname.endsWith('/cms_entries')).length).toBeGreaterThanOrEqual(4);
  await expect(fragments.locator('.newspaper-fragment-list')).toHaveCount(0);

  const priorGalleryRequests = cms.requests.filter(url => url.pathname.endsWith('/gallery_items')).length;
  cms.setState({ fragments: 'content', gallery: 'error' });
  await fragments.getByRole('button', { name: /Try again/i }).click();
  await expect(fragments).toContainText(fragment.excerpt);
  await expect(fragments.locator(`a[href="/fragments/${fragment.slug}"]`)).toHaveCount(1);
  // This must clear the previous successful gallery immediately, including
  // the cover image that shares its object URL, not just replace error copy.
  await expect(photos.locator('img')).toHaveCount(0);
  await expect(cover).toHaveAttribute('src', '/hero-still.png');
  await expect(page.locator('.newspaper-cover figcaption')).not.toContainText(photograph.caption);
  await expect(photos).toContainText('couldn’t be loaded', { timeout: 15_000 });
  expect(cms.requests.filter(url => url.pathname.endsWith('/gallery_items')).length - priorGalleryRequests)
    .toBeGreaterThanOrEqual(4);
  expect(await page.locator('img').evaluateAll((images, url) => images.some(image => image.getAttribute('src') === url), oldBlob))
    .toBe(false);
  // Revocation is observable without exposing or loading any external data.
  expect(await page.evaluate(async url => {
    try { return (await fetch(url)).ok; } catch { return false; }
  }, oldBlob)).toBe(false);
  await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expectNewspaper(page);
});

test('the hero follows the latest upload, refreshes on focus, and retains the last good photograph on background error', async ({ page }) => {
  const olderUpload = { ...photograph, id: 'photo-a', caption: 'Older upload with a newer photo date',
    date: '2026-12-31', created_at: '2026-10-15T18:00:00Z' };
  const sameTimeLowerId = { ...photograph, id: 'photo-b', caption: 'Same upload time, earlier identifier',
    date: '2026-12-30', created_at: '2026-10-16T18:00:00Z' };
  const latestUpload = { ...photograph, id: 'photo-c', caption: 'Latest uploaded photograph',
    date: '2020-01-01', created_at: '2026-10-16T18:00:00Z' };
  const cms = await mockCms(page, 'content', [olderUpload, sameTimeLowerId, latestUpload]);
  const galleryRequests = () => cms.requests.filter(url => url.pathname.endsWith('/gallery_items'));
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  const cover = page.locator('.newspaper-cover-link img');
  await expect(cover).toHaveAttribute('alt', latestUpload.caption);
  await expect(page.locator('.newspaper-cover figcaption')).toContainText(latestUpload.caption);
  expect(galleryRequests()[0].searchParams.get('status')).toBe('eq.published');
  expect(galleryRequests()[0].searchParams.get('order')).toBe('created_at.desc,id.desc');

  // Simulate a completed CMS upload without writing to any real service.
  const newUpload = { ...latestUpload, id: 'photo-d', caption: 'A photograph uploaded while home stayed open',
    image_url: '', storage_path: 'fixture/new-upload.png', date: '2019-01-01', created_at: '2026-10-17T18:00:00Z' };
  await page.route(url => url.pathname === '/storage/v1/object/cms-media/fixture/new-upload.png', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({ status: 200, headers, contentType: 'image/png', path: 'public/hero-still.png' });
  });
  cms.setPhotos([olderUpload, latestUpload, newUpload]);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(cover).toHaveAttribute('alt', newUpload.caption);
  await expect(cover).toHaveAttribute('src', /^blob:/);
  const currentBlob = (await cover.getAttribute('src'))!;
  await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.newspaper-contact-sheet img').first()).toHaveAttribute('alt', newUpload.caption);

  cms.setState({ fragments: 'content', gallery: 'error' });
  const previousRequests = galleryRequests().length;
  // Waiting for the fourth response proves the normal 503 retry sequence
  // finishes, rather than checking the old image only while a retry is pending.
  const terminalResponse = page.waitForResponse(response => response.status() === 503
    && new URL(response.url()).pathname.endsWith('/gallery_items')
    && galleryRequests().length >= previousRequests + 4, { timeout: 15_000 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await (await terminalResponse).finished();
  await expect(cover).toHaveAttribute('src', currentBlob);
  await expect(cover).toHaveAttribute('alt', newUpload.caption);
  await expect(page.locator('.newspaper-contact-sheet img').first()).toHaveAttribute('src', currentBlob);
  expect(await page.evaluate(async url => (await fetch(url)).ok, currentBlob), 'The retained image URL must not be revoked').toBe(true);
  await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  // A later focus can recover normally; a background error must not strand
  // an in-flight guard or force the visitor to reload the entire document.
  cms.setState('content');
  cms.setPhotos([latestUpload]);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(cover).toHaveAttribute('alt', latestUpload.caption);
  await expect.poll(() => page.evaluate(async url => {
    try { return (await fetch(url)).ok; } catch { return false; }
  }, currentBlob), { message: 'Successfully replaced Storage URLs should be released after the next render' }).toBe(false);
});

test('the open home polls while visible and refreshes on return without polling a hidden tab', async ({ page }) => {
  const cms = await mockCms(page);
  await page.clock.install();
  await page.goto('/?enter=1');
  const cover = page.locator('.newspaper-cover-link img');
  await expect(cover).toHaveAttribute('alt', photograph.caption);
  // Playwright's clock advances the application's actual interval. No wait
  // for real CMS changes or a wall-clock 30-second pause is needed.
  await page.clock.pauseAt(new Date(Date.now() + 1_000));
  const polledUpload = { ...photograph, id: 'polled-upload', caption: 'New upload found by visible polling',
    created_at: '2026-10-18T18:00:00Z' };
  cms.setPhotos([polledUpload]);
  await page.clock.fastForward(30_001);
  await expect(cover).toHaveAttribute('alt', polledUpload.caption);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenRequestCount = cms.requests.filter(url => url.pathname.endsWith('/gallery_items')).length;
  const returnedUpload = { ...polledUpload, caption: 'New upload found on tab return', created_at: '2026-10-19T18:00:00Z' };
  cms.setPhotos([returnedUpload]);
  await page.clock.fastForward(60_001);
  expect(cms.requests.filter(url => url.pathname.endsWith('/gallery_items')).length).toBe(hiddenRequestCount);
  await expect(cover).toHaveAttribute('alt', polledUpload.caption);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(cover).toHaveAttribute('alt', returnedUpload.caption);
});

test('reduced-motion visitors can enter and use navigation with the keyboard', async ({ page }) => {
  await mockCms(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const enter = page.getByRole('button', { name: 'ENTER', exact: true });
  await expect(enter).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(enter).toBeFocused();
  await page.keyboard.press('Enter');
  await expectNewspaper(page);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expectInkComplete(page, 1_000);
  await expect(page.locator('.ink-calligraphy')).toHaveAttribute('data-ink-phase', 'static');
  await expect(page.locator('.ink-calligraphy')).toHaveAttribute('data-ink-playing', 'false');
  expect(await page.locator('.ink-calligraphy-lines').evaluate(svg =>
    svg.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'))).toBe(false);
  await expectTextRevealed(page, '.newspaper-reveal', 1_000);
  await expect(page.locator('body')).not.toContainText(retiredCopy);

  const trigger = page.getByRole('button', { name: 'Open menu', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.more-dropdown')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.more-dropdown')).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const fragmentLink = page.locator(`.newspaper-fragments a[href*="/fragments/${fragment.slug}"]`).first();
  await fragmentLink.focus();
  await expect(fragmentLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/fragments/${fragment.slug}/?$`));
  await expect(page.locator('.cms-entry')).toContainText(fragment.content);
  await page.locator('.main-logo').focus();
  await page.keyboard.press('Enter');
  await expectNewspaper(page);
  await expectNoHorizontalOverflow(page);

  await page.locator('.newspaper-text-link[href="/dear-moon/"]').click();
  await expect(page.locator('.coming-inner > p')).toHaveText(dearMoonCopy);
  await expectTextRevealed(page, '.coming-inner > span, .coming-inner h1, .coming-inner > p, .coming-page footer', 1_000);
  await expect(page.locator('body')).not.toContainText(retiredCopy);
});
