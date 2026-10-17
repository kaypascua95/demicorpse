import { expect, test, type Page, type TestInfo } from '@playwright/test';

function makeEntry(collection: 'journal' | 'fragments' | 'archive', id: string, title: string, slug: string, content: string) {
  return {
    id, collection, title, slug, content, excerpt: `A fixture excerpt for ${title.toLowerCase()}.`,
    game: '', type: '', description: content, quote: '', video_url: '', duration: '',
    featured: false, media_layout: 'full', cover_image: null, media: [],
    date: '2026-10-16', status: 'published', tags: [],
    published_at: '2026-10-16T18:00:00Z', created_at: '2026-10-16T18:00:00Z', updated_at: '2026-10-16T18:00:00Z',
  };
}

const journal = [
  makeEntry('journal', 'journal-one', 'A window after rain', 'fixture-window-after-rain', 'The first fixture journal entry keeps an ordinary evening.'),
  makeEntry('journal', 'journal-two', 'The long way home', 'fixture-long-way-home', 'The second fixture journal entry follows another road.'),
];
const fragments = [
  makeEntry('fragments', 'fragment-one', 'A small observation', 'fixture-small-observation', 'The light stayed a little longer than expected.'),
  makeEntry('fragments', 'fragment-two', 'A quiet detail', 'fixture-quiet-detail', 'Some things become clearer when the room goes quiet.'),
];
const entries: Record<string, ReturnType<typeof makeEntry>[]> = {
  journal,
  fragments,
  archive: [makeEntry('archive', 'archive-one', 'An ordinary keepsake', 'fixture-ordinary-keepsake', 'An archive fixture, not a live post.')],
};
const photographs = [
  { id: 'photo-one', caption: 'Fixture moonlit water', image_url: '/hero-still.png', storage_path: null, date: '2026-10-16', location: 'Fixture shore' },
  { id: 'photo-two', caption: 'Fixture second frame', image_url: '/hero-still.png', storage_path: null, date: '2026-10-15', location: 'Fixture window' },
];
const videos = [
  { id: 'video-one', platform: 'YOUTUBE', title: 'Fixture moonlit playthrough', url: 'https://www.youtube.com/watch?v=fixtureVOD1', thumbnail: '/hero-still.png', publishedAt: '2026-10-16T18:00:00Z', duration: '42m', description: 'A deterministic YouTube fixture. No real stream is loaded.' },
  { id: 'video-two', platform: 'TWITCH', title: 'Fixture late-night archive', url: 'https://www.twitch.tv/videos/123456789', thumbnail: '/hero-still.png', publishedAt: '2026-10-15T18:00:00Z', duration: '1h 12m', description: 'A deterministic Twitch fixture. No real stream is loaded.' },
];

async function mockSectionContent(page: Page) {
  // Leave auth untouched; only these public tables and the VOD source belong
  // to these tests. Every external player is fulfilled locally below.
  await page.route(url => /\/rest\/v1\/(?:cms_entries|gallery_items|cms_traces)$/.test(url.pathname), async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname.endsWith('/gallery_items')) {
      await route.fulfill({ status: 200, headers, json: photographs });
      return;
    }
    const collection = url.searchParams.get('collection')?.replace(/^eq\./, '') || '';
    const slug = url.searchParams.get('slug')?.replace(/^eq\./, '');
    const rows = (entries[collection] || []).filter(entry => !slug || entry.slug === slug);
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    await route.fulfill({ status: 200, headers, json: single ? rows[0] ?? null : rows });
  });
  await page.route(url => url.pathname === '/.netlify/functions/stream-vods', route =>
    route.fulfill({ status: 200, json: { videos } }));
  await page.route(url => url.hostname === 'www.youtube-nocookie.com' || url.hostname === 'player.twitch.tv', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>Fixture player. No external media loaded.</body></html>' }));
}

