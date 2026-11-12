// 11. Round trip: a board saved by the app opens in the web version (corkboard v1.6.3.html and v1.6.2.html, in Chromium),
// and a board then saved by the web version opens back in the app.
// Playwright's own Chromium isn't installed here, so the web file runs in a bare Electron window (also Chromium);
// the board is copied into the browser's private file system (OPFS), whose folder handle stands in for the folder picker.
const { test, _electron: electron } = require('@playwright/test');
const fs = require('fs'),
  path = require('path');
const h = require('./helpers'),
  fx = require('./fixtures');

function filesOf(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, base), { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...filesOf(dir, rel));
    else if (!e.name.startsWith('.')) out.push({ rel, b64: fs.readFileSync(path.join(dir, rel)).toString('base64') });
  }
  return out;
}
// what's on the board, per section (shelf excluded): how many cards of each kind
function expected(d) {
  const o = {};
  for (const s of d.sections)
    o[s.name] =
      d.photos.filter(p => p.s === s.id).length +
      d.notes.filter(n => n.s === s.id).length +
      d.labels.filter(l => l.s === s.id).length;
  return o;
}

async function openInWeb(file, boardDir, tmp) {
  const app = await electron.launch({
    args: [path.join(__dirname, 'web-host')],
    env: {
      ...process.env,
      WEB_FILE: file,
      WEB_USER_DATA: path.join(tmp, 'web-profile-' + path.basename(file).replace(/\W/g, ''))
    }
  });
  const page = await app.firstWindow(),
    errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForSelector('#btns .btn');
  await page.evaluate(async files => {
    const root = await navigator.storage.getDirectory(),
      d = await root.getDirectoryHandle('board-' + Date.now(), { create: true });
    for (const f of files) {
      const parts = f.rel.split('/');
      let dir = d;
      for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
      const w = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable();
      await w.write(Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)));
      await w.close();
    }
    window.__board = d;
    window.showDirectoryPicker = async () => d;
  }, filesOf(boardDir));
  await page.click('#btns .btn:last-child');
  await page.waitForSelector('#lfab', { state: 'visible' });
  await page.waitForTimeout(1500);
  return { app, page, errors };
}
// read the whole board folder back out of OPFS onto disk
async function saveOut(page, dir) {
  const files = await page.evaluate(async () => {
    const out = [];
    async function walk(d, base) {
      for await (const [n, hd] of d.entries()) {
        const rel = base ? base + '/' + n : n;
        if (hd.kind === 'directory') await walk(hd, rel);
        else {
          const b = new Uint8Array(await (await hd.getFile()).arrayBuffer());
          let s = '';
          for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
          out.push({ rel, b64: btoa(s) });
        }
      }
    }
    await walk(window.__board, '');
    return out;
  });
  for (const f of files) {
    const p = path.join(dir, f.rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(f.b64, 'base64'));
  }
}

