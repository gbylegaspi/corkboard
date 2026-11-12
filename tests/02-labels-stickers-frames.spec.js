// 2. Labels (all three looks, colour, font, resize, links on words), stickers (finishes, rotation), frames, fonts.
const { test } = require('@playwright/test');
const h = require('./helpers'),
  fx = require('./fixtures');

test('labels: looks, colour, font, resize, link on a word', async () => {
  const ctx = h.newBoard();
  const page = await h.launch(ctx);
  try {
    const id = await h.addOne(page, 'Label');
    const el = await h.card(page, id);
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('ltx'));
    await page.keyboard.type('hello world');
    // link on one word: select it, then the link button
    await h.selectWord(await el.$('.ltx'), 'world');
    await h.cb(el, 'lnk');
    await page.fill('.pop input.lki', 'example.com');
    await page.press('.pop input.lki', 'Enter');
    await page.keyboard.press('Enter'); // finish editing
    let d = await h.saved(ctx, d => d.labels.length === 1 && d.labels[0].rt);
    h.expect(d.labels[0].text).toBe('hello world');
    h.expect(d.labels[0].rt).toEqual([{ t: 'hello ' }, { t: 'world', u: 'https://example.com/' }]);
    h.expect(await el.$eval('.ltx a', a => a.getAttribute('href'))).toBe('https://example.com/');

    // the three looks (the default look for new labels is label-maker tape)
    h.expect(await el.evaluate(e => e.classList.contains('lk-tape'))).toBe(true);
    for (const [name, cls, look] of [
      ['Washi tape', 'lk-washi', 'washi'],
      ['Handwritten tag', 'lk-tag', 'tag'],
      ['Label-maker tape', 'lk-tape', 'tape']
    ]) {
      await h.cb(el, 'look');
      await page.locator('.pop .pi', { hasText: name }).click();
      h.expect(await el.evaluate((e, c) => e.classList.contains(c), cls)).toBe(true);
      await h.saved(ctx, d => d.labels[0].look === look);
    }
    // colour: the dot cycles through the look's colours
    const c0 = h.readBoard(ctx).labels[0].c;
    await h.cb(el, 'dot');
    d = await h.saved(ctx, d => d.labels[0].c !== c0);
    h.expect(await el.evaluate(e => e.style.getPropertyValue('--lc'))).toBe(d.labels[0].c);
    // font
    await h.cb(el, 'font');
    await page.locator('.pop .pi', { hasText: 'Typewriter' }).click();
    await h.saved(ctx, d => d.labels[0].font === 'type');
    h.expect(await el.evaluate(e => e.style.getPropertyValue('--cf'))).toContain('Courier');
    // resize with the handle; double-click resets (first move the label clear of the sticky section tabs)
    const lb = await el.boundingBox();
    await h.drag(
      page,
      { x: lb.x + lb.width / 2, y: lb.y + lb.height / 2 },
      { x: lb.x + lb.width / 2 + 40, y: lb.y + lb.height / 2 + 220 }
    );
    const w0 = (await el.boundingBox()).width,
      rz = await h.buttonBox(page, el, 'rz');
    await h.drag(page, { x: rz.x + rz.width / 2, y: rz.y + rz.height / 2 }, { x: rz.x + 90, y: rz.y + 40 });
    d = await h.saved(ctx, d => d.labels[0].sc > 1.2);
    h.expect((await el.boundingBox()).width).toBeGreaterThan(w0 * 1.2);
    const rz2 = await h.buttonBox(page, el, 'rz');
    await page.mouse.dblclick(rz2.x + rz2.width / 2, rz2.y + rz2.height / 2);
    await h.saved(ctx, d => d.labels[0].sc == null || d.labels[0].sc === 1);
    // tapping the linked word (not editing) shows the bubble; Open goes to the default browser
    await page.locator('#layer .card.label .ltx a').click();
    await page.locator('.pop .lkb .sbtn', { hasText: 'Open' }).click();
    await page.waitForTimeout(300);
    h.expect(await ctx.app.evaluate(() => global.__external)).toEqual(['https://example.com/']);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('stickers: finishes, rotation, library; transparency hint', async () => {
  const ctx = h.newBoard();
  const page = await h.launch(ctx);
  try {
    await page.setInputFiles('#stkFile', fx.sticker());
    await page.waitForSelector('#layer .card.sticker');
    const s1 = (await h.cards(page)).find(c => /sticker/.test(c.cls)).id,
      el1 = await h.card(page, s1);
    // Shiny + White border
    await h.cb(el1, 'fin');
    await page.locator('.pop .seg button', { hasText: 'Shiny' }).click();
    await page.locator('.pop label.trow', { hasText: 'White border' }).locator('input').click();
    await page.keyboard.press('Escape');
    let f = await el1.$eval('.stk', e => e.style.filter);
    h.expect(f).toContain('url("#cbG")');
    h.expect(f).toContain('url("#cbB")');
    await h.saved(ctx, d => d.photos[0].fin && d.photos[0].fin.sh === 'gloss' && d.photos[0].fin.b === true);
    // a second copy from the library: Matte + Worn down + White border
    const before = await h.cards(page);
    await h.add(page, 'Sticker');
    await page.locator('.pop.stkpop .sti').first().click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(n => document.querySelectorAll('#layer .card.sticker').length === n, 2);
    const s2 = await h.newCardId(page, before),
      el2 = await h.card(page, s2);
    await h.cb(el2, 'fin');
    await page.locator('.pop .seg button', { hasText: 'Matte' }).click();
    await page.locator('.pop label.trow', { hasText: 'Worn down' }).locator('input').click();
    await page.locator('.pop label.trow', { hasText: 'White border' }).locator('input').click();
    await page.keyboard.press('Escape');
    f = await el2.$eval('.stk', e => e.style.filter);
    for (const id of ['#cbM', '#cbW', '#cbB']) h.expect(f).toContain(`url("${id}")`);
    let d = await h.saved(ctx, d => {
      const p = d.photos.find(q => q.id === s2);
      return p && p.fin && p.fin.sh === 'matte' && p.fin.w && p.fin.b;
    });
    h.expect(d.stickers).toHaveLength(1); // one library entry, used twice
    h.expect(d.photos.filter(p => p.kind === 'sticker').map(p => p.file)).toEqual([
      d.stickers[0].file,
      d.stickers[0].file
    ]);
    // rotate with the handle (drag around the centre); double-click straightens
    const box = await el2.boundingBox(),
      rot = await h.buttonBox(page, el2, 'rot');
    const cx = box.x + box.width / 2,
      cy = box.y + box.height / 2,
      p0 = { x: rot.x + rot.width / 2, y: rot.y + rot.height / 2 };
    const a = Math.atan2(p0.y - cy, p0.x - cx) + 0.6,
      r = Math.hypot(p0.x - cx, p0.y - cy);
    await h.drag(page, p0, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    d = await h.saved(ctx, d => Math.abs(d.photos.find(q => q.id === s2).rot) > 20);
    const rot2 = await h.buttonBox(page, el2, 'rot');
    await page.mouse.dblclick(rot2.x + rot2.width / 2, rot2.y + rot2.height / 2);
    await h.saved(ctx, d => d.photos.find(q => q.id === s2).rot === 0);
    // removing a sticker from the board keeps it in the library (and its file)
    await h.cb(el1, 'del');
    await h.cb(el1, 'del');
    d = await h.saved(ctx, d => d.photos.length === 1);
    h.expect(d.stickers).toHaveLength(1);
    h.expect(h.list(ctx, 'photos')).toContain(d.stickers[0].file);
    // an image without a transparent background gets the friendly hint
    await page.setInputFiles('#stkFile', fx.photoSmall(0));
    await h.expect(page.locator('.toast')).toContainText('no transparent background');
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('photo frames: polaroid → no frame + pin → no frame + tape; "No frame" upload; caption font; default font', async () => {
  const ctx = h.newBoard();
  const page = await h.launch(ctx);
  try {
    const [p] = await h.addPhotos(page, fx.photoSmall(1), 'square');
    const el = await h.card(page, p);
    const state = () =>
      el.evaluate(e => ({
        bare: e.classList.contains('bare'),
        pin: !!e.querySelector(':scope>.pin'),
        tape: e.querySelectorAll(':scope>.tape').length
      }));
    h.expect(await state()).toEqual({ bare: false, pin: true, tape: 0 });
    await h.cb(el, 'frm');
    h.expect(await state()).toEqual({ bare: true, pin: true, tape: 0 });
    await h.saved(ctx, d => d.photos[0].bare === true && d.photos[0].hold === 'pin');
    await h.cb(el, 'frm');
    h.expect(await state()).toEqual({ bare: true, pin: false, tape: 2 });
    await h.saved(ctx, d => d.photos[0].hold === 'tape');
    await h.cb(el, 'frm');
    h.expect(await state()).toEqual({ bare: false, pin: true, tape: 0 });
    await h.saved(ctx, d => !d.photos[0].bare && !d.photos[0].hold);
    // caption font
    await h.cb(el, 'font');
    await page.locator('.pop .pi', { hasText: 'Handwritten' }).click();
    await h.saved(ctx, d => d.photos[0].font === 'hand');
    // the "No frame" choice when adding
    const [q] = await h.addPhotos(page, fx.photoSmall(2), 'bare');
    const d = await h.saved(ctx, d => d.photos.length === 2);
    const pq = d.photos.find(x => x.id === q);
    h.expect(pq.bare).toBe(true);
    h.expect(pq.hold).toBe('pin');
    h.expect(pq.mode).toBe('original');
    h.expect(await (await h.card(page, q)).evaluate(e => e.classList.contains('bare'))).toBe(true);
    // Settings → Cards → default caption & label font
    await page.click('#gear');
    await page.click('#tb-cards');
    await page.locator('#styleBox .seg button', { hasText: 'Serif' }).click();
    await h.saved(ctx, d => d.style.font === 'serif');
    h.expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--gf'))).toContain('Georgia');
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test("a new label's buttons can all be reached (not under the section tabs, not off screen)", async () => {
  const ctx = h.newBoard();
  const page = await h.launch(ctx);
  try {
    for (const size of [
      [1280, 860],
      [900, 700]
    ]) {
      await ctx.app.evaluate(
        ({ BrowserWindow }, s) => BrowserWindow.getAllWindows()[0].setContentSize(s[0], s[1]),
        size
      );
      await page.waitForTimeout(400);
      const id = await h.addOne(page, 'Label');
      await page.keyboard.type('hi');
      await page.keyboard.press('Enter');
      const el = await h.card(page, id);
      await el.hover();
      await page.waitForTimeout(450);
      const blocked = await page.evaluate(i => {
        const c = [...document.querySelectorAll('#layer .card')].find(e => e._p.id === i);
        return [...c.querySelectorAll('.lbar .cb')]
          .filter(b => {
            const q = b.getBoundingClientRect(),
              t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
            return !b.contains(t);
          })
          .map(b => b.className);
      }, id);
      h.expect(blocked, size.join('x')).toEqual([]);
      // and they work: the colour dot changes the colour
      const c0 = (await h.saved(ctx, d => d.labels.some(l => l.id === id))).labels.find(l => l.id === id).c;
      const dot = await (await el.$('.cb.dot')).boundingBox();
      await page.mouse.click(dot.x + dot.width / 2, dot.y + dot.height / 2);
      await h.saved(ctx, d => d.labels.find(l => l.id === id).c !== c0);
    }
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});
