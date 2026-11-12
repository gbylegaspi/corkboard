// Makes build/icon.png, build/icon.icns (macOS) and build/icon.ico (Windows) from build/icon.svg.
// Run with Electron (it renders the SVG with Chromium):  npm run icons
// .icns needs macOS's iconutil; the .ico is written here (PNG-compressed entries, Windows Vista and later).
'use strict';
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');

const BUILD = path.join(__dirname, '..', 'build');
const SVG = fs.readFileSync(path.join(BUILD, 'icon.svg'), 'utf8');

// one offscreen window; each size is drawn by resizing the SVG (sharper than scaling a big image down)
let win = null;
async function render(size) {
  if (!win) {
    win = new BrowserWindow({ width: 1024, height: 1024, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
    const html = '<!doctype html><html><body style="margin:0;background:transparent">' + SVG.replace('<svg ', '<svg id="i" style="display:block" ') + '</body></html>';
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  }
  await win.webContents.executeJavaScript(`(()=>{const s=document.getElementById('i');s.style.width=s.style.height='${size}px';return 1})()`);
  await new Promise(r => setTimeout(r, 250));
  let img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  if (img.getSize().width !== size) img = img.resize({ width: size, height: size, quality: 'best' });
  return img.toPNG();
}

function ico(pngs) { // pngs: [[size, buffer]]
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length); let off = 6 + dir.length;
  pngs.forEach(([s, b], i) => {
    const o = i * 16; dir[o] = s >= 256 ? 0 : s; dir[o + 1] = s >= 256 ? 0 : s; dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(b.length, o + 8); dir.writeUInt32LE(off, o + 12); off += b.length;
  });
  return Buffer.concat([head, dir, ...pngs.map(p => p[1])]);
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024], png = {};
    for (const s of sizes) png[s] = await render(s);
    fs.writeFileSync(path.join(BUILD, 'icon.png'), png[1024]);
    fs.writeFileSync(path.join(BUILD, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256].map(s => [s, png[s]])));
    if (process.platform === 'darwin') {
      const set = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cork-icon-')), 'icon.iconset'); fs.mkdirSync(set);
      for (const s of [16, 32, 128, 256, 512]) { fs.writeFileSync(path.join(set, `icon_${s}x${s}.png`), png[s]); fs.writeFileSync(path.join(set, `icon_${s}x${s}@2x.png`), png[s * 2]); }
      execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(BUILD, 'icon.icns')]);
    } else console.warn('icon.icns is only made on macOS (iconutil); icon.png and icon.ico were written');
    console.log('icons written to build/');
    app.exit(0);
  } catch (e) { console.error(e); app.exit(1); }
});
