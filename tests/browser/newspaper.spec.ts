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

type CmsState = 'content' | 'empty' | 'error';

/** Keep every content assertion independent of the deployed CMS and its data. */
async function mockCms(page: Page, state: CmsState = 'content') {
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
    if (state === 'error') {
      await route.fulfill({
        status: 503,
        headers,
        json: { code: 'TEST_UNAVAILABLE', message: 'The test archive is unavailable.' },
      });
      return;
    }

    let data: Array<typeof fragment | typeof photograph> = [];
    if (state === 'content') {
      if (url.pathname.endsWith('/cms_entries') && url.searchParams.get('collection') === 'eq.fragments') {
        const slug = url.searchParams.get('slug');
        data = !slug || slug === `eq.${fragment.slug}` ? [fragment] : [];
      }
      if (url.pathname.endsWith('/gallery_items')) data = [photograph];
    }
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    await route.fulfill({ status: 200, headers, json: single ? data[0] ?? null : data });
  });
  return {
    requests,
    setState(nextState: CmsState) { state = nextState; },
  };
}

async function expectNewspaper(page: Page) {
  await expect(page.locator('main.newspaper-page')).toBeVisible();
  await expect(page.locator('.newspaper-masthead').getByRole('heading', { level: 1, name: 'DemiCorpse', exact: true })).toBeVisible();
  await expect(page.locator('.newspaper-page h1')).toHaveCount(1);
  await expect(page.locator('.main-header')).toHaveCount(1);
  await expect(page.locator('#persistent-video')).toHaveCount(1);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    documentFits: document.documentElement.scrollWidth <= window.innerWidth,
    bodyFits: document.body.scrollWidth <= window.innerWidth,
  })), { message: 'Neither the document nor the body should overflow horizontally' })
    .toEqual({ documentFits: true, bodyFits: true });
}

test('the unchanged entrance gates the newspaper and repeated Enter is safe', async ({ page }) => {
  await mockCms(page);
  await page.goto('/');
  const entrance = page.locator('.entrance-hero');
  await expect(entrance).toBeVisible();
  await expect(entrance.locator('.landing-logo')).toHaveAttribute('src', '/demicorpse-logo.png');
  await expect(entrance).toContainText('SOMEWHERE BETWEEN ALIVE AND ARCHIVED.');
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

  const screenshotPath = testInfo.outputPath(`newspaper-fixture-${testInfo.project.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
  await testInfo.attach(`Newspaper ${testInfo.project.name} (mock CMS fixtures, not live content)`, {
    path: screenshotPath,
    contentType: 'image/png',
  });
});

test('newspaper columns and masthead fit narrow, tablet, and wide viewports', async ({ page }) => {
  await mockCms(page);
  await page.goto('/?enter=1');
  await expectNewspaper(page);
  await expect(page.locator('.newspaper-fragments')).toContainText(fragment.excerpt);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.newspaper-masthead')).toBeVisible();
    // A hidden horizontal overflow rule on body must not conceal a clipped
    // wordmark. Its own text must fit its column as well as the viewport.
    await expect.poll(() => page.locator('.newspaper-masthead h1').evaluate(heading => {
      const bounds = heading.getBoundingClientRect();
      return {
        textFits: heading.scrollWidth <= heading.clientWidth + 1,
        withinViewport: bounds.left >= -1 && bounds.right <= innerWidth + 1,
      };
    }), { message: `The complete masthead must fit at ${width}px` })
      .toEqual({ textFits: true, withinViewport: true });
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
});
