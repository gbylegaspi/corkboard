// Shared helpers for the Electron tests. Native dialogs, shell.openExternal/openPath and message boxes are stubbed
// from the test through electronApp.evaluate, so no test-only code ships in the app.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron, expect } = require('@playwright/test');

const APP = path.join(__dirname, '..');
// CORK_APP_EXE=/path/to/Corkboard.app/Contents/MacOS/Corkboard runs the tests against a packaged app instead of the source
function appCommand() {
  return process.env.CORK_APP_EXE ? { executablePath: process.env.CORK_APP_EXE, args: [] } : { args: [APP] };
}

// a temporary board folder (optionally with a board.json and files in photos/) and a temporary app profile
function newBoard(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cork-test-'));
  const board = path.join(tmp, opts.name || 'Our board'),
    userData = path.join(tmp, 'profile');
  fs.mkdirSync(board, { recursive: true });
  if (opts.files) {
    fs.mkdirSync(path.join(board, 'photos'), { recursive: true });
    for (const [n, src] of Object.entries(opts.files)) fs.copyFileSync(src, path.join(board, 'photos', n));
  }
  if (opts.data) fs.writeFileSync(path.join(board, 'board.json'), JSON.stringify(opts.data, null, 1));
  // the profile remembers this board as the last one, so the app opens it straight away (seed: false = a brand-new install)
  if (opts.seed !== false) {
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ recent: [fs.realpathSync(board)] }));
  }
  return { tmp, board, userData };
}

async function launch(ctx, opts = {}) {
  const app = await electron.launch({ ...appCommand(), env: { ...process.env, CORK_USER_DATA: ctx.userData } });
  ctx.app = app;
  await app.evaluate(({ dialog, shell }, dir) => {
    global.__dlg = dir;
    global.__external = [];
    global.__openedPaths = [];
    global.__boxes = [];
    global.__dlgCalls = 0;
    dialog.showOpenDialog = async () => {
      global.__dlgCalls++;
      return { canceled: false, filePaths: [global.__dlg] };
    };
    dialog.showMessageBox = async (w, o) => {
      global.__boxes.push(o || w);
      return { response: 0 };
    };
    shell.openExternal = async u => {
      global.__external.push(u);
    };
    shell.openPath = async p => {
      global.__openedPaths.push(p);
      return '';
    };
  }, ctx.board);
  const page = await app.firstWindow();
  ctx.page = page;
  ctx.errors = [];
  page.on('pageerror', e => ctx.errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') ctx.errors.push(m.text());
  });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach(w => w.webContents.setAudioMuted(true))
  );
  await page.waitForLoadState('domcontentloaded');
  if (opts.open !== false) await openBoard(ctx);
  return page;
}
// the app opens the last board by itself
async function openBoard(ctx) {
  const page = ctx.page;
  await expect(page.locator('#lfab')).toBeVisible();
  await settle(page);
}
// wait until the cards have finished dropping in (each card starts a little later than the one before)
async function settle(page) {
  await page.waitForTimeout(100);
  await page
    .waitForFunction(
      () =>
        !document
          .getAnimations()
          .some(
            a =>
              a.playState === 'running' &&
              a.effect &&
              a.effect.target &&
              a.effect.target.closest &&
              a.effect.target.closest('#layer')
          ),
      null,
      { timeout: 8000 }
    )
    .catch(() => {});
}
async function close(ctx) {
  if (ctx.app) {
    await ctx.app.close();
    ctx.app = null;
  }
}

function readBoard(ctx) {
  return JSON.parse(fs.readFileSync(path.join(ctx.board, 'board.json'), 'utf8'));
}
// wait for the debounced save (300 ms) and return board.json
async function saved(ctx, check, timeout = 8000) {
  const t0 = Date.now();
  let d;
  for (;;) {
    await ctx.page.waitForTimeout(150);
    try {
      d = readBoard(ctx);
      if (!check || check(d)) return d;
    } catch (e) {}
    if (Date.now() - t0 > timeout) {
      if (check) throw new Error('board.json never matched: ' + JSON.stringify(d).slice(0, 600));
      return d;
    }
  }
}
function list(ctx, sub) {
  const p = path.join(ctx.board, sub);
  return fs.existsSync(p) ? fs.readdirSync(p).sort() : [];
}

