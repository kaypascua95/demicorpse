import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { Entry } from '../../src/lib/cms';

// Fixture-only public reads and sign-in. Every CMS endpoint is intercepted;
// neither a missing mock nor an accidental mutation can reach a live service.
const cmsOrigin = 'https://cms-test.supabase.co';
const lightweightFields = ['id', 'slug', 'title', 'date', 'collection', 'status', 'published_at'];
const ownerEmail = 'journal-ending-owner@example.test';
const ownerPassword = 'fixture-password-not-a-real-credential';
const publishedAt = '2020-01-01T12:00:00Z';
const futurePublication = '2099-12-31T12:00:00Z';
const fixtureId = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
function entry(value: number, date: string, title: string, changes: Partial<Entry> = {}): Entry {
  return {
    id: fixtureId(value), collection: 'journal', title, slug: `ending-fixture-${value}`, date,
    status: 'published', published_at: publishedAt, created_at: publishedAt, updated_at: publishedAt,
    excerpt: 'A local fixture from the notebook, not a live journal entry.',
    content: '## The last light\n\nThe room grew quiet. We watched the rain leave the windows and let the evening take its time.\n\nSome things stay with us without asking. A cup on the table. A song from another room. The long way home.\n\nThis is where the writing rests, with room for one more story.',
    quote: '', game: '', type: '', description: '', video_url: '', duration: '', featured: false,
    media_layout: 'full', cover_image: null, media: [], tags: [], ...changes,
  };
}

