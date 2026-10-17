import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { Entry } from '../../src/lib/cms';

// Every identity, entry, upload, and trace in this file is a local test fixture.
// The real application sign-in and owner/MFA checks still run. No debug route,
// production credentials, injected React state, or live CMS writes are used.
const cmsOrigin = 'https://cms-test.supabase.co';
const testEmail = 'fixture.owner@example.test';
const testPassword = 'fixture-password-not-a-real-credential';
const imageFixture = 'public/hero-still.png';
const longLink = `https://example.test/${'a-long-unbroken-fixture-reference-'.repeat(5)}`;
const prose = `## What the evening kept\n\nThis is fixture writing, not a live journal entry. The room grew quiet, and the small things became easier to notice.\n\n${Array.from({ length: 4 }, (_, index) => `A paragraph from the fixture notebook, ${index + 1}. We followed the light across the wall and left enough room for the story to breathe.`).join('\n\n')}\n\n### A second thought\n\n- A window after rain\n- A song from another room\n\n[A fixture reference](https://example.test/reading) and [${longLink}](${longLink}) remain ordinary links.\n\n**Something worth keeping.**`;
function entry(id: string, collection: 'journal' | 'fragments', title: string, status: 'draft' | 'published' = 'published'): Entry {
  return {
    id, collection, title, slug: `fixture-${id}`, status, content: prose,
    excerpt: 'A fixture excerpt about the ordinary things that stay with us.',
    quote: 'Not everything needs to become a story to be worth keeping.',
    game: '', type: '', description: '', video_url: '', duration: '', featured: false,
    media_layout: 'full', cover_image: `${id}/cover.png`, media: [`${id}/cover.png`, `${id}/detail.png`],
    tags: ['fixture', 'after rain'], date: '2026-10-16',
    created_at: '2026-10-16T18:00:00Z', updated_at: '2026-10-16T18:00:00Z',
    published_at: status === 'published' ? '2026-10-16T18:00:00Z' : null,
  };
}
const journal = entry('journal-reading', 'journal', 'A window after rain');
const secondJournal = { ...entry('journal-return', 'journal', 'The long way home'), cover_image: null, media: [], content: 'A different fixture entry, without a cover.' };
const privateJournal = entry('journal-private', 'journal', 'The private notebook', 'draft');
const fragment = { ...entry('fragment-reading', 'fragments', 'A little evidence'), excerpt: '', quote: '', content: '## A small observation\n\nThe light stayed a little longer than expected.\n\n[A fixture reference](https://example.test/reading)' };
const secondFragment = { ...entry('fragment-return', 'fragments', 'A quiet detail'), cover_image: null, media: [], content: 'A second fixture thought, held in the margin.' };

