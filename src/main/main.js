// Corkboard desktop: main process.
// Serves the web app from app://corkboard/ and board files from cork-file://<root>/..., wires the storage IPC,
// keeps everything offline, and opens links in the default browser.
'use strict';
const { app, BrowserWindow, protocol, ipcMain, dialog, shell, session, Menu } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const storage = require('./storage');
const config = require('./config');
const menu = require('./menu');
const heic = require('./heic');

const APP_ORIGIN = 'app://corkboard';
const RENDERER = path.join(__dirname, '..', 'renderer');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: cork-file:",
  "font-src 'self'",
  "worker-src 'self'",
  "connect-src 'self' cork-file:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'"
].join('; ');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } },
  { scheme: 'cork-file', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

if (process.env.CORK_USER_DATA) app.setPath('userData', process.env.CORK_USER_DATA); // tests use a temporary profile

// ---- single instance: a second launch focuses the existing window ----
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } else if (app.isReady()) createWindow(); });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf' };

async function serveApp(request) {
  try {
    const u = new URL(request.url);
    if (u.host !== 'corkboard') return new Response(null, { status: 404 });
    let rel = decodeURIComponent(u.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const p = path.normalize(path.join(RENDERER, rel));
    if (!p.startsWith(RENDERER + path.sep)) return new Response(null, { status: 403 });
    const body = await fsp.readFile(p);
    return new Response(body, { status: 200, headers: {
      'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream',
      'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache'
    } });
  } catch (e) { return new Response(null, { status: 404 }); }
}

// ---- IPC: only the app's own page may call these ----
function fromApp(e) {
  let u = null;
  try { u = e.senderFrame && e.senderFrame.url; } catch (err) { return false; } // the frame went away (window closing)
  return typeof u === 'string' && u.startsWith(APP_ORIGIN + '/');
}
function handle(ch, fn) {
  ipcMain.handle(ch, async (e, ...args) => {
    if (!fromApp(e)) return { err: { name: 'NotAllowedError', message: 'denied' } };
    try { return { ok: await fn(e, ...args) }; }
    catch (err) { return { err: { name: err.name && err.name !== 'Error' ? err.name : (err.code === 'ENOENT' ? 'NotFoundError' : 'InvalidStateError'), message: String(err.message || err) } }; }
  });
}
async function exists(p) { try { return (await fsp.stat(p)).isDirectory(); } catch (e) { return false; } }
async function openFolder(p) { const r = await storage.register(p); config.addRecent(storage.rootPath(r.root)); refreshMenu(); return r; }

handle('cork:pickFolder', async (e, opts) => {
  let defaultPath;
  try { if (opts && opts.startIn) defaultPath = storage.rootPath(opts.startIn); } catch (err) {}
  const w = BrowserWindow.fromWebContents(e.sender);
  const res = await dialog.showOpenDialog(w, { title: 'Choose a folder for your board', buttonLabel: 'Use this folder', defaultPath,
    properties: ['openDirectory', 'createDirectory', 'promptToCreate'] });
  if (res.canceled || !res.filePaths || !res.filePaths[0]) return null;
  const p = res.filePaths[0];
  await fsp.mkdir(p, { recursive: true });
  return openFolder(p);
});
// the board the app makes for itself on first launch, so there's no folder to choose
function defaultBoard() { return path.join(app.getPath('userData'), 'My Board'); }
handle('cork:lastBoard', async () => {
  const p = config.recent()[0];
  if (!p) { const d = defaultBoard(); await fsp.mkdir(path.join(d, 'photos'), { recursive: true }); return openFolder(d); }
  if (!(await exists(p))) {
    let own = defaultBoard();
    try { own = path.join(fs.realpathSync(app.getPath('userData')), 'My Board'); } catch (e) {} // recent paths are stored resolved
    if (path.resolve(p) !== path.resolve(own) && path.resolve(p) !== path.resolve(defaultBoard())) return { missing: path.basename(p) };
    await fsp.mkdir(path.join(p, 'photos'), { recursive: true }); // the app's own board: just make it again
  }
  return openFolder(p);
});
handle('cork:openRecent', async (e, p) => {
  if (!config.recent().includes(p)) throw Object.assign(new Error('not a recent board'), { name: 'NotAllowedError' });
  if (!(await exists(p))) throw Object.assign(new Error('missing'), { name: 'NotFoundError' });
  return openFolder(p);
});
handle('cork:stat', (e, root, segs) => storage.stat(root, segs));
handle('cork:mkdir', (e, root, segs) => storage.mkdir(root, segs));
handle('cork:write', (e, root, segs, buf) => storage.write(root, segs, buf));
handle('cork:copyIn', (e, root, segs, src) => storage.copyIn(root, segs, src));
handle('cork:remove', (e, root, segs) => storage.remove(root, segs));
handle('cork:sameEntry', (e, r1, s1, r2, s2) => storage.sameEntry(r1, s1, r2, s2));
handle('cork:rootPath', (e, root) => storage.rootPath(root));
handle('cork:reveal', async (e, root) => { const err = await shell.openPath(storage.rootPath(root)); if (err) throw new Error(err); });
handle('cork:opened', (e, root) => { current = root; refreshMenu(); });
// iPhone photos: HEIC/HEIF → JPEG (input is the picked file's path, or its bytes)
handle('cork:heic', async (e, input) => { const out = await heic.toJpeg(input); return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength); });

