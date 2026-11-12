// 4. Links in notes (select, link button, bubble opens externally); to-do keyboard behaviour; calendar entries and months.
const { test } = require('@playwright/test');
const h = require('./helpers');

test('sticky note: link on selected words opens in the default browser', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    const id = await h.addOne(page, 'Sticky note'), el = await h.card(page, id);
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('nte'));
    await page.keyboard.type('visit our site');
    await h.selectWord(await el.$('.nte'), 'site');
    await h.cb(el, 'lnk');
    await page.fill('.pop input.lki', 'not a link');
    await page.press('.pop input.lki', 'Enter');
    await h.expect(page.locator('.pop input.lki.bad')).toBeVisible();   // rejected, stays open
    await page.fill('.pop input.lki', 'example.com/menu');
    await page.press('.pop input.lki', 'Enter');
    const d = await h.saved(ctx, d => d.notes[0] && d.notes[0].rt);
    h.expect(d.notes[0].text).toBe('visit our site');
    h.expect(d.notes[0].rt).toEqual([{ t: 'visit our ' }, { t: 'site', u: 'https://example.com/menu' }]);
    await page.mouse.click(30, 600); // leave the note
    await page.locator('#layer .card.note .nte a').click();
    await h.expect(page.locator('.pop .lku')).toHaveText('example.com/menu');
    await page.locator('.pop .lkb .sbtn', { hasText: 'Open' }).click();
    await page.waitForTimeout(300);
    h.expect(await ctx.app.evaluate(() => global.__external)).toEqual(['https://example.com/menu']);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});

test('to-do list keyboard: Enter, Backspace, arrows, tick, ×', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    const id = await h.addOne(page, 'To-do list'), el = await h.card(page, id);
    await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('tdt'));
    await page.keyboard.type('milk'); await page.keyboard.press('Enter');
    await page.keyboard.type('eggs'); await page.keyboard.press('Enter');
    await page.keyboard.type('bread');
    const vals = () => el.$$eval('.tdt', a => a.map(t => t.textContent)); // v2.0: items are rich text (contenteditable)
    h.expect(await vals()).toEqual(['milk', 'eggs', 'bread']);
    // Enter on the last item adds an empty one; Backspace on an empty item deletes it and goes up
    await page.keyboard.press('Enter'); h.expect(await vals()).toEqual(['milk', 'eggs', 'bread', '']);
    await page.keyboard.press('Backspace'); h.expect(await vals()).toEqual(['milk', 'eggs', 'bread']);
    h.expect(await page.evaluate(() => document.activeElement.textContent)).toBe('bread');
    // arrows move between items (up from the start of a line, down from its end)
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowUp');
    h.expect(await page.evaluate(() => document.activeElement.textContent)).toBe('eggs');
    await page.keyboard.press('ArrowDown');
    h.expect(await page.evaluate(() => document.activeElement.textContent)).toBe('bread');
    // tick "milk": strike-through, saved
    await el.$eval('.tdr:nth-child(1) .tdc', c => c.click());
    h.expect(await el.$eval('.tdr:nth-child(1)', r => r.classList.contains('done'))).toBe(true);
    let d = await h.saved(ctx, d => d.notes[0].items[0].d === true && d.notes[0].items.length === 3);
    // × removes "eggs"
    await el.$eval('.tdr:nth-child(2) .tdx', b => b.click());
    d = await h.saved(ctx, d => d.notes[0].items.length === 2);
    h.expect(d.notes[0].items).toEqual([{ t: 'milk', d: true }, { t: 'bread', d: false }]);
    h.expect(d.notes[0].kind).toBe('todo');
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});

test('calendar: day entry (note, emoji, circle), month navigation, back to today', async () => {
  const ctx = h.newBoard(); const page = await h.launch(ctx);
  try {
    const id = await h.addOne(page, 'Calendar'), el = await h.card(page, id);
    const now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const monthName = d => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    h.expect(await el.$eval('.calm', e => e.textContent)).toBe(await page.evaluate(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })));
    h.expect(await el.$eval('.cald.today span', e => +e.textContent)).toBe(now.getDate());
    // tap the 14th
    const day = await el.evaluateHandle(e => [...e.querySelectorAll('.cald')].find(b => b.firstChild.textContent === '14'));
    await day.asElement().click();
    await page.fill('.pop input.lki', 'Dinner at 8');
    await page.locator('.pop .cale button[aria-label="❤️"]').click();
    await page.locator('.pop label.trow', { hasText: 'Circle this day' }).locator('input').click();
    await page.keyboard.press('Escape');
    let d = await h.saved(ctx, d => { const e = d.notes[0].days && d.notes[0].days[ym + '-14']; return e && e.m && e.e; });
    h.expect(d.notes[0].days[ym + '-14']).toEqual({ t: 'Dinner at 8', e: '❤️', m: true });
    h.expect(await el.$eval('.call li', e => e.textContent)).toBe('14 ❤️ Dinner at 8');
    h.expect(await el.evaluate(e => [...e.querySelectorAll('.cald')].find(b => b.firstChild.textContent === '14').classList.contains('circ'))).toBe(true); // the grid is redrawn after each change
    // ‹ › change month; double-clicking the month name jumps back to today
    const cur = await el.$eval('.calm', e => e.textContent);
    await el.$eval('.calnav.nxt', b => b.click()); await el.$eval('.calnav.nxt', b => b.click());
    const later = await el.$eval('.calm', e => e.textContent);
    h.expect(later).not.toBe(cur);
    h.expect(await el.$('.call:not([hidden]) li')).toBeNull();
    d = await h.saved(ctx, d => d.notes[0].ym !== ym);
    // a real double-click on the month name (fixed in the app; the web version misses it because the card captures the pointer)
    await (await el.$('.calm')).dblclick();
    h.expect(await el.$eval('.calm', e => e.textContent)).toBe(cur);
    await h.saved(ctx, d => d.notes[0].ym === ym);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
