// 14. macOS behaviour: password-protected PDFs, the Dock (closing the window keeps the app; clicking the icon reopens the
// board), quitting saves a pending change, sound works without a click first.
const { test } = require('@playwright/test');
const h = require('./helpers'), fx = require('./fixtures');

test.skip(process.platform !== 'darwin', 'macOS behaviour (and a PDFKit-made fixture)');

test('a password-protected PDF gets the friendly message and isn\'t added', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    await page.setInputFiles('#file', fx.lockedPdf());
    await h.expect(page.locator('.toast')).toContainText('password-protected');
    h.expect(await page.locator('#layer .card').count()).toBe(0);
    h.expect(h.list(ctx, 'photos')).toEqual([]);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});

test('closing the window keeps Corkboard in the Dock; clicking the Dock icon reopens the board', async () => {
  const ctx = h.newBoard(); let page = await h.launch(ctx);
  try {
    await h.addOne(page, 'Sticky note'); await page.keyboard.type('still here');
    // ⌘W straight after typing: the pending save still happens
    await ctx.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await h.expect.poll(() => ctx.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
    h.expect(h.readBoard(ctx).notes[0].text).toBe('still here');
    h.expect(ctx.app.process().exitCode).toBeNull();                    // the app is still running
    h.expect(await ctx.app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(i => i.label === 'File').submenu.items.find(i => /Show Board Folder/.test(i.label)).enabled)).toBe(false);
    // the Dock icon is clicked
    const next = ctx.app.waitForEvent('window');
    await ctx.app.evaluate(({ app }) => app.emit('activate'));
    page = await next; ctx.page = page;
    await page.waitForSelector('#layer .card.note');
    await h.expect(page.locator('#layer .card.note .nte')).toHaveText('still here');
  } finally { await h.close(ctx); }
});

test('⌘Q straight after a change still saves it', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    await page.click('#title'); await page.keyboard.press('Meta+A'); await page.keyboard.type('Quit test');
    const exited = new Promise(r => ctx.app.process().once('exit', r));
    await ctx.app.evaluate(({ app }) => setTimeout(() => app.quit(), 0)); // like ⌘Q
    await exited; ctx.app = null;
    h.expect(h.readBoard(ctx).sections[0].name).toBe('Quit test'); // v2.0: the title renames the section
  } finally { await h.close(ctx); }
});

test('sound effects can play without a click first', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    h.expect(await page.evaluate(async () => { const c = new AudioContext(); await new Promise(r => setTimeout(r, 200)); const s = c.state; c.close(); return s; })).toBe('running');
  } finally { await h.close(ctx); }
});
