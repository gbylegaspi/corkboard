// 13. First launch: no folder to choose. The app makes its own board in its data folder and opens it; if that folder
// is deleted it's made again. A board folder she chose that has gone missing shows the start screen with a message.
const { test } = require('@playwright/test');
const fs = require('fs'),
  path = require('path');
const h = require('./helpers');

test("first launch makes and opens the app's own board; no prompts", async () => {
  const ctx = h.newBoard({ seed: false });
  const own = path.join(ctx.userData, 'My Board');
  let page = await h.launch(ctx);
  try {
    h.expect(await page.locator('#start').count()).toBe(0);
    h.expect(await ctx.app.evaluate(() => global.__dlgCalls)).toBe(0);
    await h.expect(page.locator('#title')).toHaveText('Our memories'); // v2.0: the section's name
    h.expect(await page.locator('#sbTree .sbn').allTextContents()).toEqual(['Our memories']);
    // it really is a board folder: board.json, photos/, thumbs/
    await h.addOne(page, 'Sticky note');
    await page.keyboard.type('hello');
    await page.mouse.click(20, 700);
    const ownCtx = { ...ctx, board: own };
    await h.saved(ownCtx, d => d.notes.length === 1 && d.notes[0].text === 'hello');
    h.expect(fs.existsSync(path.join(own, 'photos'))).toBe(true);
    h.expect(fs.existsSync(path.join(own, 'thumbs'))).toBe(true);
    // Settings → Board → Show folder… shows where it is
    await page.click('#gear');
    await page.click('#tb-board');
    await page.click('#showFolder');
    await h.expect(page.locator('#stName')).toHaveText(fs.realpathSync(own));
    await h.close(ctx);
    // reopening goes back to it, with the note
    page = await h.launch(ctx);
    await h.expect(page.locator('#layer .card.note .nte')).toHaveText('hello');
    await h.close(ctx);
    // if the app's own board folder is deleted, the next launch quietly makes a fresh one
    fs.rmSync(own, { recursive: true, force: true });
    page = await h.launch(ctx);
    h.expect(await page.locator('#start').count()).toBe(0);
    h.expect(await page.locator('#layer .card').count()).toBe(0);
    h.expect(fs.existsSync(own)).toBe(true);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('a board folder she chose that has gone missing: friendly message, choose again', async () => {
  const ctx = h.newBoard();
  fs.rmSync(ctx.board, { recursive: true, force: true });
  const page = await h.launch(ctx, { open: false });
  try {
    await h.expect(page.locator('#start')).toBeVisible();
    await h.expect(page.locator('#msg')).toHaveText(/couldn.t find your board folder \(Our board\)/);
    // choosing a folder (the stubbed dialog returns a new one) opens it
    const again = path.join(ctx.tmp, 'Found it');
    fs.mkdirSync(again);
    await ctx.app.evaluate((x, d) => {
      global.__dlg = d;
    }, again);
    await page.click('#btns .btn');
    await h.expect(page.locator('#lfab')).toBeVisible();
    h.expect(fs.existsSync(path.join(again, 'photos'))).toBe(true);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});