test('a board saved by the app opens in the web version, and back', async () => {
  const ctx = h.newBoard();
  let page = await h.launch(ctx);
  try {
    // a varied board, made in the app
    await h.addPhotos(page, fx.photoSmall(0), 'square', 'Vintage');
    await page.setInputFiles('#stripFile', [1, 2, 3, 4].map(fx.photoSmall));
    await h.expect(page.locator('#fx')).toBeVisible();
    await page.click('#fxOk');
    await page.waitForSelector('#layer .card.strip');
    await page.setInputFiles('#stkFile', fx.sticker());
    await page.waitForSelector('#layer .card.sticker');
    await page.setInputFiles('#file', fx.pdf5());
    await page.waitForSelector('#layer .card.doc');
    const nid = await h.addOne(page, 'Sticky note');
    await page.keyboard.type('see the map');
    await h.selectWord(await (await h.card(page, nid)).$('.nte'), 'map');
    await h.cb(await h.card(page, nid), 'lnk');
    await page.fill('.pop input.lki', 'example.com/map');
    await page.press('.pop input.lki', 'Enter');
    await page.mouse.click(20, 700);
    await h.addOne(page, 'Label');
    await page.keyboard.type('summer');
    await page.keyboard.press('Enter');
    // pins and yarn: photo → board
    const pb = await (await h.card(page, (await h.cards(page))[0].id)).boundingBox();
    await page.click('#yarnBtn');
    await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await page.mouse.click(1100, 650);
    await h.drag(page, { x: pb.x + pb.width / 2, y: pb.y + pb.height / 2 }, { x: 1100, y: 650 });
    await page.click('#yDone');
    // a second section from a template (index card pile, to-do list, calendar-free)
    await h.newSection(page);
    await page.locator('#tplG .tplt', { hasText: 'Date ideas' }).click();
    await page.click('#tplOk');
    await page.waitForTimeout(800);
    await page.click('#gear');
    await page.click('#tb-theme');
    await page.locator('#thmList .thm', { hasText: 'Blush' }).click();
    await page.click('#setX');
    const appSaved = await h.saved(ctx, d => d.theme === 'blush' && d.yarns.length === 1 && d.sections.length === 2);
    await page.waitForTimeout(2000); // let the display copies finish
    await h.close(ctx);
    const want = expected(appSaved);

    for (const webFile of ['corkboard v1.6.3.html', 'corkboard v1.6.2.html']) {
      const w = await openInWeb(path.join(h.APP, webFile), ctx.board, ctx.tmp);
      try {
        const p = w.page,
          got = {};
        for (const s of appSaved.sections) {
          await p.locator('#tabs .tab', { hasText: s.name }).first().click();
          await p.waitForTimeout(900);
          got[s.name] = await p.locator('#layer .card').count();
        }
        h.expect(got, webFile).toEqual(want);
        // first section again: photos, strip and sticker show; the PDF renders; the link and the pins are there
        await p.locator('#tabs .tab', { hasText: appSaved.sections[0].name }).first().click();
        await p.waitForTimeout(1500);
        await p.waitForFunction(
          () => [...document.querySelectorAll('#layer .card img')].every(i => i.complete && i.naturalWidth > 0),
          null,
          { timeout: 30000 }
        );
        await p.waitForFunction(
          () => {
            const g = document.querySelector('.card.doc .pg');
            return g && !g.classList.contains('ld');
          },
          null,
          { timeout: 30000 }
        );
        h.expect(await p.$eval('.card.doc .pg', g => g.classList.contains('bad')), webFile).toBe(false);
        h.expect(await p.$eval('.card.note .nte a', a => a.getAttribute('href'))).toBe('https://example.com/map');
        // 2 pins of her own, plus (v2.0) the real pin each polaroid in section 1 now has instead of a drawn one
        const own = appSaved.pins.filter(q =>
          q.card
            ? appSaved.photos.concat(appSaved.notes).some(o => o.id === q.card && o.s === appSaved.sections[0].id)
            : q.s === appSaved.sections[0].id
        ).length;
        h.expect(await p.$$eval('#yarn .ypin', g => g.filter(x => x.style.display !== 'none').length)).toBe(own);
        h.expect(await p.$$eval('#yarn .yn', g => g.filter(x => x.style.display !== 'none').length)).toBe(1);
        h.expect(await p.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('blush');
        h.expect(await p.$eval('.card.idx.ptop .pcount', e => e.textContent).catch(() => null)).toBe(null); // the pile is in section 2
        h.expect(w.errors, webFile).toEqual([]);
        // the web version saves a change (switching section); open what it saved in the app again
        if (webFile.includes('1.6.3')) {
          await p.locator('#tabs .tab', { hasText: appSaved.sections[1].name }).first().click();
          await p.waitForTimeout(800);
          const back = path.join(ctx.tmp, 'Saved by the web');
          await saveOut(p, back);
          const web = JSON.parse(fs.readFileSync(path.join(back, 'board.json'), 'utf8'));
          h.expect(web.cur).toBe(appSaved.sections[1].id);
          // nothing else changed (v2.0: except "fx" on pins, which the web version doesn't know; the app then uses "ox", kept for it)
          const noFx = d => ({ ...d, pins: d.pins.map(({ fx, ...q }) => q) });
          h.expect(noFx({ ...web, cur: appSaved.cur })).toEqual(noFx(appSaved));
          w.backDir = back;
          ctx.back = back;
        }
      } finally {
        await w.app.close();
      }
    }

    // ...and the board the web version saved opens in the app, on the section it was left on
    const ctx2 = { ...h.newBoard({ seed: false }), board: ctx.back };
    fs.mkdirSync(ctx2.userData, { recursive: true });
    fs.writeFileSync(path.join(ctx2.userData, 'config.json'), JSON.stringify({ recent: [fs.realpathSync(ctx.back)] })); // the app's last board
    page = await h.launch(ctx2);
    try {
      h.expect(await h.curSection(page)).toBe(appSaved.sections[1].name);
      h.expect(await page.locator('#layer .card').count()).toBe(want[appSaved.sections[1].name]);
      h.expect(ctx2.errors).toEqual([]);
    } finally {
      await h.close(ctx2);
    }
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});
