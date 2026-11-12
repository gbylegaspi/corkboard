// 18. Version 2.0: the title is the section's name; the same layout on any screen (bw + page scaling); controls above
// the yarn and card buttons clear of it; index card lines scroll with the text; bold / italics in to-do lists;
// "cards lift" and spelling settings; quiet caption hints; real pins instead of drawn ones; polaroid and strip stacks;
// calendar looks; video playback settings.
const { test } = require('@playwright/test');
const h = require('./helpers');
const fx = require('./fixtures');

const clickMenu = (app, ...labels) => app.evaluate(({ Menu }, ls) => {
  let items = Menu.getApplicationMenu().items, it;
  for (const l of ls) { it = items.find(i => i.label === l); if (!it) return 'missing ' + l; items = it.submenu ? it.submenu.items : []; }
  it.click(); return 'clicked';
}, labels);
const note = (d, id) => d.notes.find(n => n.id === id);
const photo = (d, id) => d.photos.find(n => n.id === id);
const zoomFactor = app => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor());
const topAt = (page, x, y) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && (e.closest('[id]') || e).id + '|' + (e.className.baseVal ?? e.className); }, [x, y]);

test('title, layout width, controls above the yarn, settings, captions', async () => {
  const ctx = h.newBoard({ files: { 'p.png': fx.photoSmall(3) }, data: { title: 'Old title', cur: 's1', sections: [{ id: 's1', name: 'Trips' }],
    photos: [{ id: 'p.png', file: 'p.png', kind: 'photo', s: 's1', x: .1, y: 230, rot: 0, z: 1, mode: 'square', caption: '' }],
    notes: [{ id: 'n', s: 's1', x: .45, y: 240, rot: 4, z: 2, c: '#cdeed6', text: 'note' }] } });
  const page = await h.launch(ctx);
  try {
    // the big title is the section's name; typing there renames the section
    await h.expect(page.locator('#title')).toHaveText('Trips');
    await page.click('#title'); await page.keyboard.press('Meta+A'); await page.keyboard.type('Japan'); await page.keyboard.press('Enter');
    let d = await h.saved(ctx, d => d.sections[0].name === 'Japan');
    h.expect(d.title).toBe('Old title');
    h.expect(await h.curSection(page)).toBe('Japan');
    // the layout width is set from the window the first time, and the page scales when the window changes size
    const W = await page.evaluate(() => innerWidth);
    d = await h.saved(ctx, d => d.bw === W);
    h.expect(await zoomFactor(ctx.app)).toBeCloseTo(1, 3);
    const nx = await (await h.card(page, 'n')).evaluate(e => e.offsetLeft / document.getElementById('board').clientWidth);
    await ctx.app.evaluate(({ BrowserWindow }, w) => { const b = BrowserWindow.getAllWindows()[0]; b.setContentSize(Math.round(w * .8), 700); }, W);
    await page.waitForTimeout(700);
    h.expect(await zoomFactor(ctx.app)).toBeCloseTo(.8, 2);
    h.expect(await page.evaluate(() => innerWidth)).toBeGreaterThan(W - 3);   // the page is still laid out at the same width
    h.expect(Math.abs(await (await h.card(page, 'n')).evaluate(e => e.offsetLeft / document.getElementById('board').clientWidth) - nx)).toBeLessThan(.002);
    await ctx.app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setContentSize(w, 800), W);
    await page.waitForTimeout(700);
    h.expect(await zoomFactor(ctx.app)).toBeCloseTo(1, 3);
    // v2.0.1: a polaroid has no pin at all (none drawn, none made)
    h.expect(h.readBoard(ctx).pins).toEqual([]);
    h.expect(await (await h.card(page, 'p.png')).$eval('.pin', e => getComputedStyle(e).display)).toBe('none');
    // the toolbars sit above the pins and yarn
    h.expect(await page.evaluate(() => +getComputedStyle(document.getElementById('lfab')).zIndex > +getComputedStyle(document.getElementById('yarn')).zIndex)).toBe(true);
    h.expect(await page.evaluate(() => +getComputedStyle(document.getElementById('sbBtn')).zIndex > +getComputedStyle(document.getElementById('yarn')).zIndex)).toBe(true);
    // a pin stuck right on a card's delete button: hovering the card cuts it out, so the button gets the click
    const nel = await h.card(page, 'n'), del = await h.buttonBox(page, nel, 'del');
    await page.click('#yarnBtn'); await page.mouse.click(del.x + del.width / 2, del.y + del.height / 2); await page.click('#yDone');
    await h.saved(ctx, d => d.pins.length === 1);
    await page.mouse.move(640, 5); await page.waitForTimeout(300);
    h.expect(await topAt(page, del.x + del.width / 2, del.y + del.height / 2)).toContain('phd');     // not hovered: the pin
    await nel.hover({ position: { x: 20, y: 60 } }); await page.waitForTimeout(500);
    const del2 = await (await nel.$('.cb.del')).boundingBox();
    h.expect(await topAt(page, del2.x + del2.width / 2, del2.y + del2.height / 2)).toContain('del'); // hovered: the button
    // settings: cards lift (on by default), spelling (on by default)
    await page.mouse.move(640, 5);
    h.expect(await nel.$eval('.nte', e => e.spellcheck)).toBe(true);
    await page.click('#gear');
    h.expect(await page.isChecked('#hoverOn')).toBe(true); h.expect(await page.isChecked('#spellOn')).toBe(true);
    await page.click('#hoverOn'); await page.click('#spellOn'); await page.click('#setX');
    d = await h.saved(ctx, d => d.hover === false && d.spell === false);
    h.expect(await nel.$eval('.nte', e => e.spellcheck)).toBe(false);
    await nel.hover({ position: { x: 20, y: 60 } }); await page.waitForTimeout(500);
    h.expect(await nel.evaluate(e => getComputedStyle(e).scale)).toBe('1');
    h.expect(await nel.evaluate(e => getComputedStyle(e).rotate)).toBe('4deg');
    // "add a caption" only shows while pointing at the card
    const pel = await h.card(page, 'p.png');
    await page.mouse.move(640, 5); await page.waitForTimeout(300);
    h.expect(await pel.$eval('input.cap', e => getComputedStyle(e, '::placeholder').color)).toBe('rgba(0, 0, 0, 0)');
    await pel.hover(); await page.waitForTimeout(300);
    h.expect(await pel.$eval('input.cap', e => getComputedStyle(e, '::placeholder').color)).not.toBe('rgba(0, 0, 0, 0)');
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});

