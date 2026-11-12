// Help → Check for Updates…: the only time Corkboard goes online, and only when she clicks it.
// Asks GitHub for the latest release of this app; if it's newer, offers to open its download page in the browser.
// Nothing is downloaded or installed automatically, and nothing about her or her board is sent.
'use strict';
const { app, dialog, shell } = require('electron');

const REPO = 'gbylegaspi/corkboard';
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES = `https://github.com/${REPO}/releases/latest`;

// "v1.6.10" > "1.6.9"; anything after a "-" (pre-release) counts as older than the plain version
function newer(a, b) {
  const p = v => String(v).replace(/^v/i, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

let busy = false;
async function check(win) {
  if (busy) return; busy = true;
  const have = app.getVersion();
  const box = o => dialog.showMessageBox(win || undefined, Object.assign({ type: 'info', title: 'Check for Updates', buttons: ['OK'] }, o));
  try {
    // Node's fetch (not the page's network, which stays blocked)
    const r = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Corkboard-desktop' }, signal: AbortSignal.timeout(10000) });
    if (r.status === 404) { await box({ message: 'You’re up to date', detail: 'Corkboard ' + have + ' is the newest version.' }); return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const rel = await r.json();
    const latest = String(rel.tag_name || '').replace(/^v/i, '');
    if (latest && newer(latest, have)) {
      const page = typeof rel.html_url === 'string' && rel.html_url.startsWith('https://github.com/') ? rel.html_url : RELEASES;
      const res = await box({ message: 'Corkboard ' + latest + ' is available', buttons: ['Download…', 'Later'], defaultId: 0, cancelId: 1,
        detail: 'You have version ' + have + '.\n\nDownload opens the release page in your browser. To install, open the new .dmg and drag Corkboard into Applications, choosing Replace. Your board and photos aren’t touched.' });
      if (res.response === 0) await shell.openExternal(page);
    } else {
      await box({ message: 'You’re up to date', detail: 'Corkboard ' + have + ' is the newest version.' });
    }
  } catch (e) {
    await box({ type: 'warning', message: 'Couldn’t check for updates', detail: 'Check your internet connection and try again.' });
  } finally { busy = false; }
}

module.exports = { check, newer };
