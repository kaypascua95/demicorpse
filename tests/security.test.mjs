import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('CMS migration: real PostgreSQL grants, RLS, triggers and storage policies', async t => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111';
  const outsider = '22222222-2222-4222-8222-222222222222';
  const draft = '33333333-3333-4333-8333-333333333333';
  const live = '44444444-4444-4444-8444-444444444444';
  const file = `${live}/55555555-5555-4555-8555-555555555555.png`;
  const draftFile = `${draft}/66666666-6666-4666-8666-666666666666.png`;
  // Minimal Supabase platform tables. The migration below is used unchanged;
  // these tests exercise PostgreSQL authorization, not a JS imitation of RLS.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
    grant usage on schema auth, storage, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table storage.buckets(id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    insert into auth.users values ('${owner}'),('${outsider}');
  `);
  for (const file of (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  async function as(role, uid, sql, params = [], aal = 'aal2') {
    return db.transaction(async tx => {
      await tx.exec(`set local role ${role};`);
      await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`, [uid || '']);
      await tx.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ aal })]);
      return tx.query(sql, params);
    });
  }
  const own = (sql, params) => as('authenticated', owner, sql, params);
  const other = (sql, params) => as('authenticated', outsider, sql, params);
  const anon = (sql, params) => as('anon', null, sql, params);
  try {
    await t.test('unconfigured project denies every writer', async () => {
      assert.equal((await own('select public.cms_is_owner() as allowed')).rows[0].allowed, false);
      await assert.rejects(own("insert into cms_entries(collection,title,slug) values ('journal','blocked','blocked')"), /row-level security/);
    });
    await db.query('insert into private.cms_owner(user_id) values ($1)', [owner]);
    await t.test('only administrator can assign the single owner', async () => {
      await assert.rejects(other('update private.cms_owner set user_id=$1', [outsider]), /permission denied/);
      await assert.rejects(own('delete from private.cms_owner'), /permission denied/);
      assert.equal((await own('select cms_is_owner() as allowed')).rows[0].allowed, true);
      assert.equal((await other('select cms_is_owner() as allowed')).rows[0].allowed, false);
      await assert.rejects(anon('select cms_is_owner()'), /permission denied/);
    });
    await t.test('owner creates drafts and publishes in every collection', async () => {
      for (const collection of ['journal', 'fragments', 'play', 'archive']) {
        const { rows } = await own("insert into cms_entries(collection,title,slug,content) values ($1,'Test','test','A memory') returning *", [collection]);
        assert.equal(rows[0].status, 'draft');
        assert.equal(rows[0].published_at, null);
        const published = await own("update cms_entries set status='published' where id=$1 returning *", [rows[0].id]);
        assert.ok(published.rows[0].published_at);
        await own('delete from cms_entries where id=$1', [rows[0].id]);
      }
      await own("insert into cms_entries(id,collection,title,slug,content) values ($1,'journal','Secret','secret','Private prose')", [draft]);
      await own("insert into cms_entries(id,collection,title,slug,status) values ($1,'journal','Public','public','published')", [live]);
    });
    await t.test('anonymous and non-owner reads exclude drafts even by known ID', async () => {
      for (const read of [anon, other]) {
        assert.deepEqual((await read('select id from cms_entries')).rows.map(r => r.id), [live]);
        assert.equal((await read('select * from cms_entries where id=$1', [draft])).rows.length, 0);
      }
      assert.equal((await own('select * from cms_entries')).rows.length, 2);
    });
    await t.test('anonymous and other authenticated accounts cannot mutate any content', async () => {
      await assert.rejects(anon("insert into cms_entries(collection,slug) values ('journal','attack')"), /permission denied/);
      await assert.rejects(anon("update cms_entries set title='attack'"), /permission denied/);
      await assert.rejects(anon('delete from cms_entries'), /permission denied/);
      await assert.rejects(other("insert into cms_entries(collection,slug) values ('journal','attack')"), /row-level security/);
      assert.equal((await other("update cms_entries set title='attack' returning id")).rows.length, 0);
      assert.equal((await other('delete from cms_entries returning id')).rows.length, 0);
      assert.equal((await own('select title from cms_entries where id=$1', [live])).rows[0].title, 'Public');
    });
    await t.test('owner upload succeeds; other identities and unknown entry paths are denied', async () => {
      await own("insert into storage.objects(bucket_id,name) values ('cms-media',$1),('cms-media',$2)", [file, draftFile]);
      for (const upload of [anon, other]) await assert.rejects(upload("insert into storage.objects(bucket_id,name) values ('cms-media',$1)", [file]), /row-level security/);
      await assert.rejects(own("insert into storage.objects(bucket_id,name) values ('cms-media','unknown/file.png')"), /row-level security/);
      assert.equal((await own("update storage.objects set name='overwrite' returning id")).rows.length, 0);
    });
    await t.test('unattached and draft media stay private; published attachments can be read', async () => {
      assert.equal((await anon('select * from storage.objects')).rows.length, 0);
      await own('update cms_entries set media=array[$1],cover_image=$1 where id=$2', [file, live]);
      await own('update cms_entries set media=array[$1] where id=$2', [draftFile, draft]);
      for (const read of [anon, other]) assert.deepEqual((await read('select name from storage.objects')).rows.map(r => r.name), [file]);
      assert.equal((await own('select * from storage.objects')).rows.length, 2);
    });
    await t.test('owner password-only or missing assurance cannot read drafts, write, upload or delete', async () => {
      for (const aal of ['aal1', null]) {
        const passwordOnly = (sql, params) => as('authenticated', owner, sql, params, aal);
        assert.equal((await passwordOnly('select cms_is_owner_account() as allowed')).rows[0].allowed, true);
        assert.equal((await passwordOnly('select cms_is_owner() as allowed')).rows[0].allowed, false);
        assert.deepEqual((await passwordOnly('select id from cms_entries')).rows.map(r => r.id), [live]);
        await assert.rejects(passwordOnly("insert into cms_entries(collection,slug) values ('journal','no-mfa')"), /row-level security/);
        assert.equal((await passwordOnly("update cms_entries set title='attack' returning id")).rows.length, 0);
        assert.equal((await passwordOnly('delete from cms_entries returning id')).rows.length, 0);
        assert.deepEqual((await passwordOnly('select name from storage.objects')).rows.map(r => r.name), [file]);
        await assert.rejects(passwordOnly("insert into storage.objects(bucket_id,name) values ('cms-media',$1)", [draftFile]), /row-level security/);
        assert.equal((await passwordOnly('delete from storage.objects returning id')).rows.length, 0);
      }
      assert.equal((await other('select cms_is_owner_account() as allowed')).rows[0].allowed, false);
      await assert.rejects(anon('select cms_is_owner_account()'), /permission denied/);
    });
    await t.test('cross-entry media references and unsafe file types cannot be published', async () => {
      await assert.rejects(own('update cms_entries set media=array[$1] where id=$2', [draftFile, live]), /Media must belong/);
      await assert.rejects(own('update cms_entries set cover_image=$1 where id=$2', [`${live}/bad.svg`, live]), /Media must belong/);
      await assert.rejects(own('update cms_entries set media=array[null] where id=$1', [live]), /Media must belong/);
      const { rows } = await db.query("select * from storage.buckets where id='cms-media'");
      assert.equal(rows[0].public, false);
      assert.equal(Number(rows[0].file_size_limit), 26214400);
      assert.ok(!rows[0].allowed_mime_types.includes('image/svg+xml'));
    });
    await t.test('database validates publication, slugs and immutable identity', async () => {
      await assert.rejects(own("insert into cms_entries(collection,slug,status) values ('journal','empty','published')"), /check constraint/);
      await assert.rejects(own("insert into cms_entries(collection,slug) values ('journal','public')"), /unique constraint/);
      await assert.rejects(own("update cms_entries set slug='../admin' where id=$1", [live]), /check constraint/);
      await assert.rejects(own("update cms_entries set collection='play' where id=$1", [live]), /identity cannot/);
    });
    await t.test('unpublishing revokes both post and media visibility', async () => {
      await own("update cms_entries set status='draft' where id=$1", [live]);
      for (const read of [anon, other]) {
        assert.equal((await read('select * from cms_entries')).rows.length, 0);
        assert.equal((await read('select * from storage.objects')).rows.length, 0);
      }
    });
    await t.test('owner can delete media and content; outsider cannot', async () => {
      assert.equal((await other('delete from storage.objects returning id')).rows.length, 0);
      assert.equal((await anon('delete from storage.objects returning id')).rows.length, 0);
      assert.equal((await own('delete from storage.objects returning id')).rows.length, 2);
      assert.equal((await own('delete from cms_entries returning id')).rows.length, 2);
    });
  } finally { await db.close(); }
});
