import { expect, test, type Page } from '@playwright/test';

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
};

const retiredCopy = /somewhere\s*between\s*alive\s*and\s*archived|the\s*night\s*archive/i;
const calligraphyPhrase = 'words, words and everything in between';
const dearMoonCopy = 'A collection of prose and poetry, coming soon.';

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
      if (url.pathname.endsWith('/gallery_items')) data = photos;
    }
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    await route.fulfill({ status: 200, headers, json: single ? data[0] ?? null : data });
  });
  return {
    requests,
    setState(nextState: CmsResponses) { state = nextState; },
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
  await expect(page.locator('#persistent-video')).toHaveCount(1);
}

async function expectInkComplete(page: Page, timeout = 8_000) {
  const ink = page.locator('.ink-calligraphy');
  await expect(ink).toHaveCount(1);
  await expect(ink.locator('.ink-calligraphy-readable')).toHaveText(calligraphyPhrase);
  await expect(ink).toHaveAttribute('data-ink-started', 'true', { timeout });
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
  await expectNoHorizontalOverflow(page);

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
  // A route remount must show the completed inscription immediately rather
  // than beginning its multi-second write-on sequence for a second time.
  await expectInkComplete(page, 1_000);
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
    await expectNoHorizontalOverflow(page);
  }
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
