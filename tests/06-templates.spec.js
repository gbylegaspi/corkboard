// 6. Templates: sections from Date ideas and Week planner; save a section as a template, rename it, use it, delete it.
const { test } = require('@playwright/test');
const h = require('./helpers');

const kinds = cs => {
  const o = {};
  cs.forEach(c => {
    const k = /\bidx\b/.test(c.cls)
      ? 'idx'
      : /\btodo\b/.test(c.cls)
        ? 'todo'
        : /\blabel\b/.test(c.cls)
          ? 'label'
          : /\bcal\b/.test(c.cls)
            ? 'cal'
            : /\bnote\b/.test(c.cls)
              ? 'note'
              : 'other';
    o[k] = (o[k] || 0) + 1;
  });
  return o;
};

test('built-in and own templates', async () => {
  const ctx = h.newBoard();
  const page = await h.launch(ctx);
  try {
    const curTab = () => h.curSection(page);
    // Date ideas: a pile of 6 idea cards, 2 labels, a to-do list and a note
    await h.newSection(page);
    await h.expect(page.locator('#tpl')).toBeVisible();
    await page.locator('#tplG .tplt', { hasText: 'Date ideas' }).click();
    h.expect(await page.getAttribute('#tplName', 'placeholder')).toBe('Date ideas');
    await page.click('#tplOk');
    await h.expect(page.locator('#tpl')).toBeHidden();
    await page.waitForTimeout(900);
    h.expect(await curTab()).toBe('Date ideas');
    let cs = await h.cards(page);
    h.expect(kinds(cs)).toEqual({ label: 2, idx: 6, todo: 1, note: 1 });
    h.expect(await page.locator('.card.idx.ptop .pcount').textContent()).toBe('6 cards');
    // Week planner, created straight away by double-clicking its tile, with a name of her own
    await h.newSection(page);
    await page.fill('#tplName', 'This week');
    await page.locator('#tplG .tplt', { hasText: 'Week planner' }).dblclick();
    await page.waitForTimeout(900);
    h.expect(await curTab()).toBe('This week');
    cs = await h.cards(page);
    h.expect(kinds(cs)).toEqual({ label: 2, idx: 7, todo: 1 });
    h.expect(await page.$$eval('.card.idx .ixe', a => a.map(e => e.textContent.trim()))).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ]);
    // change something, then save this section as her own template (from Settings → Board → Templates…)
    const mon = (await h.cards(page)).find(c => /idx/.test(c.cls)).id;
    await (await (await h.card(page, mon)).$('.ixe')).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' gym');
    await page.mouse.click(20, 700);
    await page.click('#gear');
    await page.click('#tb-board');
    await page.click('#tplBtn');
    await h.expect(page.locator('#tpl')).toBeVisible();
    await page.click('#tplSave');
    await h.expect(page.locator('#tplM .tplw')).toHaveCount(1);
    let d = await h.saved(ctx, d => d.templates.length === 1);
    h.expect(d.templates[0].name).toBe('This week');
    h.expect(d.templates[0].items).toHaveLength(10);
    // rename ✎
    await page.click('#tplM .tplx.rn');
    await page.fill('#tplM input.tplri', 'Our week');
    await page.press('#tplM input.tplri', 'Enter');
    await h.expect(page.locator('#tplM .tplt b')).toHaveText('Our week');
    await h.saved(ctx, d => d.templates[0].name === 'Our week');
    // a new section from it: same contents, including the edited card
    await page.locator('#tplM .tplt').click();
    await page.click('#tplOk');
    await page.waitForTimeout(900);
    h.expect(await curTab()).toBe('Our week');
    h.expect(kinds(await h.cards(page))).toEqual({ label: 2, idx: 7, todo: 1 });
    h.expect(await page.$$eval('.card.idx .ixe', a => a.map(e => e.textContent.trim()))).toContain('Monday gym');
    // delete it (two taps)
    await h.newSection(page);
    await page.click('#tplM .tplx:not(.rn)');
    await h.expect(page.locator('#tplM .tplx:not(.rn)')).toHaveText('Delete?');
    await page.click('#tplM .tplx:not(.rn)');
    await h.expect(page.locator('#tplM .tplw')).toHaveCount(0);
    await page.click('#tplNo');
    d = await h.saved(ctx, d => d.templates.length === 0);
    h.expect(d.sections.map(s => s.name)).toEqual(['Our memories', 'Date ideas', 'This week', 'Our week']);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});