// ---- the window ----
let win = null, current = null, quitting = false;
function send(ch, ...a) { if (win && !win.webContents.isDestroyed()) win.webContents.send('cork:' + ch, ...a); }
function refreshMenu() {
  if (!app.isReady()) return;
  Menu.setApplicationMenu(menu.build({
    recent: config.recent(), hasBoard: !!(win && current),
    send,
    openFolder: () => { if (!win) createWindow(); else { win.focus(); send('menu', 'open'); } },
    openRecent: p => openRecentFromMenu(p),
    clearRecent: () => { const keep = current ? [storage.rootPath(current)] : []; config.clearRecent(); keep.forEach(config.addRecent); refreshMenu(); },
    showFolder: () => { if (current) shell.openPath(storage.rootPath(current)); },
    about: showAbout,
    licences: () => shell.openPath(resource('THIRD_PARTY_LICENSES.txt'))
  }));
}
async function openRecentFromMenu(p) {
  if (!(await exists(p))) {
    await dialog.showMessageBox(win || undefined, { type: 'info', message: 'I couldn’t find that board folder', detail: p + '\n\nIf you moved or renamed it, use File → Open Board Folder… to choose it again.', buttons: ['OK'] });
    config.removeRecent(p); refreshMenu(); return;
  }
  if (!win) { config.addRecent(await fsp.realpath(p)); createWindow(); return; } // a new window reopens the newest recent board
  win.focus();
  try { if (current && storage.rootPath(current) === await fsp.realpath(p)) return; } catch (e) {}
  send('menu', 'mount', await openFolder(p));
}
function showAbout() {
  dialog.showMessageBox(win || undefined, {
    type: 'none', title: 'About Corkboard', message: 'Corkboard', buttons: ['OK'], icon: appIcon(),
    detail: 'Version ' + app.getVersion() + '\n\n' +
      'PDF.js © Mozilla Foundation and contributors, Apache License 2.0.\n' +
      'Inter © The Inter Project Authors, SIL Open Font License 1.1.\n' +
      (heicLicence ? heicLicence + '\n' : '') +
      'Built with Electron (MIT) and Chromium.\nFull licence texts: Help → Third-Party Licences.'
  });
}
const heicLicence = heic.licence;
// files shipped next to the app (extraResources when packaged; build/ while developing)
function resource(name) { return app.isPackaged ? path.join(process.resourcesPath, name) : path.join(__dirname, '..', '..', 'build', name); }
function appIcon() { try { const { nativeImage } = require('electron'); const p = resource('icon.png'); return fs.existsSync(p) ? nativeImage.createFromPath(p) : undefined; } catch (e) { return undefined; } }