type Access = 'owner' | 'denied' | 'mfa' | 'login-error' | 'identity-error';
type FixtureRequest = { method: string; path: string; authorization: string; query: string };
type FixtureState = {
  requests: FixtureRequest[];
  mutations: FixtureRequest[];
  unexpected: string[];
  token: string;
  failReads: number;
  failSaves: boolean;
  failUploads: boolean;
};
const fixtureStates = new WeakMap<Page, FixtureState>();
async function mockCms(page: Page, access: Access = 'owner') {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', aal: access === 'mfa' ? 'aal1' : 'aal2', exp: now + 3600, iat: now })}.fixture-signature-not-valid-on-any-server`;
  const state: FixtureState = { requests: [], mutations: [], unexpected: [], token, failReads: 0, failSaves: false, failUploads: false };
  fixtureStates.set(page, state);
  const rows = structuredClone([journal, secondJournal, privateJournal, fragment, secondFragment]);
  const user = {
    id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: testEmail,
    email_confirmed_at: '2026-10-16T18:00:00Z', created_at: '2026-10-16T18:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    factors: [{ id: 'fixture-factor', factor_type: 'totp', status: 'verified', friendly_name: 'Fixture authenticator', created_at: '2026-10-16T18:00:00Z', updated_at: '2026-10-16T18:00:00Z' }],
  };
  await page.route(url => url.origin === cmsOrigin, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    const record = { method: request.method(), path: url.pathname, authorization: request.headers().authorization || '', query: url.search };
    state.requests.push(record);
    const ownerRequest = record.authorization === `Bearer ${token}` && access === 'owner';
    const respond = (json: unknown, status = 200) => route.fulfill({ status, headers, json });
    if (url.pathname === '/auth/v1/token' && request.method() === 'POST' && url.searchParams.get('grant_type') === 'password') {
      if (access === 'login-error') { await respond({ code: 'invalid_credentials', msg: 'Fixture sign-in was rejected.' }, 400); return; }
      await respond({ access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'fixture-refresh-token-not-valid-on-any-server', user });
      return;
    }
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET') { await respond(user); return; }
    if (url.pathname === '/auth/v1/logout' && request.method() === 'POST') { await route.fulfill({ status: 204, headers }); return; }
    if (url.pathname === '/rest/v1/rpc/cms_is_owner_account') {
      if (access === 'identity-error') await respond({ message: 'Fixture access check is unavailable.' }, 503);
      else await respond(access !== 'denied');
      return;
    }
    if (url.pathname === '/rest/v1/rpc/cms_is_owner') { await respond(access === 'owner'); return; }
    if (url.pathname === '/rest/v1/cms_entries') {
      if (request.method() === 'GET') {
        if (state.failReads > 0) { state.failReads--; await respond({ message: 'Fixture archive temporarily unavailable.' }, 503); return; }
        const collection = url.searchParams.get('collection')?.replace(/^eq\./, '');
        const slug = url.searchParams.get('slug')?.replace(/^eq\./, '');
        const status = url.searchParams.get('status')?.replace(/^eq\./, '');
        const found = rows.filter(row => (!collection || row.collection === collection) && (!slug || row.slug === slug)
          && (!status || row.status === status) && (ownerRequest || row.status === 'published'));
        await respond(request.headers().accept?.includes('application/vnd.pgrst.object+json') ? found[0] ?? null : found);
        return;
      }
      state.mutations.push(record);
      if (!ownerRequest) { await respond({ message: 'Fixture publishing access denied.' }, 403); return; }
      if (state.failSaves) { await respond({ message: 'Fixture save was rejected. Your changes remain here.' }, 409); return; }
      if (request.method() === 'PATCH' || request.method() === 'POST') {
        const incoming = request.postDataJSON() as Entry;
        const id = url.searchParams.get('id')?.replace(/^eq\./, '') || incoming.id;
        const index = rows.findIndex(row => row.id === id);
        const saved = { ...(index >= 0 ? rows[index] : journal), ...incoming, id, updated_at: new Date().toISOString() };
        if (index >= 0) rows[index] = saved; else rows.push(saved);
        await respond(request.headers().accept?.includes('application/vnd.pgrst.object+json') ? saved : [saved]);
        return;
      }
    }
    if (url.pathname === '/rest/v1/gallery_items' && request.method() === 'GET') {
      await respond([{ id: 'fixture-photograph', caption: 'Fixture moonlit water', date: '2026-10-16', location: 'Fixture shore', status: 'published', storage_path: 'gallery/fixture.png' }]);
      return;
    }
    if (url.pathname === '/rest/v1/cms_traces' && request.method() === 'GET') {
      await respond([{ id: 'fixture-trace', name: 'Fixture reader', body: 'A fixture note left in the margin.', author_reply: 'Thank you for staying a while.', created_at: '2026-10-16T19:00:00Z' }]);
      return;
    }
    if (url.pathname.startsWith('/storage/v1/object/cms-media/')) {
      if (request.method() === 'GET') {
        if (url.pathname.includes('/journal-private/') && !ownerRequest) { await respond({ message: 'Fixture private media denied.' }, 403); return; }
        await route.fulfill({ status: 200, headers, contentType: 'image/png', path: imageFixture });
        return;
      }
      state.mutations.push(record);
      if (request.method() === 'POST' && ownerRequest) {
        if (state.failUploads) await respond({ statusCode: '503', error: 'Fixture upload unavailable', message: 'Fixture upload unavailable.' }, 503);
        else await respond({ Key: url.pathname.replace('/storage/v1/object/', ''), Id: 'fixture-upload' });
        return;
      }
    }
    // A forgotten endpoint cannot silently fall through to any service.
    state.unexpected.push(`${request.method()} ${url.pathname}`);
    await respond({ message: 'Unexpected fixture request, blocked locally.' }, 501);
  });
  return state;
}

