// 9. Yarn: pins on a photo, a note and the board; tie yarn, change colours; moving the photo moves its pin; deleting it
// removes its pin and yarn; reopening restores everything; "Remove all" clears the section.
const { test } = require('@playwright/test');
const h = require('./helpers'), fx = require('./fixtures');

test('pins and yarn', async () => {
  const ctx = h.newBoard({ files: { 'p.png': fx.photoSmall(3) }, data: { title: 'T', sections: [{ id: 's1', name: 'One' }], cur: 's1',
    photos: [{ id: 'p.png', file: 'p.png', kind: 'photo', s: 's1', x: .08, y: 230, rot: 0, z: 1, mode: 'square' }],
    notes: [{ id: 'n', s: 's1', x: .45, y: 240, rot: 0, z: 2, c: '#cdeed6', text: 'note' }] } });
  let page = await h.launch(ctx);
  try {
    const pins = () => page.$$eval('#yarn .ypin', gs => gs.filter(g => g.style.display !== 'none').map(g => { const c = g.querySelector('.phd'); return { x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), fill: c.getAttribute('fill') }; }));
    const yarns = () => page.$$eval('#yarn .yn', gs => gs.filter(g => g.style.display !== 'none').map(g => g.querySelector('.ym').getAttribute('stroke')));
    await page.click('#yarnBtn');
    await h.expect(page.locator('#ytools')).toBeVisible();
    // tap a photo, a note and empty board: three pins
    const pb = await (await h.card(page, 'p.png')).boundingBox(), nb = await (await h.card(page, 'n')).boundingBox();
    const P = { x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 }, N = { x: nb.x + nb.width / 2, y: nb.y + nb.height / 2 }, B = { x: 1050, y: 640 };
    for (const p of [P, N, B]) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(150); }
    let d = await h.saved(ctx, d => d.pins.length === 3);
    h.expect(d.pins.map(p => p.card || p.s)).toEqual(['p.png', 'n', 's1']);
    // tie photo → note with the default red; switch to blue and tie note → board
    await h.drag(page, P, N);
    await page.locator('#ytools .ysw').nth(1).click();
    await h.drag(page, N, B);
    d = await h.saved(ctx, d => d.yarns.length === 2);
    h.expect(d.yarns.map(y => y.c)).toEqual(['#d6264f', '#2f6fd6']);
    h.expect(d.yarnCol).toBe('#2f6fd6');
    h.expect(await yarns()).toEqual(['#d6264f', '#2f6fd6']);
    // dragging from a pin to empty space makes a new pin there and ties it
    await h.drag(page, B, { x: 1150, y: 420 });
    d = await h.saved(ctx, d => d.pins.length === 4 && d.yarns.length === 3);
    // tap the first yarn to recolour it (the point halfway along its sag)
    const zm = 1, dist = Math.hypot(N.x - P.x, N.y - P.y), sag = Math.min(46, dist * .09) * Math.max(.5, zm);
    await page.mouse.click((P.x + N.x) / 2, (P.y + N.y) / 2 + sag / 2);
    await h.expect(page.locator('.pop h4')).toHaveText('Yarn');
    await page.locator('.pop .ysw').nth(4).click();
    await page.keyboard.press('Escape');
    d = await h.saved(ctx, d => d.yarns[0].c === '#ff8fb1');
    // tap a pin to recolour it
    await page.mouse.click(B.x, B.y);
    await h.expect(page.locator('.pop h4')).toHaveText('Pin');
    await page.locator('.pop .ysw').nth(3).click(); await page.keyboard.press('Escape');
    d = await h.saved(ctx, d => d.pins[2].c === '#f2c230');
    await page.click('#yDone');
    await h.expect(page.locator('#ytools')).toBeHidden();
    // move the photo: its pin moves with it, the others stay
    const p0 = await pins();
    await h.drag(page, { x: pb.x + pb.width / 2, y: pb.y + 6 }, { x: pb.x + pb.width / 2 + 120, y: pb.y + 46 }, { after: 600 });
    const p1 = await pins();
    h.expect(Math.abs(p1[0].x - p0[0].x - 120)).toBeLessThan(3); h.expect(Math.abs(p1[0].y - p0[0].y - 40)).toBeLessThan(3);
    for (const i of [1, 2, 3]) { h.expect(p1[i].x).toBeCloseTo(p0[i].x, 0); h.expect(p1[i].y).toBeCloseTo(p0[i].y, 0); }
    // delete the photo: its pin and that yarn go
    const ph = await h.card(page, 'p.png');
    await h.cb(ph, 'del'); await h.cb(ph, 'del');
    d = await h.saved(ctx, d => d.photos.length === 0 && d.pins.length === 3 && d.yarns.length === 2);
    h.expect(d.pins.some(p => p.card === 'p.png')).toBe(false);
    await page.waitForTimeout(500);
    h.expect(await pins()).toHaveLength(3); h.expect(await yarns()).toHaveLength(2);
    // reopen: everything is restored
    const keep = JSON.stringify({ pins: d.pins, yarns: d.yarns });
    await h.close(ctx); page = await h.launch(ctx); await page.waitForTimeout(600);
    h.expect(JSON.stringify({ pins: h.readBoard(ctx).pins, yarns: h.readBoard(ctx).yarns })).toBe(keep);
    h.expect(await pins()).toHaveLength(3); h.expect(await yarns()).toEqual(['#2f6fd6', '#2f6fd6']);
    // "Remove all" (two taps) clears this section
    await page.click('#yarnBtn');
    await page.click('#yClear'); await h.expect(page.locator('#yClear')).toContainText('Remove 3 pins');
    await page.click('#yClear');
    d = await h.saved(ctx, d => d.pins.length === 0 && d.yarns.length === 0);
    h.expect(await pins()).toHaveLength(0);
    await page.keyboard.press('Escape');
    await h.expect(page.locator('#ytools')).toBeHidden();
    await h.close(ctx); page = await h.launch(ctx); await page.waitForTimeout(600);
    h.expect(await pins()).toHaveLength(0);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
