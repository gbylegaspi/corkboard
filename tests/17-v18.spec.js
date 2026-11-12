// 17. Version 1.8: the toolbar sits at the top right; sections live in a sidebar opened from the top left, and they can
// hold sub-sections, any depth deep (sections[].parent). Moving them by dragging, folding, themes passed down, deleting
// a section with what's inside it, and tidying boards whose parents don't make sense.
const { test } = require('@playwright/test');
const h = require('./helpers');

const clickMenu = (app, ...labels) => app.evaluate(({ Menu }, ls) => {
  let items = Menu.getApplicationMenu().items, it;
  for (const l of ls) { it = items.find(i => i.label === l); if (!it) return 'missing ' + l; items = it.submenu ? it.submenu.items : []; }
  it.click(); return 'clicked';
}, labels);
const sec = (d, name) => d.sections.find(s => s.name === name);
const rows = page => page.$$eval('#sbTree .sbr', rs => rs.map(r => r.querySelector('.sbn').textContent + '@' + r.getAttribute('aria-level')));

test('toolbar at the top right, sections sidebar at the top left', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    const tb = await page.locator('#lfab').boundingBox(), sb = await page.locator('#sbBtn').boundingBox(), vw = page.viewportSize() || { width: await page.evaluate(() => innerWidth) };
    h.expect(tb.y).toBeLessThan(30); h.expect(Math.abs(tb.x + tb.width - (vw.width - 18))).toBeLessThan(3);
    h.expect(sb.y).toBeLessThan(30); h.expect(sb.x).toBeLessThan(30);
    h.expect(await page.textContent('#sbCur')).toBe('Our memories');
    // opens with the button, closes with Escape; View → Show Sections toggles it; clicking the board closes it
    await h.expect(page.locator('#sb')).not.toHaveClass(/open/);
    await page.click('#sbBtn'); await h.expect(page.locator('#sb')).toHaveClass(/open/);
    await h.expect(page.locator('#sbTree .sbr.on .sbgo')).toBeFocused();
    await page.keyboard.press('Escape'); await h.expect(page.locator('#sb')).not.toHaveClass(/open/);
    h.expect(await clickMenu(ctx.app, 'View', 'Show Sections')).toBe('clicked');
    await h.expect(page.locator('#sb')).toHaveClass(/open/);
    await page.mouse.click(900, 500); await h.expect(page.locator('#sb')).not.toHaveClass(/open/);
    // no more tab row
    h.expect(await page.locator('#tabs').count()).toBe(0);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});

