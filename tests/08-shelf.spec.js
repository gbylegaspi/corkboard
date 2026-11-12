// 8. Shelf: multi-select 3 cards onto it; a near miss doesn't shelve; in another section drag one out, tap one out
// (it lands on screen while scrolled), double-click "Put everything here" (no duplicates).
const { test } = require('@playwright/test');
const h = require('./helpers');

const note = (id, s, x, y, text) => ({ id, s, x, y, rot: 0, z: 1, c: '#fff2a8', text });

test('shelf: carry cards between sections', async () => {
  const ctx = h.newBoard({ data: { title: 'T', sections: [{ id: 's1', name: 'One' }, { id: 's2', name: 'Two' }], cur: 's1', photos: [],
    notes: [note('a', 's1', .05, 230, 'A'), note('b', 's1', .3, 230, 'B'), note('c', 's1', .55, 230, 'C'), note('e', 's1', .05, 520, 'E'),
            note('far', 's2', .4, 1800, 'far down')] } });
  const page = await h.launch(ctx);
  try {
    const sh = async () => page.locator('#shBtn').boundingBox();
    // Shift-click picks several (dashed outline)
    await page.keyboard.down('Shift');
    for (const id of ['a', 'b', 'c']) await page.mouse.click(...Object.values(await h.grip(await h.card(page, id))));
    await page.keyboard.up('Shift');
    h.expect((await h.cards(page)).filter(c => /\bsel\b/.test(c.cls)).map(c => c.id).sort()).toEqual(['a', 'b', 'c']);
    // while dragging, the shelf button turns into a pulsing drop target; dropping one moves all three
    const g = await h.grip(await h.card(page, 'a')), s = await sh();
    await page.mouse.move(g.x, g.y); await page.mouse.down();
    await page.mouse.move(g.x + 40, g.y + 40, { steps: 4 });
    h.expect(await page.evaluate(() => document.body.classList.contains('cbdrag'))).toBe(true);
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2, { steps: 10 });
    h.expect(await page.evaluate(() => document.getElementById('shelf').classList.contains('hot'))).toBe(true);
    await page.mouse.up(); await page.waitForTimeout(600);
    await h.expect(page.locator('#shN')).toHaveText('3');
    let d = await h.saved(ctx, d => d.notes.filter(n => n.s === 'shelf').length === 3);
    h.expect(d.notes.filter(n => n.s === 'shelf').every(n => typeof n.sh === 'number')).toBe(true);
    h.expect((await h.cards(page)).map(c => c.id)).toEqual(['e']);
    // a near miss beside the shelf doesn't shelve it
    const e = await h.grip(await h.card(page, 'e')), s2 = await sh();
    await h.drag(page, e, { x: s2.x - 70, y: s2.y + s2.height / 2 }, { after: 600 });
    d = await h.saved(ctx, d => d.notes.find(n => n.id === 'e').y > 520);
    h.expect(d.notes.find(n => n.id === 'e').s).toBe('s1');
    // ...but dropping it on the shelf does
    const e2 = await h.grip(await h.card(page, 'e')), s3 = await sh();
    await h.drag(page, e2, { x: s3.x + s3.width / 2, y: s3.y + s3.height / 2 }, { after: 600 });
    await h.expect(page.locator('#shN')).toHaveText('4');

    // another section: open the shelf, drag one out
    await h.goSection(page, 'Two'); await page.waitForTimeout(600);
    await page.click('#shBtn');
    await h.expect(page.locator('#shG .shi')).toHaveCount(4);
    const t1 = await page.locator('#shG .shi').first().boundingBox();
    await h.drag(page, { x: t1.x + 30, y: t1.y + 30 }, { x: 350, y: 380 }, { after: 600 });
    await h.expect(page.locator('#shG .shi')).toHaveCount(3);
    const onBoard = () => h.cards(page).then(cs => cs.filter(c => c.id !== 'far'));
    let cs = await onBoard();
    h.expect(cs).toHaveLength(1);
    h.expect(Math.abs(cs[0].x - 350)).toBeLessThan(160); h.expect(Math.abs(cs[0].y - 380)).toBeLessThan(160);
    // scroll down, then tap one: it lands where she's looking
    await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(300);
    const before = new Set((await onBoard()).map(c => c.id));
    await page.locator('#shG .shi').first().click(); await page.waitForTimeout(700);
    const tapped = (await onBoard()).find(c => !before.has(c.id));
    h.expect(tapped.y).toBeGreaterThan(0); h.expect(tapped.y + tapped.h).toBeLessThan(await page.evaluate(() => innerHeight));
    // "Put everything here", double-clicked: everything comes out once
    await h.expect(page.locator('#shAll')).toBeVisible();
    await page.dblclick('#shAll'); await page.waitForTimeout(1200);
    d = await h.saved(ctx, d => d.notes.every(n => n.s !== 'shelf'));
    h.expect(d.notes).toHaveLength(5);
    h.expect(new Set(d.notes.map(n => n.id)).size).toBe(5);
    h.expect(d.notes.filter(n => n.s === 's2').map(n => n.id).sort()).toEqual(['a', 'b', 'c', 'e', 'far']);
    h.expect((await h.cards(page)).map(c => c.id).sort()).toEqual(['a', 'b', 'c', 'e', 'far']);
    await h.expect(page.locator('#shN')).toBeHidden();
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
