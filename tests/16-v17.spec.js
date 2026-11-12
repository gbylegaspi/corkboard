// 16. Version 1.7 requests: theme per section; fonts on notes, to-do lists and index cards; bold and italics; longer
// text; longer/shorter notes and calendars; tilt; mixed stacks, spread out and stack again, unstack for good;
// one pin per stack (and the pins come back); select all in a to-do list.
const { test } = require('@playwright/test');
const h = require('./helpers');

const clickMenu = (app, ...labels) =>
  app.evaluate(({ Menu }, ls) => {
    let items = Menu.getApplicationMenu().items,
      it;
    for (const l of ls) {
      it = items.find(i => i.label === l);
      if (!it) return 'missing ' + l;
      items = it.submenu ? it.submenu.items : [];
    }
    it.click();
    return 'clicked';
  }, labels);
const note = (d, id) => d.notes.find(n => n.id === id);
const visiblePins = page =>
  page.$$eval('#yarn .ypin', gs =>
    gs
      .filter(g => g.style.display !== 'none')
      .map(g => {
        const c = g.querySelector('.phd');
        return [Math.round(+c.getAttribute('cx')), Math.round(+c.getAttribute('cy'))];
      })
  );
const visibleYarns = page => page.$$eval('#yarn .yn', gs => gs.filter(g => g.style.display !== 'none').length);
// drop card `id` onto card `onto` (dragged by its top edge so its centre lands on the other card's centre)
async function dropOnto(page, id, onto) {
  await h.settle(page); // the previous drop's animation has finished, so the cards are where they'll stay
  const a = await (await h.card(page, onto)).boundingBox(),
    el = await h.card(page, id),
    b = await el.boundingBox();
  // grab it near its top edge, measured from its centre: cards are tilted at random, so a point just inside the top of the
  // (larger) tilted box can miss the card and land on the board
  const up = (await el.evaluate(e => e.offsetHeight)) / 2 - 12,
    cx = b.x + b.width / 2,
    cy = b.y + b.height / 2;
  await h.drag(page, { x: cx, y: cy - up }, { x: a.x + a.width / 2, y: a.y + a.height / 2 - up }, { after: 700 });
}

