// Corkboard desktop: preload. Exposes a small, fixed API to the page as window.corkNative.
// No Node APIs and no raw ipcRenderer reach the page; paths of picked files are looked up here, never sent by the page.
'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

async function call(ch, ...args) {
  const r = await ipcRenderer.invoke(ch, ...args);
  if (r && r.err) { const e = new Error(r.err.message); e.name = r.err.name; throw e; }
  return r ? r.ok : undefined;
}

contextBridge.exposeInMainWorld('corkNative', {
  platform: process.platform,
  pickFolder: opts => call('cork:pickFolder', opts || {}),
  lastBoard: () => call('cork:lastBoard'),
  openRecent: p => call('cork:openRecent', p),
  opened: root => call('cork:opened', root),
  stat: (root, segs) => call('cork:stat', root, segs),
  mkdir: (root, segs) => call('cork:mkdir', root, segs),
  write: (root, segs, buf) => call('cork:write', root, segs, buf),
  // copy a File she picked or dropped straight from disk (returns false if it has no path on disk)
  copyIn: async (root, segs, file) => {
    let p = '';
    try { p = webUtils.getPathForFile(file) || ''; } catch (e) { p = ''; }
    if (!p) return false;
    await call('cork:copyIn', root, segs, p);
    return true;
  },
  // HEIC/HEIF → JPEG bytes (reads the picked file from disk when it has a path, otherwise uses its bytes)
  heicToJpeg: async file => {
    let p = '';
    try { p = webUtils.getPathForFile(file) || ''; } catch (e) { p = ''; }
    return call('cork:heic', p || await file.arrayBuffer());
  },
  remove: (root, segs) => call('cork:remove', root, segs),
  sameEntry: (r1, s1, r2, s2) => call('cork:sameEntry', r1, s1, r2, s2),
  rootPath: root => call('cork:rootPath', root),
  reveal: root => call('cork:reveal', root),
  // v2.0: the board's layout width (null the first time); the window scales the page to fit it, and says which width it used
  boardWidth: bw => call('cork:boardWidth', bw),
  // menus and window events from the main process
  on: (name, fn) => {
    const ok = ['flush', 'menu'];
    if (!ok.includes(name) || typeof fn !== 'function') return;
    ipcRenderer.on('cork:' + name, (e, ...a) => fn(...a));
  },
  flushed: () => ipcRenderer.send('cork:flushed')
});
