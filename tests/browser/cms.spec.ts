import { test, expect, type Page } from '@playwright/test';

const ownerId = '11111111-1111-4111-8111-111111111111';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

async function mockService(page: Page, owner = true) {
  const records: Record<string, any>[] = [];
  const files = new Set<string>();
  const user = { id: ownerId, aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: ownerId, exp: Math.floor(Date.now()/1000)+3600, role: 'authenticated' })).toString('base64url'), 'test'].join('.');
  await page.route('https://cms-test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.includes('/auth/v1/token')) return reply({ access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user });
    if (url.pathname.endsWith('/auth/v1/user')) return reply(user);
    if (url.pathname.endsWith('/auth/v1/logout')) return reply({});
    if (url.pathname.endsWith('/rpc/cms_is_owner')) return reply(owner);
    if (url.pathname.endsWith('/cms_entries')) {
      const matches = (row: any) => [...url.searchParams.entries()].every(([key, value]) => !value.startsWith('eq.') || row[key] === value.slice(3));
      if (method === 'POST') {
        const entry = { ...request.postDataJSON(), published_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        records.push(entry); return reply(entry, 201);
      }
      if (method === 'PATCH') { const entry = records.find(matches); if (!entry) return reply({code:'PGRST116'},406); Object.assign(entry, request.postDataJSON(), { updated_at: new Date().toISOString() }); return reply(entry); }
      if (method === 'DELETE') { const index = records.findIndex(matches); const [entry] = records.splice(index,1); return reply(entry); }
      const filtered = records.filter(matches);
      return reply(request.headers().accept?.includes('vnd.pgrst.object') ? filtered[0] || null : filtered);
    }
    if (url.pathname.includes('/storage/v1/object/list/')) return reply([...files].map(name => ({ name: name.split('/').pop() })));
    if (url.pathname.includes('/storage/v1/object/')) {
      if (method === 'POST') { files.add(url.pathname.split('/cms-media/')[1]); return reply({Key:url.pathname}); }
      if (method === 'DELETE') { for(const path of request.postDataJSON().prefixes) files.delete(path); return reply([]); }
      return route.fulfill({contentType:'image/png',body:png});
    }
    return reply({message:'Unexpected test request'}, 500);
  });
  return { records, files };
}
async function login(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email', {exact:true}).fill('owner@example.com');
  await page.getByLabel('Password', {exact:true}).fill('test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
}

test('entrance, empty collections, direct links and persistent cinematic navigation', async ({page}) => {
  await mockService(page);
  await page.goto('/');
  await expect(page.locator('.landing-logo')).toBeVisible();
  await page.goto('/journal/');
  await expect(page.getByText('COMING SOON',{exact:true})).toBeVisible();
  const video = await page.locator('#persistent-video').elementHandle();
  await page.getByRole('button',{name:/MORE/}).click();
  await page.getByRole('link',{name:/FRAGMENTS/}).click();
  await expect(page).toHaveURL(/\/fragments\//);
  await expect(page.locator('.coming-title-mask h1')).toHaveText('FRAGMENTS');
  expect(await video?.evaluate(el => el === document.querySelector('#persistent-video'))).toBe(true);
  await expect(page.locator('.main-logo img')).toHaveAttribute('src','/demicorpse-logo.png');
  await page.goBack();
  await expect(page.locator('.coming-title-mask h1')).toHaveText('JOURNAL');
  await page.goto('/journal/nonexistent');
  await expect(page.getByRole('heading',{name:'Nothing here.'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('authenticated non-owner gets no editor; sign out returns to login', async ({page}) => {
  await mockService(page,false); await login(page);
  await expect(page.getByRole('heading',{name:'This room is private.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'+ New entry'})).toHaveCount(0);
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});

test('owner drafts, safe preview, uploads, publishing, unpublishing and deletion', async ({page}, info) => {
  const {records,files} = await mockService(page); await login(page);
  await page.getByRole('button',{name:'+ New entry',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('Somewhere to keep a memory');
  await page.getByRole('button',{name:'Use title for address'}).click();
  await page.getByLabel('Writing / Markdown').fill('A quiet **beginning**.\n\n<script>alert("unsafe")</script>\n\n[bad](javascript:alert(1))');
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await expect(page.locator('.cms-entry strong')).toHaveText('beginning');
  await expect(page.locator('.cms-entry script')).toHaveCount(0);
  await expect(page.locator('.cms-entry a[href^="javascript"]')).toHaveCount(0);
  await page.getByRole('button',{name:'Back to writing'}).click();
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(page.locator('.cms-message[role=status]')).toHaveText('Draft saved. Only you can see it.');
  expect(records[0].status).toBe('draft');
  await page.getByLabel('Upload media').setInputFiles({name:'memory.png',mimeType:'image/png',buffer:png});
  await expect(page.locator('.cms-message[role=status]')).toHaveText('Media uploaded and saved.');
  expect(files.size).toBe(1);
  await page.getByRole('button',{name:'Use as cover',exact:true}).click();
  await page.getByRole('button',{name:'Publish',exact:true}).click();
  await expect(page.locator('.cms-message[role=status]')).toHaveText('Published. Your entry is live.');
  expect(records[0].status).toBe('published');
  expect(records[0].cover_image).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('admin.png'),fullPage:true});
  await page.getByRole('link',{name:'View public entry →'}).click();
  await expect(page.getByRole('heading',{name:'Somewhere to keep a memory'})).toBeVisible();
  await expect(page.locator('.cms-media')).toBeVisible();
  await page.screenshot({path:info.outputPath('journal.png'),fullPage:true});
  await page.goto('/admin');
  await page.locator('.cms-list-item').click();
  page.once('dialog',dialog => dialog.accept());
  await page.getByRole('button',{name:'Unpublish',exact:true}).click();
  await expect(page.locator('.cms-message[role=status]')).toHaveText('Draft saved. Only you can see it.');
  expect(records[0].status).toBe('draft');
  page.once('dialog',dialog => dialog.accept());
  await page.getByRole('button',{name:'Delete entry',exact:true}).click();
  await expect(page.locator('.cms-message[role=status]')).toHaveText('Entry deleted.');
  expect(records).toHaveLength(0); expect(files.size).toBe(0);
});

test('Fragments, Play and Archive use their own fields and can save drafts',async ({page}) => {
  const {records} = await mockService(page); await login(page);
  for (const collection of ['fragments','play','archive']) {
    await page.getByRole('navigation',{name:'Collections'}).getByRole('button',{name:collection,exact:true}).click();
    await page.getByRole('button',{name:collection === 'fragments' ? '+ New fragment' : '+ New entry',exact:true}).click();
    if(collection !== 'fragments') await page.getByLabel('Title',{exact:true}).fill('A memory');
    if(collection === 'play') await page.getByLabel('Game',{exact:true}).fill('A game');
    if(collection === 'archive') await page.getByLabel('Type of memory').fill('Photograph');
    await page.getByLabel(collection === 'fragments' ? 'Fragment' : 'Writing / Markdown',{exact:true}).fill('Something worth keeping.');
    await page.getByRole('button',{name:'Save draft',exact:true}).click();
    await expect(page.locator('.cms-message[role=status]')).toHaveText('Draft saved. Only you can see it.');
    expect(records.at(-1)?.collection).toBe(collection);
  }
});
