// 12. Desktop-only behaviour: menus, board zoom from the menu (no page zoom), recent boards, Show in Finder, About,
// iPhone videos (H.264/HEVC in .mp4/.mov), HEIC import, drag and drop from the OS, single instance, window state.
// macOS only (the HEIC photo and the videos are made with sips and AVFoundation).
const { test } = require('@playwright/test');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const h = require('./helpers'), fx = require('./fixtures');

test.skip(process.platform !== 'darwin', 'makes its media with macOS tools');

const clickMenu = (app, ...labels) => app.evaluate(({ Menu }, ls) => {
  let items = Menu.getApplicationMenu().items, it;
  for (const l of ls) { it = items.find(i => i.label === l && i.visible !== false) || items.find(i => i.label === l); if (!it) return 'missing ' + l; items = it.submenu ? it.submenu.items : []; }
  if (!it.enabled) return 'disabled'; it.click(); return 'clicked';
}, labels);
const pageZoom = app => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getZoomFactor());

test('menus, zoom mapping, recent boards, media, HEIC, drop, single instance, window state', async () => {
  const vids = [['h264', 'mp4'], ['h264', 'mov'], ['hevc', 'mp4'], ['hevc', 'mov']].map(([c, e]) => ({ name: `${c}.${e}`, src: fx.video(c, e) }));
  const files = {}; vids.forEach(v => { files[v.name] = v.src; });
  const ctx = h.newBoard({ name: 'Board A', files, data: { title: 'A', sections: [{ id: 's1', name: 'One' }], cur: 's1', notes: [],
    photos: vids.map((v, i) => ({ id: v.name, file: v.name, kind: 'video', s: 's1', x: .05 + i * .22, y: 200, rot: 0, z: i + 1, ar: 1.78 })) }, seed: false });
  const B = path.join(ctx.tmp, 'Board B'); fs.mkdirSync(B);
  let page = await h.launch(ctx); // a fresh install: the app opens its own board
  try {
    h.expect(await ctx.app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(i => i.label))).toEqual(['Corkboard', 'File', 'Edit', 'View', 'Window', 'Help']);
    // Ctrl + wheel zooms the board out, never the page
    await page.mouse.move(400, 300); await page.keyboard.down('Control'); await page.mouse.wheel(0, 200); await page.keyboard.up('Control');
    h.expect(await pageZoom(ctx.app)).toBe(1);
    await page.click('#zmN');
    // File → Open Board Folder… (the stubbed dialog returns Board A)
    h.expect(await clickMenu(ctx.app, 'File', 'Open Board Folder…')).toBe('clicked');
    await page.waitForSelector('#layer .card.film');

    // iPhone-style videos stream from disk and play
    const vres = await page.evaluate(async () => Promise.all([...document.querySelectorAll('.card.film')].map(async c => {
      const v = c.querySelector('video');
      if (v.readyState < 2) await new Promise(r => { v.addEventListener('loadeddata', r, { once: true }); v.addEventListener('error', r, { once: true }); setTimeout(r, 5000); });
      let played = false; try { await v.play(); await new Promise(r => setTimeout(r, 500)); played = v.currentTime > 0.2; v.pause(); } catch (e) {}
      return { name: decodeURIComponent(v.src.split('/').pop().split('#')[0]), w: v.videoWidth, bad: c.querySelector('.frame').classList.contains('bad'), played, dur: c.querySelector('.dur').textContent };
    })));
    for (const r of vres) h.expect(r, r.name).toMatchObject({ w: 1280, bad: false, played: true, dur: '0:03' });

    // View → zoom is the board's zoom, never the page's
    await clickMenu(ctx.app, 'View', 'Zoom Out'); await page.waitForTimeout(200);
    h.expect(await h.zoomText(page)).toBe('85%');
    await clickMenu(ctx.app, 'View', 'Zoom In'); await clickMenu(ctx.app, 'View', 'Zoom In'); await page.waitForTimeout(200);
    h.expect(await h.zoomText(page)).toBe('100%');
    await clickMenu(ctx.app, 'View', 'Zoom Out'); await clickMenu(ctx.app, 'View', 'Zoom Out'); await clickMenu(ctx.app, 'View', 'Actual Size'); await page.waitForTimeout(200);
    h.expect(await h.zoomText(page)).toBe('100%');
    h.expect(await pageZoom(ctx.app)).toBe(1);
    // Show in Finder, About
    await clickMenu(ctx.app, 'File', 'Show Board Folder in Finder');
    h.expect(await ctx.app.evaluate(() => global.__openedPaths)).toEqual([fs.realpathSync(ctx.board)]);
    await clickMenu(ctx.app, 'Help', 'About Corkboard');
    const about = (await ctx.app.evaluate(() => global.__boxes))[0].detail;
    h.expect(about).toContain("Version " + require("../package.json").version); h.expect(about).toMatch(/Apache/); h.expect(about).toMatch(/LGPL/);

    // HEIC: converted to JPEG, the original kept next to it, both deleted together
    await page.setInputFiles('#file', fx.heic());
    await h.expect(page.locator('#ask')).toBeVisible({ timeout: 30000 });
    await page.click('#ask .opt[data-m="original"]'); await h.expect(page.locator('#fx')).toBeVisible(); await page.click('#fxOk');
    await page.waitForFunction(() => document.querySelectorAll('#layer .card:not(.film)').length === 1, null, { timeout: 30000 });
    await page.waitForFunction(() => { const i = document.querySelector('#layer .card:not(.film) img'); return i && i.naturalWidth > 0; });
    h.expect(await page.$eval('#layer .card:not(.film) img', i => [i.naturalWidth, i.naturalHeight])).toEqual([480, 640]);
    let extra = h.list(ctx, 'photos').filter(f => !files[f]);
    h.expect(extra.map(f => path.extname(f)).sort()).toEqual(['.heic', '.jpg']);
    const d = await h.saved(ctx, d => d.photos.length === 5);
    const hp = d.photos.find(p => !p.kind || p.kind === 'photo');
    h.expect(hp.file).toMatch(/\.jpg$/); h.expect(hp.ar).toBeCloseTo(0.75, 2);
    const hc = await page.$('#layer .card:not(.film)');
    await h.cb(hc, 'del'); await h.cb(hc, 'del'); await page.waitForTimeout(900);
    h.expect(h.list(ctx, 'photos').filter(f => !files[f])).toEqual([]);

    // drop from the OS: the same flow as "+ Add"; unsupported files are ignored
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(1200, 900); c.getContext('2d').fillRect(0, 0, 1200, 900);
      const dt = new DataTransfer();
      dt.items.add(new File([await c.convertToBlob({ type: 'image/png' })], 'dropped.png', { type: 'image/png' }));
      dt.items.add(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
      const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 500, clientY: 400 }, b = document.getElementById('board');
      b.dispatchEvent(new DragEvent('dragover', o)); b.dispatchEvent(new DragEvent('drop', o));
    });
    await h.expect(page.locator('#ask')).toBeVisible();
    h.expect(await page.textContent('#askT')).toBe('How should this photo look?');
    await page.click('#ask .opt[data-m="square"]'); await h.expect(page.locator('#fx')).toBeVisible(); await page.click('#fxOk');
    await page.waitForFunction(() => document.querySelectorAll('#layer .card:not(.film)').length === 1);

    // Recent Boards
    await ctx.app.evaluate((x, dir) => { global.__dlg = dir; }, B);
    await clickMenu(ctx.app, 'File', 'Open Board Folder…'); await page.waitForTimeout(1500);
    h.expect(await page.locator('#layer .card').count()).toBe(0);
    const rec = await ctx.app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(i => i.label === 'File').submenu.items.find(i => i.label === 'Recent Boards').submenu.items.map(i => i.label));
    h.expect(rec.filter(l => /^(Board [AB]|My Board) /.test(l))).toHaveLength(3);
    await ctx.app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find(i => i.label === 'File').submenu.items.find(i => i.label === 'Recent Boards').submenu.items.find(i => /^Board A/.test(i.label)).click());
    await page.waitForSelector('#layer .card.film');
    h.expect(await page.locator('#layer .card').count()).toBe(5);

    // window state, then single instance
    await ctx.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 140, y: 120, width: 1000, height: 700 }));
    await page.waitForTimeout(800);
    const cmd = h.appCommand(), second = cp.spawnSync(cmd.executablePath || require('electron'), cmd.args, { env: { ...process.env, CORK_USER_DATA: ctx.userData }, timeout: 20000 });
    h.expect(second.status).toBe(0);
    h.expect(await ctx.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await h.close(ctx);
    page = await h.launch(ctx);
    h.expect(await ctx.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())).toEqual({ x: 140, y: 120, width: 1000, height: 700 });
    h.expect(await page.textContent('#title')).toBe(await h.curSection(page)); // (board A is open again; the title is its section's name)
    h.expect(h.readBoard(ctx).title).toBe('A');
    h.expect(ctx.errors).toEqual([]);
  } finally { await h.close(ctx); }
});