// the cards currently on the board: {id, cls, x, y, w, h} (x, y, w, h in screen pixels)
function cards(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('#layer .card')]
      .filter(c => c._p && !c.classList.contains('bye'))
      .map(c => {
        const r = c.getBoundingClientRect();
        return { id: c._p.id, cls: c.className, x: r.left, y: r.top, w: r.width, h: r.height };
      })
  );
}
// an element handle for the card with this data id
async function card(page, id) {
  const h = await page.evaluateHandle(
    i => [...document.querySelectorAll('#layer .card')].find(c => c._p && c._p.id === i) || null,
    id
  );
  const el = h.asElement();
  if (!el) throw new Error('no card ' + id);
  return el;
}
async function newCardId(page, before) {
  const now = await cards(page);
  const b = new Set(before.map(c => c.id));
  const n = now.filter(c => !b.has(c.id));
  return n.length ? n[n.length - 1].id : null;
}

// card buttons are only shown on hover; clicking them via a DOM click keeps the test independent of hover timing
async function cb(el, cls) {
  const b = await el.$('.cb.' + cls);
  if (!b) throw new Error('no button .' + cls);
  await b.dispatchEvent('click');
}
// the "+ Add" menu
async function add(page, label) {
  await page.click('#addMain');
  await page.locator('.pop.addpop .ai', { hasText: label }).first().click();
}
// press, move in steps, release (a real pointer drag)
async function drag(page, from, to, opts = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = opts.steps || 12;
  for (let i = 1; i <= steps; i++)
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  if (opts.hold) await page.waitForTimeout(opts.hold);
  await page.mouse.up();
  await page.waitForTimeout(opts.after == null ? 350 : opts.after);
}
// a point on a card that isn't a button or a text box (its top edge, centred)
async function grip(el, dy = 6) {
  const b = await el.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + dy };
}
async function zoomText(page) {
  return page.textContent('#zmN');
}
// select a word inside an editable element (like double-clicking it), so the link button can use it
async function selectWord(el, word) {
  await el.evaluate((root, w) => {
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) {
      const i = n.nodeValue.indexOf(w);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + w.length);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        return;
      }
    }
    throw new Error('word not found: ' + w);
  }, word);
}
// hover a card so its buttons show, then return the box of one of them
async function buttonBox(page, el, cls) {
  await el.hover();
  await page.waitForTimeout(450);
  return (await el.$('.cb.' + cls)).boundingBox();
}

// add photos through "+ Add → Photos, videos & PDFs" with the given look; returns the new card ids
async function addPhotos(page, files, mode = 'square', preset) {
  const before = await cards(page),
    n = [].concat(files).length;
  await page.setInputFiles('#file', files);
  await expect(page.locator('#ask')).toBeVisible();
  await page.click(`#ask .opt[data-m="${mode}"]`);
  await expect(page.locator('#fx')).toBeVisible({ timeout: 60000 });
  if (preset) await page.locator('#fxPs .fxp', { hasText: preset }).click();
  await page.click('#fxOk');
  await page.waitForFunction(k => document.querySelectorAll('#layer .card').length === k, before.length + n, {
    timeout: 60000
  });
  const b = new Set(before.map(c => c.id));
  return (await cards(page)).filter(c => !b.has(c.id)).map(c => c.id);
}
async function addOne(page, label) {
  const before = await cards(page);
  await add(page, label);
  await page.waitForFunction(k => document.querySelectorAll('#layer .card').length === k, before.length + 1);
  await page.waitForTimeout(500);
  return newCardId(page, before);
}

// v1.8: sections live in the sidebar (the tree is rendered even while it's closed)
async function openSections(page) {
  if (!(await page.locator('#sb.open').count())) {
    await page.click('#sbBtn');
    await page.waitForTimeout(350);
  }
}
function secRow(page, name) {
  return page.locator('#sbTree .sbr', {
    has: page.locator('.sbn', { hasText: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') })
  });
}
async function goSection(page, name) {
  await openSections(page);
  await secRow(page, name).locator('.sbgo').click();
  await page.waitForTimeout(400);
}
async function newSection(page) {
  await openSections(page);
  await page.click('#sbNew');
}
async function curSection(page) {
  return page.textContent('#sbCur');
}

module.exports = {
  APP,
  openSections,
  secRow,
  goSection,
  newSection,
  curSection,
  appCommand,
  settle,
  newBoard,
  launch,
  openBoard,
  close,
  readBoard,
  saved,
  list,
  cards,
  card,
  newCardId,
  cb,
  add,
  addOne,
  addPhotos,
  drag,
  grip,
  zoomText,
  selectWord,
  buttonBox,
  expect
};
