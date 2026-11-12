// 7. Zoom (buttons, Ctrl + wheel), dragging while zoomed; a card beside the board, reached by the edge badge and by scrolling.
const { test } = require('@playwright/test');
const h = require('./helpers');

test('zoom, drag while zoomed, cards beside the board, sideways scrolling', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    const id = await h.addOne(page, 'Sticky note');
    await page.mouse.click(20, 700);
    // buttons: 100% is the maximum
    await h.expect(page.locator('#zmIn')).toBeDisabled();
    await page.click('#zmOut'); h.expect(await h.zoomText(page)).toBe('85%');
    await page.click('#zmOut'); h.expect(await h.zoomText(page)).toBe('70%');
    await page.click('#zmIn'); h.expect(await h.zoomText(page)).toBe('85%');
    await page.click('#zmN'); h.expect(await h.zoomText(page)).toBe('100%');
    // Ctrl + wheel (and trackpad pinch, which arrives the same way) zooms out from 100%, never in past it
    await page.mouse.move(640, 450);
    await page.keyboard.down('Control'); await page.mouse.wheel(0, 200); await page.keyboard.up('Control');
    await page.waitForTimeout(300);
    const z = parseInt(await h.zoomText(page));
    h.expect(z).toBeLessThan(70); h.expect(z).toBeGreaterThanOrEqual(35);
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -2000); await page.keyboard.up('Control');
    await page.waitForTimeout(300);
    h.expect(await h.zoomText(page)).toBe('100%');
    await page.click('#zmOut'); await page.click('#zmOut'); // 70%
    await h.saved(ctx, d => d.zoom === 0.7);
    // drag a card while zoomed: it stays under the pointer
    const el = await h.card(page, id), b0 = await el.boundingBox();
    const g = { x: b0.x + b0.width / 2, y: b0.y + 10 };
    await page.mouse.move(g.x, g.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(g.x + 15 * i, g.y + 6 * i);
    const mid = await el.boundingBox();     // while held: moved exactly with the pointer
    await page.mouse.up(); await page.waitForTimeout(400);
    h.expect(Math.abs((mid.x + mid.width / 2) - (b0.x + b0.width / 2) - 150)).toBeLessThan(8);
    h.expect(Math.abs((mid.y + mid.height / 2) - (b0.y + b0.height / 2) - 60)).toBeLessThan(8);
    // zoom right out and put the card in the space beside the normal board
    while (!(await page.locator('#zmOut').isDisabled())) await page.click('#zmOut');
    h.expect(await h.zoomText(page)).toBe('35%');
    await page.waitForTimeout(400); // let the zoom animation (0.18 s) finish before measuring the card
    let b = await el.boundingBox();
    await h.drag(page, { x: b.x + b.width / 2, y: b.y + 8 }, { x: 40, y: b.y + 8 }, { after: 500 });
    let d = await h.saved(ctx, d => d.notes[0].x < 0);
    h.expect(d.notes[0].x).toBeGreaterThanOrEqual(-(1 / 0.35 - 1) / 2 - 0.01);
    // back to 100%: the card is off to the left, and a badge says so
    await page.click('#zmN'); await page.waitForTimeout(500);
    await h.expect(page.locator('#edgeL')).toBeVisible();
    await h.expect(page.locator('#edgeL b')).toHaveText('1');
    h.expect((await el.boundingBox()).x + (await el.boundingBox()).width).toBeLessThan(8);
    // the badge scrolls smoothly to it
    await page.click('#edgeL'); await page.waitForTimeout(800);
    b = await el.boundingBox();
    h.expect(b.x).toBeGreaterThan(0); h.expect(b.x + b.width).toBeLessThan(1280);
    await h.expect(page.locator('#edgeL')).toBeHidden();
    await h.expect(page.locator('#hbar')).toBeVisible();
    // sideways scrolling: trackpad swipe and Shift + wheel move the view; the card moves the other way on screen
    // (± 8 px: the card may still be finishing a small hover or settling animation)
    const x1 = (await el.boundingBox()).x;
    await page.mouse.move(640, 500); await page.mouse.wheel(300, 0); await page.waitForTimeout(300);
    const x2 = (await el.boundingBox()).x;
    h.expect(Math.abs(x1 - x2 - 300)).toBeLessThan(8);
    await page.keyboard.down('Shift'); await page.mouse.wheel(0, -200); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
    h.expect(Math.abs((await el.boundingBox()).x - x2 - 200)).toBeLessThan(8);
    // dragging empty board space pans too
    const x3 = (await el.boundingBox()).x;
    await h.drag(page, { x: 900, y: 650 }, { x: 750, y: 650 });
    h.expect(Math.abs(x3 - (await el.boundingBox()).x - 150)).toBeLessThan(8);
    // double-clicking a badge zooms out to show everything
    await page.mouse.wheel(2000, 0); await page.waitForTimeout(300);
    await h.expect(page.locator('#edgeL')).toBeVisible();
    await page.dblclick('#edgeL'); await page.waitForTimeout(500);
    h.expect(parseInt(await h.zoomText(page))).toBeLessThan(100);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
