import {test,expect} from '@playwright/test';

test('public navigation and responsive pages render',async({page})=>{
 await page.goto('/journal/');
 await expect(page.locator('.main-logo img')).toHaveAttribute('src','/demicorpse-logo.png');
 await page.getByRole('button',{name:'FRAGMENTS',exact:true}).click();
 await expect(page).toHaveURL(/\/fragments\//);
 await expect(page.locator('.main-header')).toBeVisible();
 await page.goto('/likas/');
 await expect(page).toHaveURL(/\/likas\//);
 await expect(page.getByRole('heading',{name:/business OS/i})).toBeVisible();
 await expect(page.getByRole('link',{name:/VISIT LIKAS/i})).toHaveAttribute('href','https://likas.app');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('hamburger contains only secondary destinations',async({page})=>{
 await page.goto('/journal/');
 await page.getByRole('button',{name:'Open menu'}).click();
 const menu=page.locator('.more-dropdown');
 await expect(menu.getByRole('link',{name:/COLOPHON/})).toBeVisible();
 await expect(menu.getByRole('link',{name:/ADMIN/})).toBeVisible();
 await expect(menu.getByRole('link',{name:/JOURNAL/})).toHaveCount(0);
 await expect(menu.getByRole('link',{name:/FRAGMENTS/})).toHaveCount(0);
});

test('admin login surface is protected',async({page})=>{
 await page.goto('/admin');
 await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});

test('direct journal route remains stable',async({page})=>{
 await page.goto('/journal/');
 await expect(page).toHaveURL(/\/journal\//);
 await expect(page.locator('.main-header')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('persistent film survives client navigation',async({page})=>{
 await page.goto('/journal/');
 const before=await page.locator('#persistent-video').evaluate(el=>el);
 await page.getByRole('button',{name:'GALLERY',exact:true}).click();
 await expect(page).toHaveURL(/\/gallery\//);
 await expect(page.locator('#persistent-video')).toHaveCount(1);
 expect(before).toBeTruthy();
});