test('text: index card lines scroll with it, bold and italics in to-do lists', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    const iid = await h.addOne(page, 'Index card'), iel = await h.card(page, iid);
    h.expect(await iel.$eval('.ixe', e => getComputedStyle(e).backgroundAttachment)).toBe('local');
    h.expect(await iel.evaluate(e => getComputedStyle(e).backgroundImage)).not.toContain('repeating');
    // a to-do item: ⌘B / ⌘I (Edit menu) on a word
    const tid = await h.addOne(page, 'To-do list'), tel = await h.card(page, tid);
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('tdt'));
    await page.keyboard.type('buy fresh bread'); await page.keyboard.press('Enter'); await page.keyboard.type('call mum');
    await h.selectWord(await tel.$('.tdr:nth-child(1) .tdt'), 'fresh'); await clickMenu(ctx.app, 'Edit', 'Bold');
    await tel.waitForSelector('.tdr:nth-child(1) .tdt b');
    await h.selectWord(await tel.$('.tdr:nth-child(2) .tdt'), 'mum'); await clickMenu(ctx.app, 'Edit', 'Italic');
    let d = await h.saved(ctx, d => note(d, tid).items.length === 2 && note(d, tid).items[1].rt);
    h.expect(note(d, tid).items[0]).toEqual({ t: 'buy fresh bread', d: false, rt: [{ t: 'buy ' }, { t: 'fresh', b: true }, { t: ' bread' }] });
    h.expect(note(d, tid).items[1]).toEqual({ t: 'call mum', d: false, rt: [{ t: 'call ' }, { t: 'mum', i: true }] });
    // reopen: still bold / italic
    await h.close(ctx); const p2 = await h.launch(ctx);
    h.expect(await (await h.card(p2, tid)).$eval('.tdr:nth-child(1) .tdt b', e => e.textContent)).toBe('fresh');
    h.expect(await (await h.card(p2, tid)).$eval('.tdr:nth-child(2) .tdt i', e => e.textContent)).toBe('mum');
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});

