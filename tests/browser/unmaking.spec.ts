import { expect, test, type Page } from '@playwright/test';

async function stubHero(page: Page) {
  await page.route(url => url.hostname === 'images.unsplash.com', route => route.fulfill({
    status: 200, contentType: 'image/png', path: 'public/hero-still.png',
    headers: { 'access-control-allow-origin': '*' },
  }));
}

test('novella starts with the ink reveal, then offers Chapter I and five Coming Soon chapters', async ({ page }) => {
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await expect(page.locator('.unmaking-header')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByRole('button', { name: 'Scroll to reveal The Unmaking' })).toBeVisible();
  await expect(page.locator('.unmaking-scroll-cue')).toHaveCSS('opacity', '1');
  await expect(page.locator('.global-header')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'THE UNMAKING' })).toBeVisible();
  await expect(page.locator('.unmaking-hero-byline')).toHaveText('a novella by DemiCorpse');
  await expect(page.locator('.unmaking-hero-actions')).toContainText('Begin Reading');
  await expect(page.locator('.unmaking-hero-actions')).toContainText('Chapter Index');
  await expect(page.locator('.unmaking-index-art img')).toHaveAttribute('src', '/the-unmaking-cover.svg');
  await expect(page.locator('.unmaking-chapters li')).toHaveCount(6);
  await expect(page.locator('.unmaking-chapters li').first().getByRole('link', { name: /Read A Place at the Table/ })).toBeVisible();
  await expect(page.locator('.unmaking-unavailable-chapter')).toHaveCount(5);
  await expect(page.locator('.unmaking-unavailable-chapter').first()).toContainText('Coming Soon');
  await expect(page.locator('.unmaking-chapters')).toContainText('For Two');

  await page.getByRole('link', { name: 'Read A Place at the Table' }).click();
  await expect(page).toHaveURL(/\/the-unmaking\/chapter-01$/);
  await expect(page.getByRole('heading', { name: 'A Place at the Table' })).toBeVisible();
  const story = page.locator('.unmaking-reader-manuscript');
  await expect(story).toContainText('Anna set two cups on the dining-room table.');
  await expect(story).toContainText('Evelyn had been dead for twenty-three days.');
  await expect(story).toContainText('You could say congratulations.');
  await expect(story).toContainText('Tell him only the green bits are poisonous');
  await expect(story).toContainText('4.10. Settled. Leave light.');
  await expect(story.locator('hr')).toHaveCount(2);
  await expect(page.getByText('The manuscript is still being revised.')).toHaveCount(0);
  await expect(page.locator('.unmaking-reader-future')).toContainText('Coming Soon');
});

test('returning from Chapter I goes straight to the revealed table of contents without a replay', async ({ page }) => {
  await stubHero(page);
  await page.goto('/the-unmaking/chapter-01');
  await expect(page.getByRole('heading', { name: 'A Place at the Table' })).toBeVisible();
  await page.getByRole('link', { name: /Table of contents/ }).first().click();
  await expect(page).toHaveURL(/\/the-unmaking\/\?contents=1$/);
  await expect(page.locator('.unmaking-header')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.unmaking-ink-hero')).toHaveAttribute('data-skip-reveal', 'true');
  await expect(page.locator('.unmaking-scroll-cue')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Return to DemiCorpse' })).toBeVisible();
  await expect.poll(() => page.locator('#unmaking-contents').evaluate(el =>
    Math.abs(el.getBoundingClientRect().top - 72)), { timeout: 8000 }).toBeLessThan(15);
  await expect(page.locator('.unmaking-chapters li')).toHaveCount(6);
  // The chapter page remains readable on history navigation.
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'A Place at the Table' })).toBeVisible();
  await page.getByRole('link', { name: /Table of contents/ }).first().click();
  await expect(page.locator('.unmaking-ink-hero')).toHaveAttribute('data-skip-reveal', 'true');
});

test('browser Back also returns to a fully revealed landing page', async ({ page }) => {
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await page.getByRole('link', { name: 'Read A Place at the Table' }).click();
  await expect(page).toHaveURL(/\/the-unmaking\/chapter-01$/);
  await page.goBack();
  await expect(page.locator('.unmaking-ink-hero')).toHaveAttribute('data-skip-reveal', 'true');
  await expect(page.locator('.unmaking-header')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.unmaking-scroll-cue')).toHaveCount(0);
});

test('other chapter routes clearly display Coming Soon and never expose draft manuscript', async ({ page }) => {
  await stubHero(page);
  for (const chapter of ['02', '03', '04', '05', '06']) {
    await page.goto('/the-unmaking/chapter-' + chapter);
    await expect(page.getByText('COMING SOON', { exact: true })).toBeVisible();
    await expect(page.locator('.unmaking-reader-manuscript')).not.toContainText('Anna set two cups on the dining-room table.');
    await expect(page.getByRole('link', { name: /Return to the table of contents/ })).toHaveAttribute('href', '/the-unmaking/?contents=1');
  }
});

test('reduced motion shows a complete, readable introduction', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await expect(page.locator('.unmaking-ink-hero')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('.unmaking-scroll-cue')).toHaveCount(0);
  await expect(page.locator('.unmaking-header')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.getByRole('link', { name: /Begin Reading/ })).toBeVisible();
  await context.close();
});

test('mobile reader and contents contain the layout without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 750 });
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await expect(page.locator('.unmaking-chapters li')).toHaveCount(6);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Read A Place at the Table' }).click();
  await expect(page.getByRole('heading', { name: 'A Place at the Table' })).toBeVisible();
  await expect(page.locator('.unmaking-reader-manuscript')).toContainText('The catalogue.');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('link', { name: /Table of contents/ }).first().click();
  await expect(page.locator('.unmaking-ink-hero')).toHaveAttribute('data-skip-reveal', 'true');
});

test('main navigation promotes The Unmaking and preserves LIKAS in More', async ({ page }) => {
  await stubHero(page);
  await page.goto('/journal/');
  const header = page.locator('.global-header');
  const novellaLink = header.getByRole('button', { name: 'THE UNMAKING' });
  await expect(novellaLink).toBeVisible();
  await expect(header.getByRole('button', { name: 'LIKAS' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('.more-dropdown').getByRole('link', { name: /LIKAS/ })).toHaveAttribute('href', '/likas/');
  await expect(page.locator('.more-dropdown').getByRole('link', { name: /THE UNMAKING/ })).toHaveCount(0);
  await novellaLink.click();
  await expect(page.locator('.unmaking-header')).toHaveAttribute('aria-hidden', 'true');
});

test('scroll cue still develops the scene for first-time visitors', async ({ page }) => {
  await stubHero(page);
  await page.goto('/the-unmaking/');
  await page.getByRole('button', { name: 'Scroll to reveal The Unmaking' }).click();
  await expect.poll(async () => page.locator('.unmaking-header').getAttribute('aria-hidden'), { timeout: 15000 }).toBe('false');
  await expect(page.locator('.unmaking-scroll-cue')).toBeHidden();
  await page.getByRole('link', { name: /Begin Reading/ }).click();
  await expect(page).toHaveURL(/\/the-unmaking\/chapter-01$/);
});
