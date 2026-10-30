import { expect, test, type Page } from '@playwright/test';

async function stubHero(page: Page) {
  await page.route(url => url.hostname === 'images.unsplash.com', route => route.fulfill({
    status: 200, contentType: 'image/png', path: 'public/hero-still.png',
    headers: { 'access-control-allow-origin': '*' },
  }));
}

test('novella landing retains the original logo and indexes the six manuscript titles', async ({ page }) => {
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await expect(page.getByRole('link', { name: 'Return to DemiCorpse' }).locator('img')).toHaveAttribute('src', '/demicorpse-logo.png');
  await expect(page.locator('.unmaking-header')).toHaveCount(1);
  await expect(page.locator('.unmaking-header')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('button', { name: 'Scroll to reveal The Unmaking' })).toBeVisible();
  await expect(page.locator('.unmaking-scroll-cue')).toHaveCSS('opacity', '1');
  await expect(page.locator('.global-header')).toHaveCount(0);
  await expect(page.locator('.unmaking-ink-hero')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'THE UNMAKING' })).toBeVisible();
  await expect(page.locator('.unmaking-hero-eyebrow')).toHaveCount(0);
  await expect(page.locator('.unmaking-hero-byline')).toHaveText('a novella by DemiCorpse');
  await expect(page.locator('.unmaking-hero-actions')).toContainText('Begin Reading');
  await expect(page.locator('.unmaking-hero-actions')).toContainText('Chapter Index');
  await expect(page.locator('.unmaking-index-art img')).toHaveAttribute('src', '/the-unmaking-cover.svg');
  await expect(page.locator('.unmaking-chapters li')).toHaveCount(6);
  await expect(page.locator('.unmaking-chapters')).toContainText('A Place at the Table');
  await expect(page.locator('.unmaking-chapters')).toContainText('For Two');
  await page.getByRole('link', { name: 'Preview A Place at the Table' }).click();
  await expect(page).toHaveURL(/\/the-unmaking\/chapter-01$/);
  await expect(page.getByRole('heading', { name: 'A Place at the Table' })).toBeVisible();
  await expect(page.getByText('The manuscript is still being revised.')).toBeVisible();
  await expect(page.locator('.unmaking-reader-manuscript')).not.toContainText('Anna set two cups');
  await page.getByRole('link', { name: /NEXT/ }).click();
  await expect(page.getByRole('heading', { name: 'The Arrangement of Things' })).toBeVisible();
});

test('reduced motion shows a complete static introduction', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await expect(page.locator('.unmaking-ink-hero')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('.unmaking-scroll-cue')).toHaveCount(0);
  await expect(page.locator('.unmaking-header')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByRole('link', { name: /Begin Reading/ })).toBeVisible();
  await expect(page.locator('.unmaking-ink-hero')).toHaveCSS('height', /px/);
  await context.close();
});

test('mobile edition contains its layout and keeps chapter navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 750 });
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await expect(page.getByRole('link', { name: 'Return to DemiCorpse' })).toBeVisible();
  await expect(page.locator('.unmaking-chapters li')).toHaveCount(6);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Preview For Two' }).click();
  await expect(page.getByRole('heading', { name: 'For Two' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('main site navigation promotes the novella and moves LIKAS into the More menu', async ({ page }) => {
  await stubHero(page);
  await page.goto('/journal/');
  await expect(page.locator('.primary-nav').getByRole('button', { name: 'THE UNMAKING' })).toBeVisible();
  await expect(page.locator('.primary-nav').getByRole('button', { name: 'LIKAS' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('.more-dropdown').getByRole('link', { name: /LIKAS/ })).toHaveAttribute('href', '/likas/');
  await expect(page.locator('.more-dropdown').getByRole('link', { name: /THE UNMAKING/ })).toHaveCount(0);
  await page.locator('.primary-nav').getByRole('button', { name: 'THE UNMAKING' }).click();
  await expect(page).toHaveURL(/\/the-unmaking\/$/);
  await expect(page.locator('.unmaking-header')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('button', { name: 'Scroll to reveal The Unmaking' })).toBeVisible();
});

test('scroll cue advances to the fully revealed branded edition', async ({ page }) => {
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await page.getByRole('button', { name: 'Scroll to reveal The Unmaking' }).click();
  await expect.poll(async () => page.locator('.unmaking-header').getAttribute('aria-hidden'), { timeout: 15000 }).toBe('false');
  await expect(page.getByRole('link', { name: 'Return to DemiCorpse' })).toBeVisible();
  await expect(page.locator('.unmaking-scroll-cue')).toBeHidden();
  await expect(page.getByRole('link', { name: /Begin Reading/ })).toBeVisible();
  await page.getByRole('link', { name: /Begin Reading/ }).click();
  await expect(page).toHaveURL(/\/the-unmaking\/chapter-01$/);
});