test('no pins on polaroids, tilt them, polaroid stacks, calendar looks', async () => {
  // a board saved by 2.0: each polaroid got a pin (fx: still in its first spot); a has yarn to a board pin, b has a pin she stuck in
  const ctx = h.newBoard({ files: { 'a.png': fx.photoSmall(1), 'b.png': fx.photoSmall(2) }, data: { title: 'T', cur: 's1', sections: [{ id: 's1', name: 'One' }],
    photos: [{ id: 'a.png', file: 'a.png', kind: 'photo', s: 's1', x: .05, y: 240, rot: 0, z: 1, mode: 'square', pn: 1 },
             { id: 'b.png', file: 'b.png', kind: 'photo', s: 's1', x: .5, y: 260, rot: 0, z: 2, mode: 'square', pn: 1 }],
    pins: [{ id: 'q1', c: '#d6264f', card: 'a.png', fx: .5, ox: 110, oy: 0 }, { id: 'q2', c: '#d6264f', card: 'b.png', fx: .5, ox: 110, oy: 0 },
           { id: 'q3', c: '#2f6fd6', card: 'b.png', ox: 60, oy: 80 }, { id: 'q4', c: '#2f6fd6', s: 's1', x: .8, y: 600 }],
    yarns: [{ id: 'y1', a: 'q1', b: 'q4', c: '#2f6fd6' }, { id: 'y2', a: 'q3', b: 'q4', c: '#2f6fd6' }] } });
  let page = await h.launch(ctx);
  try {
    // v2.0.1: the pins 2.0 made (and the yarn tied to them) are gone; hers stay
    let d = await h.saved(ctx, d => d.pins.length === 2);
    h.expect(d.pins.map(q => q.id)).toEqual(['q3', 'q4']);
    h.expect(d.yarns.map(y => y.id)).toEqual(['y2']);
    // tilt a polaroid with its handle; double-click straightens it
    await page.mouse.move(640, 5); await page.waitForTimeout(300);
    const ael = await h.card(page, 'a.png'), box = await ael.boundingBox(), rot = await h.buttonBox(page, ael, 'rot');
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2, p0 = { x: rot.x + rot.width / 2, y: rot.y + rot.height / 2 };
    const ang = Math.atan2(p0.y - cy, p0.x - cx) + 0.4, r = Math.hypot(p0.x - cx, p0.y - cy);
    await h.drag(page, p0, { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
    d = await h.saved(ctx, d => Math.abs(photo(d, 'a.png').rot) > 12);
    const rot2 = await h.buttonBox(page, ael, 'rot');
    await page.mouse.dblclick(rot2.x + rot2.width / 2, rot2.y + rot2.height / 2);
    await h.saved(ctx, d => photo(d, 'a.png').rot === 0);
    await page.mouse.move(640, 5); await page.waitForTimeout(400);
    // drop polaroid a onto polaroid b: a stack of 2
    await h.settle(page);
    const a = await (await h.card(page, 'a.png')).boundingBox(), b = await (await h.card(page, 'b.png')).boundingBox();
    await h.drag(page, { x: a.x + a.width / 2, y: a.y + 10 }, { x: b.x + b.width / 2, y: b.y + b.height / 2 - a.height / 2 + 10 }, { after: 700 });
    d = await h.saved(ctx, d => photo(d, 'a.png').pile && photo(d, 'a.png').pile === photo(d, 'b.png').pile);
    h.expect(await page.locator('#layer .card.ptop .pcount').textContent()).toBe('2 cards');
    // spread out and unstack for good
    const top = page.locator('#layer .card.ptop'); await top.hover({ position: { x: 14, y: 14 } }); await page.waitForTimeout(450); // (clear of the yarn across it)
    await top.locator('.cb.pspread').click(); await page.locator('.pop .pi', { hasText: 'Unstack for good' }).click();
    d = await h.saved(ctx, d => !photo(d, 'a.png').pile && !photo(d, 'b.png').pile);
    // calendar looks: week, tear-off day, mini, wide, month
    const cid = await h.addOne(page, 'Calendar'), cel = await h.card(page, cid);
    await page.mouse.move(640, 5);
    const pick = async name => { await cel.hover(); await page.waitForTimeout(450); await (await cel.$('.cb.clook')).click(); await page.locator('.pop .pi', { hasText: new RegExp('^' + name + '$') }).click(); await page.waitForTimeout(300); };
    h.expect(await cel.$$eval('.rze', a => a.length)).toBe(0);                    // no more stretching
    await pick('Week'); h.expect(await cel.$$eval('.calwd', a => a.length)).toBe(7);
    h.expect((await h.saved(ctx, d => note(d, cid).look === 'week')).notes.length).toBe(1);
    await cel.hover(); await page.waitForTimeout(450); await (await cel.$('.calnav.nxt')).click();
    d = await h.saved(ctx, d => !!note(d, cid).dy);
    await pick('Tear-off day'); h.expect(await cel.$$eval('.calpage .cpn', a => a.length)).toBe(1);
    await pick('Mini month'); h.expect(await cel.evaluate(e => e.classList.contains('cl-mini'))).toBe(true);
    await pick('Wide month'); h.expect(await cel.evaluate(e => e.offsetWidth)).toBeGreaterThan(370);
    await pick('Month'); d = await h.saved(ctx, d => !('look' in note(d, cid)));
    h.expect(note(d, cid).hs).toBeUndefined();
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});

test('videos: always / when pointed at / only with play, with or without sound', async () => {
  const ctx = h.newBoard({ files: { 'v.mp4': fx.video('h264', 'mp4') }, data: { title: 'T', cur: 's1', sections: [{ id: 's1', name: 'One' }],
    photos: [{ id: 'v.mp4', file: 'v.mp4', kind: 'video', s: 's1', x: .3, y: 260, rot: 0, z: 1, ar: 1.78 }] } });
  const page = await h.launch(ctx);
  try {
    const vel = await h.card(page, 'v.mp4'), state = () => vel.$eval('video', v => ({ paused: v.paused, muted: v.muted }));
    await page.mouse.move(640, 5); await page.waitForTimeout(300);
    h.expect((await state()).paused).toBe(true);                       // default: plays while pointed at, silent
    await vel.hover(); await page.waitForTimeout(400);
    h.expect(await state()).toEqual({ paused: false, muted: true });
    await page.mouse.move(640, 5); await page.waitForTimeout(300);
    h.expect((await state()).paused).toBe(true);
    // Settings → Videos: always, with sound
    await page.click('#gear'); await page.selectOption('#vidPlay', 'always'); await page.click('#vidSnd'); await page.click('#setX');
    let d = await h.saved(ctx, d => d.video && d.video.play === 'always' && d.video.sound === true);
    await page.waitForTimeout(400);
    h.expect(await state()).toEqual({ paused: false, muted: false });
    // this video only: only when its play button is pressed, no sound
    await vel.hover(); await page.waitForTimeout(450); await (await vel.$('.cb.vopt')).click();
    await page.locator('.pop .pi', { hasText: 'Only when you press play' }).click();
    await vel.hover(); await page.waitForTimeout(450); await (await vel.$('.cb.vopt')).click();
    await page.locator('.pop .pi', { hasText: /^Off$/ }).click();
    d = await h.saved(ctx, d => photo(d, 'v.mp4').play === 'click' && photo(d, 'v.mp4').snd === false);
    h.expect((await state()).paused).toBe(true);
    await vel.hover(); await page.waitForTimeout(450);
    h.expect((await state()).paused).toBe(true);                       // pointing doesn't start it
    await (await vel.$('.cb.vplay')).click(); await page.waitForTimeout(300);
    h.expect(await state()).toEqual({ paused: false, muted: true });
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