test('theme per section', async () => {
  const ctx = h.newBoard({
    data: {
      title: 'T',
      sections: [
        { id: 's1', name: 'One' },
        { id: 's2', name: 'Two' }
      ],
      cur: 's1',
      theme: 'classic'
    }
  });
  const page = await h.launch(ctx);
  try {
    const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.click('#gear');
    await page.click('#tb-theme');
    await h.expect(page.locator('#secThm .trow')).toHaveText(/Different theme for “One”/);
    await page.locator('#secThm input').click();
    await page.locator('#thmList .thm', { hasText: 'Midnight' }).click();
    h.expect(await theme()).toBe('midnight');
    let d = await h.saved(ctx, d => d.sections[0].theme === 'midnight');
    h.expect(d.theme).toBe('classic'); // the board's own theme is unchanged
    await page.click('#setX');
    await h.goSection(page, 'Two');
    await page.waitForTimeout(300);
    h.expect(await theme()).toBe('classic');
    // picking a theme in "Two" (no own theme) changes the board's theme, not "One"
    await page.click('#gear');
    await page.click('#tb-theme');
    h.expect(await page.locator('#secThm input').isChecked()).toBe(false);
    await page.locator('#thmList .thm', { hasText: 'Linen' }).click();
    d = await h.saved(ctx, d => d.theme === 'linen');
    h.expect(d.sections[0].theme).toBe('midnight');
    await page.click('#setX');
    await h.goSection(page, 'One');
    await page.waitForTimeout(300);
    h.expect(await theme()).toBe('midnight');
    // switching it off: "One" follows the board again
    await page.click('#gear');
    await page.click('#tb-theme');
    await page.locator('#secThm input').click();
    h.expect(await theme()).toBe('linen');
    d = await h.saved(ctx, d => !d.sections[0].theme);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('fonts, bold and italics, longer text', async () => {
  const ctx = h.newBoard();
  let page = await h.launch(ctx);
  try {
    const nid = await h.addOne(page, 'Sticky note');
    await page.keyboard.type('a very important note');
    const nel = await h.card(page, nid);
    // bold and italics (Edit → Bold / Italic, the same as ⌘B / ⌘I)
    await h.selectWord(await nel.$('.nte'), 'very');
    await clickMenu(ctx.app, 'Edit', 'Bold');
    await nel.waitForSelector('.nte b'); // (the menu command reaches the page a moment later)
    await h.selectWord(await nel.$('.nte'), 'note');
    await clickMenu(ctx.app, 'Edit', 'Italic');
    let d = await h.saved(ctx, d => note(d, nid).rt && note(d, nid).rt.some(p => p.i));
    h.expect(note(d, nid).rt).toEqual([
      { t: 'a ' },
      { t: 'very', b: true },
      { t: ' important ' },
      { t: 'note', i: true }
    ]);
    h.expect(note(d, nid).text).toBe('a very important note'); // plain text kept for older versions
    // font on the sticky note
    await h.cb(nel, 'font');
    await page.locator('.pop .pi', { hasText: 'Typewriter' }).click();
    await h.saved(ctx, d => note(d, nid).font === 'type');
    h.expect(await nel.$eval('.nte', e => getComputedStyle(e).fontFamily)).toContain('Courier');
    // index card: font + bold
    const iid = await h.addOne(page, 'Index card');
    await page.keyboard.type('plan the trip');
    const iel = await h.card(page, iid);
    await h.selectWord(await iel.$('.ixe'), 'trip');
    await clickMenu(ctx.app, 'Edit', 'Bold');
    await iel.waitForSelector('.ixe b');
    await h.cb(iel, 'font');
    await page.locator('.pop .pi', { hasText: 'Serif' }).click();
    d = await h.saved(ctx, d => note(d, iid).font === 'serif' && note(d, iid).rt);
    h.expect(note(d, iid).rt).toEqual([{ t: 'plan the ' }, { t: 'trip', b: true }]);
    // to-do list: font
    const tid = await h.addOne(page, 'To-do list');
    const tel = await h.card(page, tid);
    await h.cb(tel, 'font');
    await page.locator('.pop .pi', { hasText: 'Marker' }).click();
    await h.saved(ctx, d => note(d, tid).font === 'marker');
    // longer text: 900 characters in a sticky note, a 280-character to-do item
    const long = 'x'.repeat(880) + ' the end';
    await (await nel.$('.nte')).click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.insertText(long);
    await (await tel.$('.tdt')).click();
    await page.keyboard.insertText('y'.repeat(280));
    await page.mouse.click(20, 760);
    d = await h.saved(ctx, d => note(d, nid).text.length === long.length && note(d, tid).items[0].t.length === 280);
    // reopen: formatting and fonts come back
    await h.close(ctx);
    page = await h.launch(ctx);
    h.expect(await (await h.card(page, iid)).$eval('.ixe b', e => e.textContent)).toBe('trip');
    h.expect(await (await h.card(page, tid)).evaluate(e => e.style.getPropertyValue('--cf'))).toContain('Marker');
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('longer or shorter (bottom edge), and tilt', async () => {
  const ctx = h.newBoard();
  const page = await h.launch(ctx);
  try {
    for (const kind of ['Sticky note', 'Index card']) {
      // (v2.0: calendars pick a look instead; see test 18)
      const id = await h.addOne(page, kind);
      await page.keyboard.press('Escape');
      await page.mouse.click(20, 760);
      const el = await h.card(page, id),
        b0 = await el.evaluate(e => ({ width: e.offsetWidth, height: e.offsetHeight }));
      // the card's own drop-in has finished; drag its bottom edge down
      await el.hover();
      await page.waitForTimeout(450);
      const e = await (await el.$('.rze')).boundingBox();
      await h.drag(
        page,
        { x: e.x + e.width / 2, y: e.y + e.height / 2 },
        { x: e.x + e.width / 2, y: e.y + e.height / 2 + 120 }
      );
      await h.saved(ctx, d => (note(d, id).hs || 1) > 1.25);
      await page.mouse.move(20, 760);
      await page.waitForTimeout(400);
      const b1 = await el.evaluate(e => ({ width: e.offsetWidth, height: e.offsetHeight }));
      h.expect(b1.height, kind).toBeGreaterThan(b0.height + 80);
      h.expect(Math.abs(b1.width - b0.width), kind).toBeLessThan(2); // only longer, not wider (the card's own size, not its tilted box)
      // double-click resets
      await el.hover();
      await page.waitForTimeout(450);
      const e2 = await (await el.$('.rze')).boundingBox();
      await page.mouse.dblclick(e2.x + e2.width / 2, e2.y + e2.height / 2);
      await h.saved(ctx, d => note(d, id).hs == null);
    }
    // tilt a sticky note and an index card with the rotate handle; double-click straightens
    for (const kind of ['Sticky note', 'Index card']) {
      const id = await h.addOne(page, kind);
      await page.mouse.click(20, 760);
      const el = await h.card(page, id),
        box = await el.boundingBox(),
        rot = await h.buttonBox(page, el, 'rot');
      const cx = box.x + box.width / 2,
        cy = box.y + box.height / 2,
        p0 = { x: rot.x + rot.width / 2, y: rot.y + rot.height / 2 };
      const a = Math.atan2(p0.y - cy, p0.x - cx) + 0.5,
        r = Math.hypot(p0.x - cx, p0.y - cy);
      await h.drag(page, p0, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      await h.saved(ctx, d => Math.abs(note(d, id).rot) > 15);
      const rot2 = await h.buttonBox(page, el, 'rot');
      await page.mouse.dblclick(rot2.x + rot2.width / 2, rot2.y + rot2.height / 2);
      await h.saved(ctx, d => note(d, id).rot === 0);
    }
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('mixed stacks, one pin per stack, spread out / stack again / unstack for good', async () => {
  const ctx = h.newBoard();
  let page = await h.launch(ctx);
  try {
    const ids = [
      await h.addOne(page, 'Index card'),
      await h.addOne(page, 'Sticky note'),
      await h.addOne(page, 'To-do list')
    ];
    await page.mouse.click(20, 760);
    // a pin in each card, and one on the board tied to the sticky note's pin
    await page.click('#yarnBtn');
    for (const id of ids) {
      const b = await (await h.card(page, id)).boundingBox();
      await page.mouse.click(b.x + b.width * 0.3, b.y + b.height * 0.6);
      await page.waitForTimeout(120);
    }
    const nb = await (await h.card(page, ids[1])).boundingBox(),
      np = { x: nb.x + nb.width * 0.3, y: nb.y + nb.height * 0.6 };
    await page.mouse.click(1150, 700);
    await h.drag(page, { x: 1150, y: 700 }, np);
    await page.click('#yDone');
    let d = await h.saved(ctx, d => d.pins.length === 4 && d.yarns.length === 1);
    h.expect(await visiblePins(page)).toHaveLength(4);
    // stack the sticky note and the to-do list onto the index card
    await dropOnto(page, ids[1], ids[0]);
    await dropOnto(page, ids[2], ids[0]);
    d = await h.saved(
      ctx,
      d => ids.every(id => note(d, id).pile) && new Set(ids.map(id => note(d, id).pile)).size === 1
    );
    const pile = note(d, ids[0]).pile;
    h.expect(await page.locator('#layer .card.ptop .pcount').textContent()).toBe('3 cards');
    h.expect(await page.locator('#layer .card.ptop').evaluate(e => e._p.kind)).toBe('todo');
    // one pin on the stack (plus the board pin); the yarn still reaches the stack
    await page.waitForTimeout(500);
    h.expect(await visiblePins(page)).toHaveLength(2);
    h.expect(await visibleYarns(page)).toBe(1);
    h.expect(d.pins).toHaveLength(4); // nothing is lost from the board
    // spread out to look: every card has its pin again, and the group is kept
    await h.cb(await page.$('#layer .card.ptop'), 'pspread');
    await page.locator('.pop .pi', { hasText: 'Spread out to look' }).click();
    await page.waitForTimeout(600);
    d = await h.saved(ctx, d => ids.every(id => note(d, id).fan === true && note(d, id).pile === pile));
    h.expect(await visiblePins(page)).toHaveLength(4);
    // a spread-out card can be moved and stays in the group
    const sb = await (await h.card(page, ids[1])).boundingBox();
    await h.drag(page, { x: sb.x + sb.width / 2, y: sb.y + 8 }, { x: sb.x + sb.width / 2 + 60, y: sb.y + 100 });
    d = await h.saved(ctx, d => note(d, ids[1]).fan === true && note(d, ids[1]).pile === pile);
    // stack again, then reopen the app: still one stack with one pin
    await h.cb(await h.card(page, ids[0]), 'pspread');
    await page.locator('.pop .pi', { hasText: 'Stack again' }).click();
    await page.waitForTimeout(600);
    d = await h.saved(ctx, d => ids.every(id => note(d, id).pile === pile && !note(d, id).fan));
    await h.close(ctx);
    page = await h.launch(ctx);
    await page.waitForTimeout(600);
    h.expect(await page.locator('#layer .card.ptop .pcount').textContent()).toBe('3 cards');
    h.expect(await visiblePins(page)).toHaveLength(2);
    // unstack for good: no group, and each card's own pin is back
    await h.cb(await page.$('#layer .card.ptop'), 'pspread');
    await page.locator('.pop .pi', { hasText: 'Unstack for good' }).click();
    await page.waitForTimeout(600);
    d = await h.saved(ctx, d => ids.every(id => !note(d, id).pile && !note(d, id).fan));
    h.expect(await visiblePins(page)).toHaveLength(4);
    h.expect((await h.cards(page)).filter(c => /inpile|\bfan\b|ptop/.test(c.cls))).toHaveLength(0);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('to-do list: select all (copy, delete, paste)', async () => {
  const ctx = h.newBoard();
  const page = await h.launch(ctx);
  try {
    const id = await h.addOne(page, 'To-do list'),
      el = await h.card(page, id);
    await page.keyboard.type('milk');
    await page.keyboard.press('Enter');
    await page.keyboard.type('eggs');
    await page.keyboard.press('Enter');
    await page.keyboard.type('bread');
    // ⌘A with the item's text already selected → the whole list
    await page.evaluate(() => {
      const e = document.activeElement,
        r = document.createRange();
      r.selectNodeContents(e);
      const g = getSelection();
      g.removeAllRanges();
      g.addRange(r);
    });
    await page.keyboard.press('Meta+A');
    h.expect(await el.$eval('.tdl', l => l.classList.contains('tdall'))).toBe(true);
    // copy: every item, one per line
    await ctx.app.evaluate(({ clipboard }) => clipboard.clear());
    await page.evaluate(() => document.execCommand('copy'));
    h.expect(await ctx.app.evaluate(({ clipboard }) => clipboard.readText())).toBe('milk\neggs\nbread');
    // Delete clears the list
    await page.keyboard.press('Backspace');
    let d = await h.saved(ctx, d => note(d, id).items.length === 1 && note(d, id).items[0].t === '');
    h.expect(await el.$eval('.tdl', l => l.classList.contains('tdall'))).toBe(false);
    // pasting several lines over a selected list makes one item per line
    await page.keyboard.type('old');
    await page.evaluate(() => {
      const e = document.activeElement,
        r = document.createRange();
      r.selectNodeContents(e);
      const g = getSelection();
      g.removeAllRanges();
      g.addRange(r);
    });
    await page.keyboard.press('Meta+A');
    await ctx.app.evaluate(({ clipboard }) => clipboard.writeText('apples\npears\nplums'));
    await ctx.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.paste());
    d = await h.saved(ctx, d => note(d, id).items.length === 3);
    h.expect(note(d, id).items.map(i => i.t)).toEqual(['apples', 'pears', 'plums']);
    // Esc leaves "everything selected" without changing anything
    await page.evaluate(() => {
      const e = document.activeElement,
        r = document.createRange();
      r.selectNodeContents(e);
      const g = getSelection();
      g.removeAllRanges();
      g.addRange(r);
    });
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Escape');
    h.expect(await el.$eval('.tdl', l => l.classList.contains('tdall'))).toBe(false);
    h.expect(note(await h.saved(ctx), id).items).toHaveLength(3);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});
