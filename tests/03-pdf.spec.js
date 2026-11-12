// 3. PDFs: a 5-page PDF, flipping on the card; the reader with buttons and keys; the page is remembered.
const { test } = require('@playwright/test');
const h = require('./helpers'),
  fx = require('./fixtures');

test('PDF card, reader and remembered page', async () => {
  const ctx = h.newBoard();
  let page = await h.launch(ctx);
  try {
    await page.setInputFiles('#file', fx.pdf5());
    await page.waitForSelector('#layer .card.doc');
    const id = (await h.cards(page)).find(c => /doc/.test(c.cls)).id;
    let el = await h.card(page, id);
    // wait until no page is mid-flip (on the card or in the reader); a flip pressed during one is ignored, as designed
    const still = () => page.waitForFunction(() => !document.querySelector('.card.doc canvas.peel, #rd .turn'));
    await page.waitForFunction(() => {
      const p = document.querySelector('.card.doc .pg');
      return p && !p.classList.contains('ld');
    });
    h.expect(await el.$eval('.pg', e => e.classList.contains('bad'))).toBe(false);
    await h.expect(page.locator('.card.doc .pgn')).toHaveText('1 / 5');
    await still();
    let d = await h.saved(ctx, d => d.photos.length === 1);
    h.expect(d.photos[0]).toMatchObject({ kind: 'doc', n: 5, pg: 0 });
    h.expect(d.photos[0].file).toMatch(/^doc-.*\.pdf$/);
    // ‹ › on the card, with the peel animation
    await h.cb(el, 'nxt');
    await page.waitForSelector('.card.doc canvas.peel');
    await page.waitForFunction(() => !document.querySelector('.card.doc canvas.peel'));
    await h.expect(page.locator('.card.doc .pgn')).toHaveText('2 / 5');
    await still();
    // arrow keys on the focused card
    await el.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await still();
    await h.expect(page.locator('.card.doc .pgn')).toHaveText('3 / 5');
    await still();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await still();
    await h.expect(page.locator('.card.doc .pgn')).toHaveText('2 / 5');
    await still();
    // tap the card: the reader opens on the same page
    const b = await el.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.55);
    await h.expect(page.locator('#rd')).toBeVisible();
    await h.expect(page.locator('#rd .rdc')).toHaveText('Page 2 of 5');
    await still();
    await page.waitForFunction(() => !document.querySelector('#rd .rdp').classList.contains('ld'));
    await page.click('#rd .rdn.nxt');
    await page.waitForTimeout(100);
    await still();
    await h.expect(page.locator('#rd .rdc')).toHaveText('Page 3 of 5');
    await still();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await still();
    await h.expect(page.locator('#rd .rdc')).toHaveText('Page 4 of 5');
    await still();
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(100);
    await still();
    await h.expect(page.locator('#rd .rdc')).toHaveText('Page 5 of 5');
    await still();
    await h.expect(page.locator('#rd .rdn.nxt')).toBeDisabled();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await still();
    await h.expect(page.locator('#rd .rdc')).toHaveText('Page 4 of 5');
    await still();
    // tapping the left half of the page goes back
    const rp = await page.locator('#rd .rdp').boundingBox();
    await page.mouse.click(rp.x + rp.width * 0.2, rp.y + rp.height / 2);
    await page.waitForTimeout(100);
    await still();
    await h.expect(page.locator('#rd .rdc')).toHaveText('Page 3 of 5');
    await still();
    await page.keyboard.press('Escape');
    await h.expect(page.locator('#rd')).toBeHidden();
    await h.expect(page.locator('.card.doc .pgn')).toHaveText('3 / 5');
    await still();
    await h.saved(ctx, d => d.photos[0].pg === 2);
    // reopen the app: still on page 3
    await h.close(ctx);
    page = await h.launch(ctx);
    el = await h.card(page, id);
    await h.expect(page.locator('.card.doc .pgn')).toHaveText('3 / 5');
    await still();
    // a Word file gets the "save it as a PDF first" hint (a password-protected PDF isn't generated here)
    const fs = require('fs'),
      path = require('path');
    const docx = path.join(ctx.tmp, 'letter.docx');
    fs.writeFileSync(docx, 'PK fake');
    await page.setInputFiles('#file', docx);
    await h.expect(page.locator('.toast')).toContainText('Save As');
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});