test.afterEach(async ({ page }) => {
  expect(fixtureStates.get(page)?.unexpected ?? [], 'Every CMS request must be explicitly fulfilled by local fixtures').toEqual([]);
});

async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: 'The newspaper surface must fit the viewport' }).toBe(true);
}
async function expectReadingPaper(page: Page, collection: 'journal' | 'fragments', title: string) {
  await expect(page.locator('.newspaper-section-paper .newspaper-entry-page')).toBeVisible();
  await expect(page.locator('.newspaper-section-paper')).toHaveCSS('background-color', 'rgb(234, 227, 213)');
  await expect(page.locator(`.newspaper-reading-entry--${collection}`)).toBeVisible();
  await expect(page.locator('.newspaper-reading-entry > header h1')).toHaveText(title);
  await expect(page.locator('.newspaper-reading-entry > header h1')).toHaveCSS('color', 'rgb(23, 24, 20)');
  await expect(page.locator('.newspaper-reading-entry .cms-prose')).toHaveCSS('color', 'rgb(23, 24, 20)');
  await expect(page.locator('.newspaper-masthead h1')).toHaveCount(0);
  await expect(page.locator('.newspaper-masthead a img')).toHaveAttribute('src', '/demicorpse-logo.png');
  await expect(page.locator('.newspaper-header .brand-moon image')).toHaveAttribute('href', '/demicorpse-logo.png');
  await expect(page.getByRole('link', { name: `← ${collection}`, exact: true })).toHaveAttribute('href', `/${collection}/`);
  await expectNoOverflow(page);
}
async function expectLoadedMedia(images: Locator, expectedCount = 2) {
  // Media mounts a loading status until its Storage download resolves. Wait
  // for every expected image, including after a repeated preview remount.
  await expect(images).toHaveCount(expectedCount);
  for (let index = 0; index < expectedCount; index++) {
    await images.nth(index).scrollIntoViewIfNeeded();
    await expect(images.nth(index)).toHaveAttribute('src', /^blob:/);
  }
  await expect.poll(() => images.evaluateAll((nodes, count) => nodes.length === count && nodes.every(node => {
    const image = node as HTMLImageElement;
    const rect = image.getBoundingClientRect();
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 && rect.width > 0 && rect.height > 0;
  }), expectedCount), { message: 'Every fixture storage image must really decode and render' }).toBe(true);
  return images.evaluateAll(nodes => nodes.map(node => (node as HTMLImageElement).src));
}
async function expectRevoked(page: Page, urls: string[]) {
  await expect.poll(() => page.evaluate(async values => Promise.all(values.map(async url => {
    try { return (await fetch(url)).ok; } catch { return false; }
  })), urls)).toEqual(urls.map(() => false));
}
async function screenshot(page: Page, testInfo: TestInfo, surface: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await page.mouse.move(0, 0);
  await expectNoOverflow(page);
  const path = testInfo.outputPath(`newspaper-${surface}-fixture-${testInfo.project.name}.png`);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  await testInfo.attach(`${surface} ${testInfo.project.name} (local content and auth fixtures, not live CMS)`, { path, contentType: 'image/png' });
}
async function signIn(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email', { exact: true }).fill(testEmail);
  await page.getByLabel('Password', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function expectOwner(page: Page) {
  await expect(page.getByRole('navigation', { name: 'Collections', exact: true })).toBeVisible();
  await expect(page.locator('.cms-list-item').filter({ hasText: privateJournal.title })).toBeVisible();
  await expect(page.locator('.newspaper-admin')).toBeVisible();
  await expect(page.locator('.newspaper-admin')).toHaveCSS('background-color', 'rgb(234, 227, 213)');
  await expect(page.locator('.newspaper-admin')).toHaveCSS('border-top-style', 'double');
  await expect(page.locator('.newspaper-header')).toBeVisible();
  await expect(page.locator('.newspaper-masthead')).toHaveCount(0);
  await expectNoOverflow(page);
}
async function answerConfirmation(page: Page, message: string, accept: boolean, action: () => Promise<unknown>) {
  const dialog = page.waitForEvent('dialog');
  const started = action();
  const confirmation = await dialog;
  expect(confirmation.type()).toBe('confirm');
  expect(confirmation.message()).toBe(message);
  if (accept) await confirmation.accept(); else await confirmation.dismiss();
  await started;
}

// Both Playwright projects run every test, providing desktop and mobile QA.
test('journal deep links keep full newspaper identity, longform media and repeated back/forward entry navigation', async ({ page }, testInfo) => {
  const fixture = await mockCms(page);
  await page.goto(`/journal/${journal.slug}`);
  await expectReadingPaper(page, 'journal', journal.title);
  await expect(page.getByRole('heading', { name: 'What the evening kept', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A second thought', level: 3 })).toBeVisible();
  await expect(page.locator('.journal-pullquote')).toContainText(journal.quote);
  await expect(page.locator('.cms-tags')).toHaveText('fixture / after rain');
  await expect(page.getByRole('link', { name: 'A fixture reference', exact: true })).toHaveAttribute('href', 'https://example.test/reading');
  await expect(page.locator('.newspaper-reading-entry img.cms-media')).toHaveCount(2);
  const originalBlobs = await expectLoadedMedia(page.locator('.newspaper-reading-entry img.cms-media'));
  await screenshot(page, testInfo, 'journal-entry');
  await page.getByRole('link', { name: '← journal', exact: true }).click();
  await expect(page).toHaveURL(/\/journal\/$/);
  await expectRevoked(page, originalBlobs);
  await page.getByRole('button', { name: 'CHRONOLOGICAL', exact: true }).click();
  await page.locator('.dc-timeline').getByRole('link', { name: new RegExp(secondJournal.title) }).click();
  await expectReadingPaper(page, 'journal', secondJournal.title);
  await expect(page.locator('.newspaper-reading-entry img')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/journal\/$/);
  await page.goBack();
  await expectReadingPaper(page, 'journal', journal.title);
  const returningBlobs = await expectLoadedMedia(page.locator('.newspaper-reading-entry img.cms-media'));
  expect(returningBlobs.every(url => !originalBlobs.includes(url))).toBe(true);
  await page.goForward();
  await expect(page).toHaveURL(/\/journal\/$/);
  await page.goForward();
  await expectReadingPaper(page, 'journal', secondJournal.title);
  expect(fixture.mutations).toEqual([]);
});

test('fragment deep links preserve reading paper, traces, media and collection return', async ({ page }, testInfo) => {
  const fixture = await mockCms(page);
  await page.goto(`/fragments/${fragment.slug}`);
  await expectReadingPaper(page, 'fragments', fragment.title);
  await expect(page.getByRole('heading', { name: 'A small observation', level: 2 })).toBeVisible();
  await expectLoadedMedia(page.locator('.newspaper-reading-entry img.cms-media'));
  await expect(page.locator('.trace-comment')).toContainText('Fixture reader');
  await expect(page.locator('.trace-reply')).toContainText('Thank you for staying a while.');
  await expect(page.getByLabel('Name or alias', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Your trace', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave trace', exact: true })).toBeDisabled();
  await screenshot(page, testInfo, 'fragment-entry');
  await page.getByRole('link', { name: '← fragments', exact: true }).click();
  await expect(page).toHaveURL(/\/fragments\/$/);
  await page.getByRole('button', { name: 'CHRONOLOGICAL', exact: true }).click();
  await page.locator('.dc-timeline').getByRole('link', { name: new RegExp(fragment.title) }).click();
  await expectReadingPaper(page, 'fragments', fragment.title);
  expect(fixture.mutations).toEqual([]);
});

test('fragment image lightbox keeps paper styling, close, backdrop and reopen behavior', async ({ page }, testInfo) => {
  const fixture = await mockCms(page);
  await page.goto('/fragments/');
  const imageButton = page.locator('.fragment-marquee-media').first();
  await expect(imageButton).toBeVisible();
  // Hover pauses the existing marquee; use keyboard activation so animated
  // copies never require force clicks or injected CSS in the visual capture.
  await page.locator('.fragment-marquee-track').first().hover();
  await imageButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Fragment image', exact: true });
  await expect(dialog).toHaveClass(/newspaper-fragment-lightbox/);
  await expectLoadedMedia(dialog.locator('img.cms-media'), 1);
  await screenshot(page, testInfo, 'fragment-image-dialog');
  await dialog.getByRole('button', { name: 'Close image', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await imageButton.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 8, y: 8 } });
  await expect(dialog).toHaveCount(0);
  await imageButton.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close image', exact: true }).click();
  await page.getByRole('button', { name: 'CHRONOLOGICAL', exact: true }).click();
  await page.locator('.dc-timeline').getByRole('link', { name: new RegExp(fragment.title) }).click();
  await expectReadingPaper(page, 'fragments', fragment.title);
  expect(fixture.mutations).toEqual([]);
});

test('unavailable and retrying detail routes remain on paper without exposing private entries', async ({ page }) => {
  const fixture = await mockCms(page);
  await page.goto(`/journal/${privateJournal.slug}`);
  await expect(page.locator('.newspaper-entry-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nothing here.', exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(privateJournal.title);
  fixture.failReads = Infinity;
  const readsBeforeFailure = fixture.requests.filter(request => request.path === '/rest/v1/cms_entries').length;
  await page.goto(`/journal/${journal.slug}`);
  await expect(page.getByRole('alert')).toHaveText('The archive couldn’t be loaded.', { timeout: 15_000 });
  expect(fixture.requests.filter(request => request.path === '/rest/v1/cms_entries').length - readsBeforeFailure).toBeGreaterThanOrEqual(4);
  fixture.failReads = 0;
  await expect(page.locator('.newspaper-entry-page')).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expectReadingPaper(page, 'journal', journal.title);
  expect(fixture.mutations).toEqual([]);
});

test('newspaper admin login keeps labeled, protected fields and honest sign-in errors', async ({ page }, testInfo) => {
  const fixture = await mockCms(page, 'login-error');
  await page.goto('/admin');
  await expect(page.locator('.newspaper-admin')).toBeVisible();
  await expect(page.locator('.newspaper-admin')).toHaveCSS('background-color', 'rgb(234, 227, 213)');
  await expect(page.locator('.newspaper-admin')).toHaveCSS('border-top-style', 'double');
  await expect(page.locator('.newspaper-header')).toBeVisible();
  const email = page.getByLabel('Email', { exact: true });
  const password = page.getByLabel('Password', { exact: true });
  await expect(email).toHaveAttribute('autocomplete', 'username');
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.getByRole('navigation', { name: 'Collections' })).toHaveCount(0);
  await expect(page.locator('.cms-editor')).toHaveCount(0);
  await email.focus();
  await expect(email).toBeFocused();
  await expect.poll(() => email.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await screenshot(page, testInfo, 'admin-login');
  await email.fill(testEmail);
  await password.fill(testPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Fixture sign-in was rejected.');
  await expect(password).toHaveValue('');
  await expect(page.locator('.cms-editor')).toHaveCount(0);
  expect(fixture.requests.some(request => request.path === '/rest/v1/cms_entries')).toBe(false);
});

test('non-owner, password-only and failed owner checks never expose the publishing workspace', async ({ page }, testInfo) => {
  // Fresh contexts prevent a previous fixture session affecting the next gate.
  for (const access of ['denied', 'mfa', 'identity-error'] as const) {
    const { viewport, deviceScaleFactor, hasTouch, isMobile, userAgent } = testInfo.project.use;
    const context = await page.context().browser()!.newContext({ viewport, deviceScaleFactor, hasTouch, isMobile, userAgent, baseURL: 'http://127.0.0.1:4173' });
    const isolated = await context.newPage();
    const fixture = await mockCms(isolated, access);
    await signIn(isolated);
    if (access === 'denied') await expect(isolated.getByRole('heading', { name: 'This room is private.', exact: true })).toBeVisible();
    else if (access === 'mfa') {
      await expect(isolated.getByLabel('Authenticator code', { exact: true })).toBeVisible();
      await expect(isolated.getByRole('button', { name: 'Verify and open archive', exact: true })).toBeDisabled();
      await expect(isolated.locator('body')).toContainText('There is no password-only bypass.');
      await screenshot(isolated, testInfo, 'admin-mfa');
    } else await expect(isolated.getByRole('alert')).toContainText('Fixture access check is unavailable.');
    await expect(isolated.locator('.cms-editor')).toHaveCount(0);
    await expect(isolated.getByRole('navigation', { name: 'Collections' })).toHaveCount(0);
    expect(fixture.requests.some(request => request.path === '/rest/v1/cms_entries')).toBe(false);
    expect(fixture.unexpected).toEqual([]);
    await context.close();
  }
});

test('owner dashboard, full editor, upload, private preview and public-session separation remain usable', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const fixture = await mockCms(page);
  await signIn(page);
  await expectOwner(page);
  expect(fixture.requests.some(request => request.path.endsWith('/cms_is_owner_account'))).toBe(true);
  expect(fixture.requests.some(request => request.path.endsWith('/cms_is_owner'))).toBe(true);
  await screenshot(page, testInfo, 'admin-dashboard');
  const collections = page.getByRole('navigation', { name: 'Collections', exact: true });
  await collections.getByRole('button', { name: 'gallery', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add a photograph.', exact: true })).toBeVisible();
  await expect(page.getByLabel('Caption', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Date', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Location (optional)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Upload gallery photograph', { exact: true })).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Upload & publish', exact: true })).toBeDisabled();
  await expect(page.locator('.gallery-admin-list')).toContainText('Fixture moonlit water');
  await screenshot(page, testInfo, 'admin-gallery');
  expect(fixture.mutations).toEqual([]);
  await collections.getByRole('button', { name: 'journal', exact: true }).click();
  await expectOwner(page);
  await page.locator('.cms-list-item').filter({ hasText: privateJournal.title }).click();
  for (const label of ['Title', 'Date', 'Address / slug', 'Tags / separated by commas']) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  }
  // React initializes textarea textContent with its value. Label text matching
  // can include that content, while the accessible textbox name stays stable.
  for (const [name, value] of [
    ['A few words before the entry', privateJournal.excerpt],
    ['Pull quote / highlighted thought', privateJournal.quote],
    ['Writing / Markdown', privateJournal.content],
  ]) {
    const textbox = page.getByRole('textbox', { name, exact: true });
    await expect(textbox).toBeVisible();
    await expect(textbox).toHaveValue(value);
  }
  await expect(page.getByLabel('Image layout')).toHaveValue('full');
  await expect(page.getByLabel('Upload media', { exact: true })).toHaveAttribute('type', 'file');
  await expect(page.getByLabel('Choose image', { exact: true })).toHaveAttribute('type', 'file');
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
  await expectLoadedMedia(page.locator('.cms-upload img.cms-media'));
  await screenshot(page, testInfo, 'admin-editor');

  await page.getByLabel('Choose image', { exact: true }).setInputFiles(imageFixture);
  await expect(page.getByRole('img', { name: 'Selected image', exact: true })).toBeVisible();
  const addImage = page.getByRole('button', { name: 'Add image', exact: true });
  const changeImage = page.getByRole('button', { name: 'Change image', exact: true });
  await expect(addImage).toBeEnabled();
  await expect(changeImage).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Remove image', exact: true })).toBeEnabled();
  await expect.poll(() => addImage.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.height >= 44 && rect.width >= 44;
  })).toBe(true);
  await screenshot(page, testInfo, 'admin-upload-selected');
  await addImage.click();
  await expect(page.locator('.cms-message[role="status"]')).toContainText('Media uploaded and saved.');
  await expect(page.locator('.cms-upload')).toHaveCount(3);
  await expect(page.getByRole('img', { name: 'Selected image', exact: true })).toHaveCount(0);
  expect(fixture.mutations.some(request => request.method === 'POST' && request.path.startsWith('/storage/v1/object/cms-media/'))).toBe(true);
  expect(fixture.mutations.some(request => request.method === 'PATCH' && request.path === '/rest/v1/cms_entries')).toBe(true);

  await page.getByLabel('Title', { exact: true }).fill('An unsaved private fixture');
  await page.getByRole('textbox', { name: 'Writing / Markdown', exact: true }).fill(`${prose}\n\nOnly this private preview includes this unsaved sentence.`);
  const writesBeforePreview = fixture.mutations.length;
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('.cms-preview-label')).toHaveText('PRIVATE PREVIEW · includes unsaved changes');
    await expect(page.locator('.newspaper-reading-entry')).toContainText('Only this private preview includes this unsaved sentence.');
    await expect(page.locator('.newspaper-reading-entry > header h1')).toHaveText('An unsaved private fixture');
    await expectLoadedMedia(page.locator('.newspaper-reading-entry img.cms-media'), 3);
    if (repeat === 0) await screenshot(page, testInfo, 'admin-private-preview');
    await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('An unsaved private fixture');
    await expect(page.locator('.cms-editor-top')).toContainText('UNSAVED');
  }
  expect(fixture.mutations.length).toBe(writesBeforePreview);
  expect(fixture.requests.filter(request => request.path.includes('/journal-private/') && request.method === 'GET').every(request => request.authorization === `Bearer ${fixture.token}`)).toBe(true);
  await answerConfirmation(page, 'Leave without saving your changes?', true, () => page.getByRole('button', { name: 'JOURNAL', exact: true }).click());
  await expect(page).toHaveURL(/\/journal\/$/);
  await page.goto(`/journal/${privateJournal.slug}`);
  await expect(page.getByRole('heading', { name: 'Nothing here.', exact: true })).toBeVisible();
  const publicReads = fixture.requests.filter(request => request.path === '/rest/v1/cms_entries' && new URLSearchParams(request.query).get('status') === 'eq.published');
  expect(publicReads.length).toBeGreaterThan(0);
  expect(publicReads.every(request => request.authorization !== `Bearer ${fixture.token}`)).toBe(true);
});

test('dirty edits survive canceled navigation, repeated preview, failed save and failed upload', async ({ page }) => {
  const fixture = await mockCms(page);
  await signIn(page);
  await expectOwner(page);
  await page.locator('.cms-list-item').filter({ hasText: journal.title }).click();
  const title = page.getByLabel('Title', { exact: true });
  await title.fill('Unsaved fixture changes');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.newspaper-reading-entry > header h1')).toHaveText('Unsaved fixture changes');
  await answerConfirmation(page, 'Leave without saving your changes?', false, () => page.getByRole('link', { name: 'View public entry →', exact: true }).click());
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('.cms-preview-label')).toBeVisible();
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  await expect(title).toHaveValue('Unsaved fixture changes');
  await answerConfirmation(page, 'Discard unsaved changes?', false, () => page.locator('.cms-list-item').filter({ hasText: secondJournal.title }).click());
  await expect(title).toHaveValue('Unsaved fixture changes');
  await answerConfirmation(page, 'Discard unsaved changes?', false, () => page.getByRole('navigation', { name: 'Collections', exact: true }).getByRole('button', { name: 'fragments', exact: true }).click());
  await expect(title).toHaveValue('Unsaved fixture changes');
  await answerConfirmation(page, 'Sign out and discard unsaved changes?', false, () => page.getByRole('button', { name: 'Sign out', exact: true }).click());
  await expect(title).toHaveValue('Unsaved fixture changes');
  expect(fixture.mutations).toEqual([]);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.newspaper-reading-entry > header h1')).toHaveText('Unsaved fixture changes');
  await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  fixture.failSaves = true;
  await page.getByRole('button', { name: 'Save published changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Fixture save was rejected. Your changes remain here.');
  await expect(title).toHaveValue('Unsaved fixture changes');
  await expect(page.locator('.cms-editor-top')).toContainText('UNSAVED');
  fixture.failSaves = false;
  fixture.failUploads = true;
  await page.getByLabel('Upload media', { exact: true }).setInputFiles(imageFixture);
  await expect(page.getByRole('alert')).toContainText('Fixture upload unavailable.', { timeout: 15_000 });
  expect(fixture.mutations.some(request => request.method === 'POST' && request.path.startsWith('/storage/v1/object/cms-media/'))).toBe(true);
  await expect(title).toHaveValue('Unsaved fixture changes');
  await expect(page.getByRole('button', { name: 'Save published changes', exact: true })).toBeEnabled();
  await expectNoOverflow(page);
  await answerConfirmation(page, 'Discard unsaved changes?', true, () => page.locator('.cms-list-item').filter({ hasText: secondJournal.title }).click());
  await expect(title).toHaveValue(secondJournal.title);
  await expect(page.locator('.cms-editor-top')).not.toContainText('UNSAVED');
  await page.getByRole('link', { name: 'View public entry →', exact: true }).click();
  await expectReadingPaper(page, 'journal', secondJournal.title);
  await page.goBack();
  await expectOwner(page);
  await expect(page.locator('.cms-empty')).toBeVisible();
});