// window size, position and maximised state, restored only if it still fits on a connected screen
function windowState() {
  const s = config.get('window'), d = { width: 1280, height: 860 };
  if (!s || typeof s !== 'object') return d;
  const { screen } = require('electron');
  const b = { x: +s.x, y: +s.y, width: Math.max(800, +s.width || 1280), height: Math.max(600, +s.height || 860) };
  if (!isFinite(b.x) || !isFinite(b.y)) return Object.assign(d, { width: b.width, height: b.height, maximized: !!s.maximized });
  const wa = screen.getDisplayMatching(b).workArea;
  const visible = b.x < wa.x + wa.width - 60 && b.x + b.width > wa.x + 60 && b.y >= wa.y - 10 && b.y < wa.y + wa.height - 60;
  return visible ? Object.assign(b, { maximized: !!s.maximized }) : Object.assign(d, { width: Math.min(b.width, wa.width), height: Math.min(b.height, wa.height), maximized: !!s.maximized });
}
function trackWindow(w) {
  let t = 0;
  const store = () => { if (w.isDestroyed() || w.isMinimized() || w.isFullScreen()) return; const max = w.isMaximized(), b = max ? (config.get('window') || {}) : w.getBounds();
    config.set('window', { x: b.x, y: b.y, width: b.width, height: b.height, maximized: max }); };
  const later = () => { clearTimeout(t); t = setTimeout(store, 400); };
  w.on('resize', later); w.on('move', later); w.on('maximize', store); w.on('unmaximize', store); w.on('close', store);
}

function createWindow() {
  const ws = windowState();
  win = new BrowserWindow({
    x: ws.x, y: ws.y, width: ws.width, height: ws.height, minWidth: 800, minHeight: 600, show: false,
    title: 'Corkboard', backgroundColor: '#8a5a34',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required', spellcheck: false,
      navigateOnDragDrop: false
    }
  });
  const wc = win.webContents;
  // no Chromium pinch zoom; pinch reaches the app as ctrl+wheel and zooms the board instead
  wc.on('did-finish-load', () => { wc.setVisualZoomLevelLimits(1, 1).catch(() => {}); });
  // links on words open in her default browser; nothing else may open a window
  wc.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  wc.on('will-navigate', (e, url) => { if (!url.startsWith(APP_ORIGIN + '/index.html')) { e.preventDefault(); openExternal(url); } });
  wc.on('will-redirect', (e, url) => { if (!url.startsWith(APP_ORIGIN + '/')) e.preventDefault(); });
  wc.on('will-attach-webview', e => e.preventDefault());
  trackWindow(win);
  win.once('ready-to-show', () => { if (ws.maximized) win.maximize(); win.show(); });
  // let a pending board.json save finish before the window goes away
  let flushed = false;
  win.on('close', e => {
    if (flushed || wc.isDestroyed()) return;
    e.preventDefault();
    const w = win;
    // (preventing close cancels a quit in progress, so carry on quitting once the save is done)
    const done = () => { if (flushed) return; flushed = true; ipcMain.removeListener('cork:flushed', onFlushed); if (!w.isDestroyed()) w.close(); if (quitting) app.quit(); };
    const onFlushed = ev => { if (ev.sender === wc) done(); };
    ipcMain.on('cork:flushed', onFlushed);
    wc.send('cork:flush');
    setTimeout(done, 3000);
  });
  win.on('closed', () => { win = null; current = null; refreshMenu(); });
  win.loadURL(APP_ORIGIN + '/index.html');
}

function openExternal(url) {
  try { const u = new URL(url); if (['http:', 'https:', 'mailto:'].includes(u.protocol)) shell.openExternal(u.href); } catch (e) {}
}

app.whenReady().then(() => {
  protocol.handle('app', serveApp);
  protocol.handle('cork-file', req => storage.serve(req, APP_ORIGIN));
  const ses = session.defaultSession;
  // offline only: anything that isn't the app itself or a board file is blocked (and logged)
  ses.webRequest.onBeforeRequest((d, cb) => {
    if (/^(app|cork-file|blob|data|devtools|chrome-extension):/.test(d.url)) return cb({});
    console.warn('[corkboard] blocked network request:', d.url);
    cb({ cancel: true });
  });
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'fullscreen' || perm === 'clipboard-sanitized-write'));
  ses.setPermissionCheckHandler((wc, perm) => perm === 'fullscreen' || perm === 'clipboard-sanitized-write');
  refreshMenu();
  createWindow();
});
app.on('activate', () => { if (!win) createWindow(); });
app.on('before-quit', () => { quitting = true; config.saveNow(); });
// macOS: the app stays in the Dock when the window is closed; Windows/Linux: quit
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('web-contents-created', (e, wc) => {
  wc.on('will-navigate', (ev, url) => { if (!url.startsWith(APP_ORIGIN + '/')) ev.preventDefault(); });
  wc.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
});

module.exports = { get win() { return win; }, get current() { return current; }, openFolder, config, Menu };