test('sub-sections: add, nest, fold, move, theme, delete', async () => {
  const ctx = h.newBoard({ data: { title: 'T', sections: [{ id: 's1', name: 'Our memories' }, { id: 's2', name: 'Work' }], cur: 's1', theme: 'classic' } });
  const page = await h.launch(ctx);
  try {
    // + on a row makes a section inside it
    await h.openSections(page);
    await h.secRow(page, 'Our memories').hover(); await h.secRow(page, 'Our memories').locator('.sbadd').click();
    await h.expect(page.locator('#sb')).not.toHaveClass(/open/);
    await h.expect(page.locator('#tplT')).toHaveText('New section inside “Our memories”');
    await page.fill('#tplName', 'Japan'); await page.click('#tplOk'); await page.waitForTimeout(600);
    h.expect(await h.curSection(page)).toBe('Japan');
    h.expect(await page.textContent('#secPath')).toBe('Our memories  ›  Japan');
    let d = await h.saved(ctx, d => d.sections.length === 3);
    h.expect(sec(d, 'Japan').parent).toBe('s1');
    // ...and one inside that (a note in it, to check deleting later)
    await h.openSections(page);
    await h.secRow(page, 'Japan').hover(); await h.secRow(page, 'Japan').locator('.sbadd').click();
    await page.fill('#tplName', 'Kyoto'); await page.click('#tplOk'); await page.waitForTimeout(600);
    await h.addOne(page, 'Sticky note');
    d = await h.saved(ctx, d => d.sections.length === 4 && d.notes.length === 1);
    h.expect(sec(d, 'Kyoto').parent).toBe(sec(d, 'Japan').id);
    h.expect(d.notes[0].s).toBe(sec(d, 'Kyoto').id);
    h.expect(await rows(page)).toEqual(['Our memories@1', 'Japan@2', 'Kyoto@3', 'Work@1']);
    await h.openSections(page); // (the counts are brought up to date when it opens)
    h.expect(await page.textContent('#sbTree .sbr.on .sbc')).toBe('1');
    // fold "Our memories": its sub-sections tuck away (and stay tucked away while you're in one of them)
    await h.secRow(page, 'Our memories').locator('.sbcar').click();
    h.expect(await rows(page)).toEqual(['Our memories@1', 'Work@1']);
    h.expect((await h.saved(ctx, d => d.sections[0].fold === true)).sections[0].fold).toBe(true);
    await h.secRow(page, 'Our memories').locator('.sbcar').click();
    h.expect(await rows(page)).toEqual(['Our memories@1', 'Japan@2', 'Kyoto@3', 'Work@1']);
    // keys: up/down move between rows, F2 renames
    await h.secRow(page, 'Kyoto').locator('.sbgo').focus();
    await page.keyboard.press('ArrowDown'); await h.expect(h.secRow(page, 'Work').locator('.sbgo')).toBeFocused();
    await page.keyboard.press('F2'); await page.keyboard.type('Office'); await page.keyboard.press('Enter');
    await h.expect(page.locator('#sb')).toHaveClass(/open/);
    h.expect(await rows(page)).toEqual(['Our memories@1', 'Japan@2', 'Kyoto@3', 'Office@1']);
    // drag "Office" onto the middle of "Japan": it goes inside, at the end
    const japan = h.secRow(page, 'Japan'), jb = await japan.boundingBox();
    await h.secRow(page, 'Office').dragTo(japan, { targetPosition: { x: jb.width / 2, y: jb.height / 2 } });
    h.expect(await rows(page)).toEqual(['Our memories@1', 'Japan@2', 'Kyoto@3', 'Office@3']);
    d = await h.saved(ctx, d => sec(d, 'Office') && sec(d, 'Office').parent === sec(d, 'Japan').id);
    // drag it just above "Our memories": a top-level section again, now first
    const om = h.secRow(page, 'Our memories');
    await h.secRow(page, 'Office').dragTo(om, { targetPosition: { x: 60, y: 3 } });
    h.expect(await rows(page)).toEqual(['Office@1', 'Our memories@1', 'Japan@2', 'Kyoto@3']);
    d = await h.saved(ctx, d => !('parent' in sec(d, 'Office')) && d.sections[0].name === 'Office');
    // a section can't go inside itself (or inside one of its own sub-sections)
    await h.secRow(page, 'Our memories').dragTo(h.secRow(page, 'Kyoto'));
    h.expect(await rows(page)).toEqual(['Office@1', 'Our memories@1', 'Japan@2', 'Kyoto@3']);
    // a theme on "Japan" carries on into "Kyoto", unless Kyoto picks its own
    const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await h.goSection(page, 'Japan');
    await page.click('#gear'); await page.click('#tb-theme');
    await page.locator('#secThm input').click(); await page.locator('#thmList .thm', { hasText: 'Midnight' }).click(); await page.click('#setX');
    h.expect(await theme()).toBe('midnight');
    await h.goSection(page, 'Kyoto'); h.expect(await theme()).toBe('midnight');
    await page.click('#gear'); await page.click('#tb-theme');
    await h.expect(page.locator('#secThm .shint2')).toHaveText('The theme you pick applies to “Japan” and the sections inside it.');
    await page.click('#setX');
    await h.goSection(page, 'Our memories'); h.expect(await theme()).toBe('classic');
    // delete "Japan": Kyoto and its note go with it; you land in the section it was in
    await h.goSection(page, 'Kyoto');
    await h.openSections(page);
    const del = h.secRow(page, 'Japan').locator('.sbdel');
    await h.secRow(page, 'Japan').hover(); await del.click();
    await h.expect(del).toHaveText('Delete it and 1 sub-section?');
    await del.click();
    h.expect(await rows(page)).toEqual(['Office@1', 'Our memories@1']);
    d = await h.saved(ctx, d => d.sections.length === 2);
    h.expect(d.notes).toEqual([]);
    h.expect(d.cur).toBe('s1');
    h.expect(await h.curSection(page)).toBe('Our memories');
    // Settings → Board lists the sections in the same order
    await page.keyboard.press('Escape');
    await page.click('#gear'); await page.click('#tb-board');
    h.expect(await page.$$eval('#secList .snm', a => a.map(e => e.textContent))).toEqual(['Office', 'Our memories']);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});

test('boards with parents that make no sense are tidied, older boards are untouched', async () => {
  const ctx = h.newBoard({ data: { title: 'T', cur: 'c', sections: [
    { id: 'a', name: 'A', parent: 'b' }, { id: 'b', name: 'B', parent: 'a' },    // a loop
    { id: 'c', name: 'C', parent: 'gone' }, { id: 'd', name: 'D', parent: 'd' },  // missing, itself
    { id: 'e', name: 'E', parent: 'c', fold: 'yes' }, { id: 'f', name: 'F' }
  ] } });
  const page = await h.launch(ctx);
  try {
    const r = await rows(page);
    h.expect(r).toHaveLength(6);
    h.expect(r).toContain('C@1'); h.expect(r).toContain('E@2'); h.expect(r).toContain('D@1'); h.expect(r).toContain('F@1');
    // the loop is broken: one of A and B is at the top level, the other inside it
    h.expect([r.includes('A@1') && r.includes('B@2'), r.includes('B@1') && r.includes('A@2')]).toContain(true);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
