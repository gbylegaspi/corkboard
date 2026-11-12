// 1. Old boards and images: a v1.1.5-style board opens; 24 MP photos use display copies and thumbs/ is created.
const { test } = require('@playwright/test');
const h = require('./helpers'), fx = require('./fixtures');

test('v1.1.5 board opens, big photos use display copies', async () => {
  const ctx = h.newBoard({
    files: { 'old-a.png': fx.photoSmall(0), 's1.png': fx.photoSmall(1), 's2.png': fx.photoSmall(2), 's3.png': fx.photoSmall(3), 's4.png': fx.photoSmall(4) },
    // the shape v1.1.5 saved: photos without "kind", a strip, a note, two sections, no labels/pins/templates
    data: { title: 'Us', sections: [{ id: 's1', name: 'Our memories' }, { id: 'sx', name: 'Summer' }], cur: 's1', sound: true, volume: .5, theme: 'classic',
      photos: [{ id: 'old-a.png', file: 'old-a.png', s: 's1', x: .08, y: 210, rot: -3, z: 2, caption: 'first one', mode: 'square' },
               { id: 'bOld', kind: 'strip', files: ['s1.png', 's2.png', 's3.png', 's4.png'], s: 's1', x: .45, y: 200, rot: 2, z: 3, caption: 'booth' }],
      notes: [{ id: 'nOld', s: 's1', x: .7, y: 230, rot: 1, z: 4, c: '#fff2a8', text: 'remember this' }], keys: true }
  });
  const page = await h.launch(ctx);
  try {
    await h.expect(page.locator('#title')).toHaveText('Our memories'); // v2.0: the big title is the section's name
    await h.expect(page.locator('#sbTree .sbn')).toHaveText(['Our memories', 'Summer']);
    const c = await h.cards(page);
    h.expect(c.map(x => x.id).sort()).toEqual(['bOld', 'nOld', 'old-a.png']);
    await h.expect(page.locator('.card.strip .sf img')).toHaveCount(4);
    await page.waitForFunction(() => [...document.querySelectorAll('.card.strip .sf img')].every(i => i.complete && i.naturalWidth > 0));
    await h.expect(page.locator('.card.note .nte')).toHaveText('remember this');
    await h.expect(page.locator('.card:not(.strip):not(.note) input.cap')).toHaveValue('first one');

    // four 24 MP photos as a photobooth strip (the strip picker skips the "how should these look" question)
    let before = await h.cards(page);
    await page.setInputFiles('#stripFile', [0, 1, 2, 3].map(fx.photo24));
    await h.expect(page.locator('#fx')).toBeVisible({ timeout: 60000 });
    await page.click('#fxOk');
    await page.waitForFunction(n => document.querySelectorAll('#layer .card').length === n, before.length + 1, { timeout: 60000 });
    const stripId = await h.newCardId(page, before);
    // one large photo with a filter
    before = await h.cards(page);
    await page.setInputFiles('#file', fx.photo24(4));
    await h.expect(page.locator('#ask')).toBeVisible();
    await page.click('#ask .opt[data-m="square"]');
    await h.expect(page.locator('#fx')).toBeVisible({ timeout: 60000 });
    await page.locator('#fxPs .fxp', { hasText: 'Vintage' }).click();
    await page.click('#fxOk');
    await page.waitForFunction(n => document.querySelectorAll('#layer .card').length === n, before.length + 1, { timeout: 60000 });
    const photoId = await h.newCardId(page, before);

    // cards show display copies (at most 1600 px), never the 6000 px originals
    await page.waitForFunction(ids => ids.every(id => { const c = [...document.querySelectorAll('#layer .card')].find(e => e._p.id === id);
      return c && [...c.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0); }), [stripId, photoId], { timeout: 90000 });
    const widths = await page.evaluate(ids => ids.map(id => [...[...document.querySelectorAll('#layer .card')].find(e => e._p.id === id).querySelectorAll('img')]
      .map(i => Math.max(i.naturalWidth, i.naturalHeight))), [stripId, photoId]);
    for (const w of widths.flat()) h.expect(w).toBeLessThanOrEqual(1600);
    const d = await h.saved(ctx, d => d.photos.length === 4);
    const ph = d.photos.find(p => p.id === photoId), st = d.photos.find(p => p.id === stripId);
    h.expect(ph.f && ph.f.p).toBe('vintage');
    h.expect(st.kind).toBe('strip'); h.expect(st.files).toHaveLength(4);
    h.expect(d.photos.find(p => p.id === 'old-a.png').s).toBe('s1');
    h.expect(d.keys).toBeUndefined(); // old typing-sound setting is dropped, as in the web version
    const thumbs = h.list(ctx, 'thumbs');
    for (const n of st.files.concat(ph.file)) h.expect(thumbs).toContain(n + '@640.webp');
    // originals copied unchanged
    const fs = require('fs'), path = require('path');
    h.expect(fs.statSync(path.join(ctx.board, 'photos', ph.file)).size).toBe(fs.statSync(fx.photo24(4)).size);
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