async function expectBrandMoon(page: Page) {
  const home = page.getByRole('button', { name: 'DemiCorpse home', exact: true });
  const moon = home.getByRole('img', { name: 'DemiCorpse moon', exact: true });
  await expect(home).toBeVisible();
  await expect(moon).toBeVisible();
  await expect(moon.locator('image')).toHaveAttribute('href', '/demicorpse-logo.png');
  await expect(moon.locator('image')).toHaveAttribute('clip-path', /^url\(#.+\)$/);
  await expect(home.locator('img')).toHaveCount(0);
}

async function expectSectionLayout(page: Page) {
  await expect(page.locator('.newspaper-section-shell')).toHaveCount(1);
  await expect(page.locator('.newspaper-section-paper main')).toHaveCount(1);
  await expect(page.locator('.newspaper-masthead h1')).toHaveCount(0);
  const mastheadLogo = page.locator('.newspaper-masthead a img');
  await expect(mastheadLogo).toBeVisible();
  await expect(mastheadLogo).toHaveAttribute('src', '/demicorpse-logo.png');
  await expect(page.locator('.newspaper-masthead a')).toHaveAttribute('href', '/?enter=1');
  await expectBrandMoon(page);
  await expect.poll(() => mastheadLogo.evaluate(image => {
    const bounds = image.getBoundingClientRect();
    const lockup = image.parentElement!.getBoundingClientRect();
    return (image as HTMLImageElement).naturalWidth > 0 && bounds.left >= -1 && bounds.right <= innerWidth + 1
      && bounds.left >= lockup.left - 1 && bounds.right <= lockup.right + 1;
  }), { message: 'The original masthead image should load and fit its lockup' }).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
}

async function attachFixtureScreenshot(page: Page, testInfo: TestInfo, section: string) {
  // Record the normal top-of-page view, not a keyboard-focused control or a
  // sticky header stranded at the scroll position of the interaction above.
  // Fonts can change layout and trigger scroll anchoring. Settle them before
  // positioning the capture, rather than allowing them to move it afterward.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  if (section === 'gallery') {
    await expect(page.locator('.gallery-layout-modal')).toHaveCount(0);
    let previousBounds: number[] | undefined;
    let stableSamples = 0;
    await expect.poll(async () => {
      const samples = await page.locator('.gallery-layout-cell').evaluateAll(cells => cells.map(cell => {
        const card = cell.querySelector<HTMLElement>('.gallery-layout-card')!;
        const image = card.querySelector<HTMLImageElement>('img')!;
        const cellBounds = cell.getBoundingClientRect();
        const cardBounds = card.getBoundingClientRect();
        const imageBounds = image.getBoundingClientRect();
        const contained = (bounds: DOMRect) => bounds.width > 0 && bounds.height > 0
          && bounds.left >= cellBounds.left - 1 && bounds.right <= cellBounds.right + 1
          && bounds.top >= cellBounds.top - 1 && bounds.bottom <= cellBounds.bottom + 1;
        return {
          loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
          rendered: getComputedStyle(card).visibility === 'visible' && getComputedStyle(image).visibility === 'visible'
            && Number(getComputedStyle(card).opacity) > 0 && Number(getComputedStyle(image).opacity) > 0,
          contained: contained(cardBounds) && contained(imageBounds),
          animating: card.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'),
          bounds: [cellBounds.x, cellBounds.y, cellBounds.width, cellBounds.height,
            cardBounds.x, cardBounds.y, cardBounds.width, cardBounds.height,
            imageBounds.x, imageBounds.y, imageBounds.width, imageBounds.height],
        };
      }));
      const currentBounds = samples.flatMap(sample => sample.bounds);
      const valid = samples.length === photographs.length
        && samples.every(sample => sample.loaded && sample.rendered && sample.contained && !sample.animating);
      const unchanged = previousBounds?.length === currentBounds.length
        && currentBounds.every((value, index) => Math.abs(value - previousBounds![index]) < 0.1);
      stableSamples = valid && unchanged ? stableSamples + 1 : 0;
      previousBounds = currentBounds;
      // Framer projection can continue on requestAnimationFrame after the
      // modal disappears. Require three settled samples, not a fixed sleep.
      return stableSamples >= 3;
    }, { timeout: 10_000, intervals: [100, 100, 200, 250],
      message: 'Gallery images must load and settle inside their original cells before capture' }).toBe(true);
  }

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const path = testInfo.outputPath(`newspaper-${section}-fixture-${testInfo.project.name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(`${section} ${testInfo.project.name} (mock content fixtures, not live content)`, {
    path, contentType: 'image/png',
  });
}

test.beforeEach(async ({ page }) => { await mockSectionContent(page); });

test('every main landing section shares the newspaper, full masthead, and branded moon home button', async ({ page }) => {
  for (const section of ['journal', 'fragments', 'gallery', 'play', 'dear-moon', 'likas', 'archive', 'colophon']) {
    await page.goto(`/${section}/`);
    await expectSectionLayout(page);
    await expect(page.locator('.newspaper-section-paper h1')).toHaveCount(1);
    await expect(page.locator('.entrance-hero')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/somewhere\s*between\s*alive\s*and\s*archived|the\s*night\s*archive/i);
  }
});

test('journal preserves Squeeze controls, arrow keys, and chronological view', async ({ page }, testInfo) => {
  await page.goto('/journal/');
  await expectSectionLayout(page);
  const carousel = page.locator('.journal-squeeze');
  const activeCopy = carousel.locator('.journal-squeeze-copy-item.is-open');
  const tabs = carousel.getByRole('tab');
  await expect(tabs).toHaveCount(2);
  await expect(activeCopy).toContainText(journal[0].title);
  await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

  await carousel.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(activeCopy).toContainText(journal[1].title);
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await carousel.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(activeCopy).toContainText(journal[0].title);
  await tabs.nth(0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(activeCopy).toContainText(journal[1].title);
  await page.keyboard.press('ArrowLeft');
  await expect(activeCopy).toContainText(journal[0].title);

  await page.getByRole('button', { name: 'CHRONOLOGICAL', exact: true }).click();
  await expect(page.locator('.dc-timeline-item')).toHaveCount(2);
  await expect(page.locator('.dc-timeline')).toContainText(journal[0].title);
  await expect(carousel).toHaveCount(0);
  await page.getByRole('button', { name: 'FEATURED', exact: true }).click();
  await expect(carousel).toBeVisible();
  await expect(tabs).toHaveCount(2);
  await expect(activeCopy.getByRole('link', { name: /Read entry/ })).toHaveAttribute('href', `/journal/${journal[0].slug}`);
  await attachFixtureScreenshot(page, testInfo, 'journal');
});

test('fragments retains the marquee carousel and chronological timeline', async ({ page }, testInfo) => {
  await page.goto('/fragments/');
  await expectSectionLayout(page);
  const carousel = page.locator('.fragment-marquee-stage');
  await expect(carousel).toBeVisible();
  await expect(carousel).toContainText(fragments[0].content);
  await expect(page.getByRole('button', { name: 'CAROUSEL', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'CHRONOLOGICAL', exact: true }).click();
  await expect(carousel).toHaveCount(0);
  await expect(page.locator('.dc-timeline-item')).toHaveCount(2);
  await expect(page.locator('.dc-timeline')).toContainText(fragments[1].title);
  await page.getByRole('button', { name: 'CAROUSEL', exact: true }).click();
  await expect(carousel).toBeVisible();
  await expect(page.locator('.dc-timeline')).toHaveCount(0);
  await attachFixtureScreenshot(page, testInfo, 'fragments');
});

test('gallery preserves LayoutGrid selection and close behavior', async ({ page }, testInfo) => {
  await page.goto('/gallery/');
  await expectSectionLayout(page);
  const cards = page.locator('.gallery-layout-card');
  await expect(cards).toHaveCount(2);
  await cards.first().click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(photographs[0].caption);
  await modal.getByRole('button', { name: 'Close image', exact: true }).click();
  await expect(modal).toHaveCount(0);

  await cards.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText(photographs[1].caption);
  await modal.getByRole('button', { name: 'Close image', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(cards).toHaveCount(2);
  await attachFixtureScreenshot(page, testInfo, 'gallery');
});

test('Play preserves VOD filtering and both embedded player open-close flows', async ({ page }) => {
  await page.goto('/play/');
  await expectSectionLayout(page);
  const cards = page.locator('.play-grid .play-card');
  const filters = page.locator('.play-filters');
  await expect(cards).toHaveCount(2);
  await filters.getByRole('button', { name: 'TWITCH', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText(videos[1].title);
  await filters.getByRole('button', { name: 'YOUTUBE', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText(videos[0].title);
  await filters.getByRole('button', { name: 'ALL', exact: true }).click();
  await expect(cards).toHaveCount(2);

  for (const video of videos) {
    await cards.filter({ hasText: video.title }).locator('.play-card-open').click();
    const player = page.locator('.play-player');
    await expect(player).toBeVisible();
    await expect(player.getByRole('heading', { level: 2 })).toHaveText(video.title);
    await expect(page.locator('body')).toHaveClass(/vod-open/);
    await expect(player.locator('iframe')).toHaveAttribute('src', video.platform === 'YOUTUBE'
      ? /youtube-nocookie\.com\/embed\/fixtureVOD1/
      : /player\.twitch\.tv\/\?video=123456789/);
    await expect(page.frameLocator('.play-player iframe').getByText('Fixture player. No external media loaded.')).toBeVisible();
    await player.getByRole('button', { name: /Close player/ }).click();
    await expect(player).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/vod-open/);
    await expect(page.locator('.play-feature')).toBeVisible();
  }
});

test('LIKAS retains its external project button and section masthead returns home', async ({ page }) => {
  await page.goto('/likas/');
  await expectSectionLayout(page);
  const visit = page.getByRole('link', { name: /VISIT LIKAS/ });
  await expect(visit).toHaveAttribute('href', 'https://likas.app');
  await expect(visit).toHaveAttribute('target', '_blank');
  await expect(visit).toHaveAttribute('rel', /noopener/);
  await expect(visit.locator('.likas-enter-fill')).toHaveCount(1);
  await page.locator('.newspaper-masthead a').click();
  await expect(page).toHaveURL(/\/\?enter=1$/);
  await expect(page.locator('main.newspaper-page')).toBeVisible();
  await expect(page.locator('.newspaper-masthead h1 img')).toHaveAttribute('src', '/demicorpse-logo.png');
  await expectBrandMoon(page);
});

test('detail and admin routes keep their existing surfaces outside the landing wrapper', async ({ page }) => {
  await page.goto(`/journal/${journal[0].slug}`);
  await expect(page.locator('.cms-entry')).toContainText(journal[0].content);
  await expect(page.locator('.newspaper-section-shell')).toHaveCount(0);
  await expect(page.locator('.newspaper-masthead')).toHaveCount(0);
  await expectBrandMoon(page);
  await page.goto('/admin');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.locator('.newspaper-section-shell')).toHaveCount(0);
  await expect(page.locator('.newspaper-masthead')).toHaveCount(0);
  await expectBrandMoon(page);
});
