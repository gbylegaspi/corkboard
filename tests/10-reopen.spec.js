// 10. Reopening: close and reopen the app; the last board reopens with no prompts and everything is identical.
const { test } = require('@playwright/test');
const h = require('./helpers'),
  fx = require('./fixtures');

test('close and reopen: same board, no prompts, nothing changed', async () => {
  const ctx = h.newBoard();
  let page = await h.launch(ctx);
  try {
    // build a varied board through the UI
    await h.addPhotos(page, [fx.photoSmall(0), fx.photoSmall(1)], 'original', 'Golden');
    await h.addOne(page, 'Sticky note');
    await page.keyboard.type('see you soon');
    await page.mouse.click(20, 700);
    await h.addOne(page, 'To-do list');
    await page.keyboard.type('pack');
    await page.mouse.click(20, 700);
    await h.addOne(page, 'Calendar');
    await page.keyboard.press('Escape');
    await h.addOne(page, 'Label');
    await page.keyboard.type('trip');
    await page.keyboard.press('Enter');
    await page.setInputFiles('#stkFile', fx.sticker());
    await page.waitForSelector('#layer .card.sticker');
    await page.setInputFiles('#file', fx.pdf5());
    await page.waitForSelector('#layer .card.doc');
    // a second section, a theme, a zoom level and a title
    await h.newSection(page);
    await page.locator('#tplG .tplt', { hasText: 'Birthday' }).click();
    await page.click('#tplOk');
    await page.waitForTimeout(800);
    await h.goSection(page, 'Our memories');
    await page.waitForTimeout(500);
    await page.click('#gear');
    await page.click('#tb-theme');
    await page.locator('#thmList .thm', { hasText: 'Midnight' }).click();
    await page.click('#setX');
    await page.click('#zmOut');
    await page.click('#title');
    await page.keyboard.press('Meta+A');
    await page.keyboard.type('Our trip');
    await page.mouse.click(20, 700);
    const before = await h.saved(
      ctx,
      d => d.sections[0].name === 'Our trip' && d.zoom === 0.85 && d.theme === 'midnight'
    );
    await page.waitForTimeout(1500);
    // measure with nothing hovered or focused (a hovered card straightens and grows a little)
    await page.mouse.move(640, 5);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(600);
    const domBefore = await h.cards(page);
    const photosBefore = h.list(ctx, 'photos'),
      thumbsBefore = h.list(ctx, 'thumbs');
    await h.close(ctx);

    // reopen
    page = await h.launch(ctx);
    h.expect(await ctx.app.evaluate(() => global.__dlgCalls)).toBe(0); // no folder prompt
    h.expect(await page.locator('#start').count()).toBe(0);
    await page.waitForTimeout(1500);
    h.expect(await page.textContent('#title')).toBe('Our trip');
    h.expect(await h.curSection(page)).toBe('Our trip'); // v2.0: typing in the title renamed the section
    h.expect(await h.zoomText(page)).toBe('85%');
    h.expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('midnight');
    await page.mouse.move(640, 5);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(600);
    const domAfter = await h.cards(page);
    h.expect(domAfter.map(c => c.id).sort()).toEqual(domBefore.map(c => c.id).sort());
    for (const a of domAfter) {
      const b = domBefore.find(c => c.id === a.id);
      h.expect(Math.abs(a.x - b.x)).toBeLessThan(2);
      h.expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    }
    await page.waitForTimeout(800);
    h.expect(h.readBoard(ctx)).toEqual(before); // opening didn't change board.json
    h.expect(h.list(ctx, 'photos')).toEqual(photosBefore);
    h.expect(h.list(ctx, 'thumbs')).toEqual(thumbsBefore); // display copies were reused, not made again
    h.expect(await ctx.app.evaluate(() => global.__boxes.length)).toBe(0);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});