type Read = { url: URL; pagePath: string; returned: Record<string, unknown>[]; recommendation: boolean };
type Delay = { sourceId: string; started: boolean; finished: boolean; release: () => void; gate: Promise<void> };
type FixtureState = {
  rows: Entry[]; reads: Read[]; unexpected: string[]; mutations: string[]; pageErrors: string[];
  failRecommendations: boolean; delay?: Delay; ownerToken: string;
};
const states = new WeakMap<Page, FixtureState>();
const compare = (left: unknown, right: unknown) => String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
function applyQuery(rows: Entry[], params: URLSearchParams): Record<string, unknown>[] {
  let found = [...rows];
  for (const [field, filter] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(field)) continue;
    if (!['id', 'slug', 'date', 'collection', 'status', 'published_at'].includes(field)) throw new Error(`Unsupported fixture filter: ${field}`);
    const separator = filter.indexOf('.');
    const operator = filter.slice(0, separator);
    const target = filter.slice(separator + 1);
    if (!['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'is'].includes(operator)) throw new Error(`Unsupported fixture operator: ${operator}`);
    found = found.filter(row => {
      const value = row[field as keyof Entry];
      if (operator === 'is') return target === 'null' && value === null;
      // SQL comparisons with NULL do not pass WHERE, including published_at.
      if (value === null) return false;
      const order = compare(value, target);
      return operator === 'eq' ? order === 0 : operator === 'neq' ? order !== 0
        : operator === 'lt' ? order < 0 : operator === 'lte' ? order <= 0
          : operator === 'gt' ? order > 0 : order >= 0;
    });
  }
  const ordering = (params.get('order') || '').split(',').filter(Boolean).map(part => part.split('.'));
  found.sort((left, right) => {
    for (const [field, direction] of ordering) {
      const order = compare(left[field as keyof Entry], right[field as keyof Entry]);
      if (order) return direction === 'desc' ? -order : order;
    }
    return 0;
  });
  const offset = Number(params.get('offset') || 0);
  const limit = params.has('limit') ? Number(params.get('limit')) : found.length;
  const fields = params.get('select') || '*';
  return found.slice(offset, offset + limit).map(row => fields === '*' ? { ...row }
    : Object.fromEntries(fields.split(',').map(field => [field, row[field as keyof Entry]])));
}
async function mockCms(page: Page, rows: Entry[], owner = false) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const userId = '11111111-1111-4111-8111-111111111111';
  const ownerToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, aud: 'authenticated', role: 'authenticated', aal: 'aal2', exp: now + 3600, iat: now })}.fixture-signature-not-valid-on-any-server`;
  const state: FixtureState = { rows: structuredClone(rows), reads: [], unexpected: [], mutations: [], pageErrors: [], failRecommendations: false, ownerToken };
  states.set(page, state);
  page.on('pageerror', error => state.pageErrors.push(error.message));
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: ownerEmail,
    email_confirmed_at: publishedAt, created_at: publishedAt, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
    factors: [{ id: 'fixture-factor', factor_type: 'totp', status: 'verified', friendly_name: 'Fixture authenticator', created_at: publishedAt, updated_at: publishedAt }] };
  // Match CMS paths as well as the test host: an accidentally changed CMS URL
  // is blocked rather than falling through to a real Supabase deployment.
  await page.route(url => url.origin === cmsOrigin || /\.supabase\.(?:co|in)$/.test(url.hostname)
    || /^\/(?:rest|auth|storage)\/v1\//.test(url.pathname), async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
    const respond = (json: unknown, status = 200) => route.fulfill({ status, headers, json });
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (url.origin !== cmsOrigin) {
      state.unexpected.push(`Blocked non-fixture CMS origin: ${url.origin}`);
      await respond({ message: 'Only the local CMS fixture is allowed.' }, 403); return;
    }
    if (owner && url.pathname === '/auth/v1/token' && request.method() === 'POST' && url.searchParams.get('grant_type') === 'password') {
      await respond({ access_token: ownerToken, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'fixture-refresh-not-valid-on-any-server', user }); return;
    }
    if (owner && url.pathname === '/auth/v1/user' && request.method() === 'GET') { await respond(user); return; }
    if (owner && ['/rest/v1/rpc/cms_is_owner_account', '/rest/v1/rpc/cms_is_owner'].includes(url.pathname)) { await respond(true); return; }
    if (request.method() !== 'GET') {
      state.mutations.push(`${request.method()} ${url.pathname}`);
      await respond({ message: 'CMS writes are forbidden in journal-ending tests.' }, 403); return;
    }
    if (url.pathname === '/rest/v1/cms_entries') {
      const pagePath = new URL(page.url()).pathname;
      const recommendation = !url.searchParams.has('slug') && /^\/journal\/[^/]+\/?$/.test(pagePath);
      const read: Read = { url, pagePath, returned: [], recommendation };
      state.reads.push(read);
      if (recommendation && state.failRecommendations) { await respond({ message: 'Fixture recommendation unavailable.' }, 400); return; }
      try { read.returned = applyQuery(state.rows, url.searchParams); }
      catch (error) {
        state.unexpected.push(String(error));
        await respond({ message: String(error) }, 400); return;
      }
      const delay = state.delay;
      if (recommendation && delay && !delay.started && url.searchParams.getAll('id').includes(`neq.${delay.sourceId}`)) {
        delay.started = true;
        await delay.gate;
        // A correct component may abort this request after navigation. The
        // delayed response is still released, without treating abort as a leak.
        try { await respond(read.returned); } finally { delay.finished = true; }
        return;
      }
      const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
      await respond(single ? read.returned[0] ?? null : read.returned); return;
    }
    if (url.pathname === '/rest/v1/cms_traces') { await respond([]); return; }
    state.unexpected.push(`${request.method()} ${url.pathname}`);
    await respond({ message: 'Unexpected CMS endpoint blocked locally.' }, 501);
  });
  return state;
}
function holdRecommendation(state: FixtureState, sourceId: string) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  state.delay = { sourceId, started: false, finished: false, gate, release };
  return state.delay;
}
const recommendationReads = (state: FixtureState) => state.reads.filter(read => read.recommendation);
function expectBoundedPublicQueries(state: FixtureState) {
  for (const read of recommendationReads(state)) {
    const params = read.url.searchParams;
    expect(params.get('select')?.split(',').sort()).toEqual([...lightweightFields].sort());
    expect(params.get('collection')).toBe('eq.journal');
    expect(params.get('status')).toBe('eq.published');
    expect(params.get('limit')).toBe('1');
    const sourceSlug = read.pagePath.split('/')[2];
    const source = state.rows.find(row => row.slug === sourceSlug);
    expect(source, 'Every recommendation must correspond to the current public entry').toBeTruthy();
    expect(params.getAll('id')).toContain(`neq.${source!.id}`);
    expect(params.get('published_at')).toMatch(/^lte\.\d{4}-\d{2}-\d{2}T/);
    expect(Date.parse(params.get('published_at')!.slice(4))).toBeLessThanOrEqual(Date.now());
    expect(params.has('or'), 'Use typed predicates, not interpolated raw OR syntax').toBe(false);
    expect(read.returned.length).toBeLessThanOrEqual(1);
    for (const result of read.returned) expect(Object.keys(result).sort()).toEqual([...lightweightFields].sort());
  }
}
test.afterEach(async ({ page }) => {
  const state = states.get(page);
  state?.delay?.release();
  expect(state?.unexpected ?? [], 'No CMS request may fall through to a live endpoint').toEqual([]);
  expect(state?.mutations ?? [], 'Journal-ending QA must never write to the CMS').toEqual([]);
  expect(state?.pageErrors ?? []).toEqual([]);
  if (state) expectBoundedPublicQueries(state);
});

async function openEntry(page: Page, item: Entry) {
  await page.goto(`/${item.collection}/${item.slug}/`);
  await expect(page.locator('.newspaper-reading-entry > header h1')).toHaveText(item.title);
}
async function expectEnding(page: Page, next?: Entry) {
  const ending = page.locator('.journal-ending');
  await expect(ending).toBeVisible();
  await expect(ending.getByRole('link', { name: 'Back to the journal', exact: true })).toHaveAttribute('href', '/journal/');
  await expect(ending.locator('[aria-hidden="true"] .brand-moon image')).toHaveAttribute('href', '/demicorpse-logo.png');
  await expect(ending.getByRole('img', { name: 'DemiCorpse moon', exact: true })).toHaveCount(0);
  if (next) {
    await expect(ending.locator('.journal-read-next')).toHaveAttribute('href', `/journal/${next.slug}/`);
    await expect(ending.locator('.journal-read-next')).toContainText('Read next');
    await expect(ending.getByRole('heading', { name: next.title, level: 2, exact: true })).toBeVisible();
  } else await expect(ending.locator('.journal-read-next')).toHaveCount(0);
  return ending;
}
async function expectNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: 'Journal ending must fit the viewport without horizontal scrolling' }).toBe(true);
  await expect.poll(() => page.locator('.journal-ending').evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth;
  })).toBe(true);
}
async function captureEnding(page: Page, testInfo: TestInfo) {
  await page.evaluate(async () => { await document.fonts.ready; if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.mouse.move(0, 0);
  await page.locator('.journal-ending').scrollIntoViewIfNeeded();
  await expectNoOverflow(page);
  const path = testInfo.outputPath(`journal-ending-mock-content-${testInfo.project.name}.png`);
  await page.locator('.journal-ending').screenshot({ path, animations: 'disabled' });
  await testInfo.attach(`Actual journal ending, ${testInfo.project.name} (mock content, not live CMS)`, { path, contentType: 'image/png' });
}

// Every case runs in both the existing desktop and mobile Playwright projects.
test('empty and one-entry journals never invent a recommendation or a self-link', async ({ page }) => {
  const state = await mockCms(page, []);
  await page.goto('/journal/');
  await expect(page.locator('.journal-ending')).toHaveCount(0);
  await page.goto('/journal/ending-fixture-missing/');
  await expect(page.getByRole('heading', { name: 'Nothing here.', exact: true })).toBeVisible();
  await expect(page.locator('.journal-ending')).toHaveCount(0);
  expect(recommendationReads(state)).toHaveLength(0);
  const only = entry(100, '2024-01-01', 'The only page in the notebook');
  state.rows = [only];
  await openEntry(page, only);
  await expect.poll(() => recommendationReads(state).length).toBe(3);
  await expectEnding(page);
  await page.getByRole('link', { name: 'Back to the journal', exact: true }).click();
  await expect(page).toHaveURL(/\/journal\/$/);
  await expect(page.locator('.journal-ending')).toHaveCount(0);
});

test('read next follows newer chronology, stable same-day ties and newest-entry fallback', async ({ page }) => {
  const older = entry(1, '2024-02-01', 'Before the rain');
  const first = entry(101, '2024-02-02', 'The first page that day');
  const second = entry(102, '2024-02-02', 'The second page that day');
  const third = entry(103, '2024-02-02', 'The third page that day');
  const nearFirst = entry(201, '2024-02-03', 'A nearer dawn');
  const nearLast = entry(202, '2024-02-03', 'The last page of a nearer dawn');
  const newest = entry(301, '2024-02-04', 'The newest page');
  const newestOther = entry(302, '2024-02-04', 'Another page from the newest day');
  const state = await mockCms(page, [third, older, newestOther, nearFirst, second, nearLast, newest, first]);
  for (const [source, expected] of [[third, second], [first, nearLast], [newest, newestOther]]) {
    const before = recommendationReads(state).length;
    await openEntry(page, source);
    await expectEnding(page, expected);
    expect(recommendationReads(state).length - before).toBeLessThanOrEqual(3);
    expect(expected.id).not.toBe(source.id);
  }
  const seeks = recommendationReads(state).map(read => read.url.searchParams);
  expect(seeks.some(params => params.get('date') === 'eq.2024-02-02' && params.get('order') === 'id.desc')).toBe(true);
  expect(seeks.some(params => params.get('date') === 'gt.2024-02-02' && params.get('order') === 'date.asc,id.desc')).toBe(true);
  expect(seeks.some(params => !params.has('date') && params.get('order') === 'date.desc,id.asc')).toBe(true);
});

test('only published journals are eligible, and editorial dates are not publication gates', async ({ page }) => {
  const current = entry(100, '2024-01-01', 'The page we are reading');
  const draft = entry(10, '2024-01-02', 'A private draft must stay private', { status: 'draft' });
  const scheduled = entry(20, '2024-01-02', 'A future publication must stay private', { published_at: futurePublication });
  const undated = entry(30, '2024-01-02', 'Missing publication is not public', { published_at: null });
  const fragment = entry(40, '2024-01-02', 'A fragment is not a journal recommendation', { collection: 'fragments' });
  const futureEditorial = entry(200, '2099-01-01', 'A future-dated story already published');
  const old = entry(300, '2023-01-01', 'An older public page');
  await mockCms(page, [draft, scheduled, undated, fragment, old, futureEditorial, current]);
  await openEntry(page, current);
  const ending = await expectEnding(page, futureEditorial);
  for (const excluded of [current, draft, scheduled, undated, fragment, old]) await expect(ending).not.toContainText(excluded.title);
});

test('recommendation failure stays quiet and leaves the article and return link usable', async ({ page }) => {
  const current = entry(100, '2024-01-01', 'An evening without a recommendation');
  const state = await mockCms(page, [current, entry(200, '2024-01-02', 'Another evening')]);
  state.failRecommendations = true;
  await openEntry(page, current);
  await expect.poll(() => recommendationReads(state).length).toBe(1);
  await expectEnding(page);
  await expect(page.locator('.cms-prose')).toContainText('This is where the writing rests');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Fixture recommendation unavailable.');
  await page.getByRole('link', { name: 'Back to the journal', exact: true }).click();
  await expect(page).toHaveURL(/\/journal\/$/);
  await expect(page.getByRole('button', { name: 'CHRONOLOGICAL', exact: true })).toBeVisible();
});

test('late responses cannot replace another ending through direct, back and forward navigation', async ({ page }) => {
  test.setTimeout(60_000);
  const oldest = entry(300, '2024-02-02', 'The third page');
  const middle = entry(200, '2024-02-02', 'The second page');
  const newest = entry(100, '2024-02-02', 'The first page');
  const state = await mockCms(page, [oldest, newest, middle]);
  const delayed = holdRecommendation(state, oldest.id);
  await openEntry(page, oldest);
  await expect.poll(() => delayed.started).toBe(true);
  await expectEnding(page);
  await page.getByRole('link', { name: 'Back to the journal', exact: true }).click();
  await page.getByRole('button', { name: 'CHRONOLOGICAL', exact: true }).click();
  await page.locator('.dc-timeline').getByRole('link', { name: new RegExp(middle.title) }).click();
  await expectEnding(page, newest);
  delayed.release();
  await expect.poll(() => delayed.finished).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expectEnding(page, newest);
  await expect(page.locator('.journal-read-next')).not.toContainText(middle.title);
  await page.goBack();
  await expect(page).toHaveURL(/\/journal\/$/);
  await page.goBack();
  await expectEnding(page, middle);
  await page.goForward();
  await expect(page).toHaveURL(/\/journal\/$/);
  await page.goForward();
  await expectEnding(page, newest);
  for (let repeat = 0; repeat < 2; repeat++) {
    await openEntry(page, oldest);
    await expectEnding(page, middle);
    await page.locator('.journal-read-next').click();
    await expectEnding(page, newest);
    await page.goBack();
    await expectEnding(page, middle);
    await page.goForward();
    await expectEnding(page, newest);
  }
});

test('ending has decorative original moon, keyboard links, readable mobile layout and actual screenshots', async ({ page }, testInfo) => {
  const current = entry(100, '2024-03-01', 'A window after rain');
  const next = entry(200, '2024-03-02', 'The long way home');
  const state = await mockCms(page, [next, current]);
  await openEntry(page, current);
  const ending = await expectEnding(page, next);
  const recommendation = ending.locator('.journal-read-next');
  const back = ending.getByRole('link', { name: 'Back to the journal', exact: true });
  await recommendation.focus();
  await expect(recommendation).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(back).toBeFocused();
  await expect.poll(() => back.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Shift+Tab');
  await expect(recommendation).toBeFocused();
  for (const link of [recommendation, back]) {
    const bounds = await link.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  await captureEnding(page, testInfo);
  await recommendation.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/journal/${next.slug}/$`));
  await expectEnding(page, current);
  await page.getByRole('link', { name: 'Back to the journal', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/journal\/$/);
  // Deliberately difficult but legitimate CMS text, without inserting CSS or
  // replacing the ending with a mock UI, must not widen the reading surface.
  state.rows.find(row => row.id === next.id)!.title = `A very long title ${'unbroken'.repeat(24)}`;
  await openEntry(page, current);
  await expectEnding(page, state.rows.find(row => row.id === next.id)!);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
  }
});

