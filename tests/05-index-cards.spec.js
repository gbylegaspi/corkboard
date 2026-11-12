// 5. Index cards: pile 3 cards, flip, move the pile, pull the top card off, spread, delete.
const { test } = require('@playwright/test');
const h = require('./helpers');

test('index card piles', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    const ids = [];
    for (let i = 0; i < 3; i++) {
      ids.push(await h.addOne(page, 'Index card'));
      await page.keyboard.type('card ' + (i + 1));
      await page.mouse.click(20, 700);
    }
    const box = async id => (await h.card(page, id)).boundingBox();
    // drop B and then C onto A (dragged by their top edge, so each card's centre lands on A's centre)
    for (const id of [ids[1], ids[2]]) {
      const el = await h.card(page, id), b = await el.boundingBox(), a = await box(ids[0]);
      await h.drag(page, { x: b.x + b.width / 2, y: b.y + 8 }, { x: a.x + a.width / 2, y: a.y + a.height / 2 - b.height / 2 + 8 }, { after: 600 });
    }
    let d = await h.saved(ctx, d => d.notes.filter(n => n.pile).length === 3);
    const pile = d.notes[0].pile;
    h.expect(new Set(d.notes.map(n => n.pile)).size).toBe(1);
    h.expect(d.notes.map(n => n.po).sort()).toEqual([0, 1, 2]);
    const top = async () => (await h.cards(page)).find(c => /ptop/.test(c.cls)).id;
    let t = await top();
    h.expect(t).toBe(ids[2]);
    h.expect(await (await h.card(page, t)).$eval('.pcount', e => e.textContent)).toBe('3 cards');
    // next card: the top one tucks in at the bottom
    await h.cb(await h.card(page, t), 'pflip'); await page.waitForTimeout(700);
    h.expect(await top()).toBe(ids[1]);
    d = await h.saved(ctx, d => d.notes.find(n => n.id === ids[2]).po === 0);
    // move the whole pile by its grip
    t = await top();
    const W = await page.evaluate(() => document.getElementById('board').clientWidth), before = h.readBoard(ctx).notes;
    const g = await h.buttonBox(page, await h.card(page, t), 'pmove');
    await h.drag(page, { x: g.x + g.width / 2, y: g.y + g.height / 2 }, { x: g.x + g.width / 2 + 160, y: g.y + g.height / 2 + 90 }, { after: 500 });
    d = await h.saved(ctx, d => d.notes.every(n => { const o = before.find(q => q.id === n.id); return Math.abs(n.y - o.y - 90) < 1.5; }));
    d.notes.forEach(n => { const o = before.find(q => q.id === n.id); h.expect(Math.abs((n.x - o.x) * W - 160)).toBeLessThan(1.5); });
    // pulling the top card away takes it out of the pile
    const tb = await box(t);
    await h.drag(page, { x: tb.x + tb.width / 2, y: tb.y + 8 }, { x: tb.x + tb.width / 2 + 330, y: tb.y + 8 }, { after: 600 });
    d = await h.saved(ctx, d => !d.notes.find(n => n.id === t).pile && d.notes.filter(n => n.pile === pile).length === 2);
    const t2 = await top();
    h.expect(await (await h.card(page, t2)).$eval('.pcount', e => e.textContent)).toBe('2 cards');
    // spread the rest out: no pile left
    await h.cb(await h.card(page, t2), 'pspread'); await page.waitForTimeout(500);
    d = await h.saved(ctx, d => d.notes.every(n => !n.pile));
    h.expect((await h.cards(page)).filter(c => /inpile/.test(c.cls))).toHaveLength(0);
    // delete one (two taps)
    const del = await h.card(page, ids[0]);
    await h.cb(del, 'del'); await h.cb(del, 'del');
    d = await h.saved(ctx, d => d.notes.length === 2);
    h.expect(d.notes.map(n => n.text).sort()).toEqual(['card 2', 'card 3']);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
