// Native menus. macOS: app menu + File / Edit / View / Window / Help. Windows: File / Edit / View / Help.
// View → Zoom maps to the board's own zoom (35–100%), never Chromium's page zoom.
'use strict';
const { Menu, app } = require('electron');
const path = require('path');

const isMac = process.platform === 'darwin';

// actions: { send(name, arg), openFolder(), openRecent(p), clearRecent(), showFolder(), about() }
function build(o) {
  const recent = o.recent.map(p => ({ label: path.basename(p) + '  —  ' + path.dirname(p), click: () => o.openRecent(p) }));
  const fm = isMac ? 'Show Board Folder in Finder' : 'Show Board Folder in File Explorer';
  const tpl = [];
  if (isMac) tpl.push({ label: app.name, submenu: [
    { label: 'About Corkboard', click: o.about }, { label: 'Check for Updates…', click: o.checkUpdates }, { type: 'separator' },
    { role: 'services' }, { type: 'separator' },
    { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' },
    { role: 'quit', label: 'Quit Corkboard' }
  ] });
  tpl.push({ label: 'File', submenu: [
    { label: 'Open Board Folder…', accelerator: 'CmdOrCtrl+O', click: o.openFolder },
    { label: 'Recent Boards', submenu: recent.length ? recent.concat([{ type: 'separator' }, { label: 'Clear Recent Boards', click: o.clearRecent }]) : [{ label: 'No recent boards', enabled: false }] },
    { type: 'separator' },
    { label: fm, accelerator: isMac ? 'Cmd+Alt+R' : 'Ctrl+Shift+E', enabled: o.hasBoard, click: o.showFolder },
    { type: 'separator' },
    { role: 'close', label: 'Close Window' }
  ] });
  tpl.push({ label: 'Edit', submenu: [
    { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
    { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' },
    // v1.7: bold / italic in sticky notes and index cards. ⌘B / ⌘I are handled by the note itself (registerAccelerator: false
    // only shows the shortcut here), so a key press is never applied twice
    { type: 'separator' },
    { label: 'Bold', accelerator: 'CmdOrCtrl+B', registerAccelerator: false, click: () => o.send('menu', 'bold') },
    { label: 'Italic', accelerator: 'CmdOrCtrl+I', registerAccelerator: false, click: () => o.send('menu', 'italic') }
  ] });
  const zoom = (name, label, acc, extra) => Object.assign({ label, accelerator: acc, enabled: o.hasBoard, click: () => o.send('menu', name) }, extra || {});
  const view = [
    // v1.8: the sections sidebar
    { label: 'Show Sections', accelerator: 'CmdOrCtrl+\\', enabled: o.hasBoard, click: () => o.send('menu', 'sections') },
    { type: 'separator' },
    zoom('zoomOut', 'Zoom Out', 'CmdOrCtrl+-'),
    zoom('zoomIn', 'Zoom In', 'CmdOrCtrl+='),
    // the same shortcut typed with Shift (Cmd/Ctrl +) and the numpad keys, without extra menu entries
    zoom('zoomIn', 'Zoom In', 'CmdOrCtrl+Plus', { visible: false, acceleratorWorksWhenHidden: true }),
    zoom('zoomIn', 'Zoom In', 'CmdOrCtrl+numadd', { visible: false, acceleratorWorksWhenHidden: true }),
    zoom('zoomOut', 'Zoom Out', 'CmdOrCtrl+numsub', { visible: false, acceleratorWorksWhenHidden: true }),
    zoom('zoomReset', 'Actual Size', 'CmdOrCtrl+0'),
    zoom('zoomReset', 'Actual Size', 'CmdOrCtrl+num0', { visible: false, acceleratorWorksWhenHidden: true }),
    { type: 'separator' },
    { role: 'togglefullscreen' }
  ];
  if (!app.isPackaged) view.push({ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' });
  tpl.push({ label: 'View', submenu: view });
  if (isMac) tpl.push({ role: 'windowMenu' });
  tpl.push({ role: 'help', label: 'Help', submenu: [{ label: 'Check for Updates…', click: o.checkUpdates }, { type: 'separator' }, { label: 'About Corkboard', click: o.about }, { label: 'Third-Party Licences', click: o.licences }] });
  return Menu.buildFromTemplate(tpl);
}

module.exports = { build };