test('fragments, indexes and authenticated admin previews never gain a journal ending', async ({ page }) => {
  const journal = entry(100, '2024-03-01', 'A journal for private preview');
  const fragment = entry(200, '2024-03-02', 'A small observation', { collection: 'fragments' });
  const state = await mockCms(page, [journal, fragment], true);
  await openEntry(page, fragment);
  await expect(page.locator('.journal-ending')).toHaveCount(0);
  await page.goto('/fragments/');
  await expect(page.locator('.fragment-view-switch')).toBeVisible();
  await expect(page.locator('.journal-ending')).toHaveCount(0);
  await page.goto('/journal/');
  await expect(page.getByRole('button', { name: 'CHRONOLOGICAL', exact: true })).toBeVisible();
  await expect(page.locator('.journal-ending')).toHaveCount(0);
  await page.goto('/admin');
  await page.getByLabel('Email', { exact: true }).fill(ownerEmail);
  await page.getByLabel('Password', { exact: true }).fill(ownerPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Collections', exact: true })).toBeVisible();
  await page.locator('.cms-list-item').filter({ hasText: journal.title }).click();
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('.cms-preview-label')).toHaveText('PRIVATE PREVIEW · includes unsaved changes');
    await expect(page.locator('.newspaper-reading-entry > header h1')).toHaveText(journal.title);
    await expect(page.locator('.journal-ending')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to writing', exact: true }).click();
  }
  expect(recommendationReads(state)).toHaveLength(0);
});
