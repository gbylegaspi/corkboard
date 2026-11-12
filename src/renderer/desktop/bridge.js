// Corkboard desktop: connects the main process (window events, menus) and the OS (drag and drop) to the app's hooks.
(function () {
  'use strict';
  var N = window.corkNative, A = window.__cork;
  if (!N || !A) return;

  // the window is closing: save any pending change to board.json first
  N.on('flush', function () {
    Promise.resolve().then(function () { return A.flush(); }).catch(function () {}).then(function () { N.flushed(); });
  });

  // iPhone photos (HEIC/HEIF) can't be shown by Chromium: turn each into a JPEG (the card's file, so the web version
  // can show it too) and remember the untouched original, which storeFile() keeps next to it in photos/
  function isHeic(f) { return /^image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name); }
  A.heic = async function (list) {
    if (!list.some(isHeic)) return list;
    var n = list.filter(isHeic).length, bad = 0, out = [];
    A.toast(n === 1 ? 'Getting your iPhone photo ready…' : 'Getting your ' + n + ' iPhone photos ready…');
    for (var f of list) {
      if (!isHeic(f)) { out.push(f); continue; }
      try {
        var ab = await N.heicToJpeg(f), ext = (/\.(heic|heif)$/i.exec(f.name) || ['.heic'])[0].toLowerCase();
        var j = new File([ab], f.name.replace(/\.[^.]*$/, '') + '.jpg', { type: 'image/jpeg', lastModified: f.lastModified });
        j._heic = f; j._heicExt = ext; out.push(j);
      } catch (e) { bad++; }
    }
    if (bad) { A.warn(); A.toast(bad === 1 ? 'Couldn’t read that iPhone photo' : 'Couldn’t read ' + bad + ' iPhone photos'); }
    return out;
  };

  // a dialog or the start screen is up: menu zoom and dropped files wait (same as the toolbar, which is covered then)
  function busy() {
    if (document.getElementById('start')) return true;
    return ['set', 'fx', 'ask', 'tpl', 'rd', 'lb'].some(function (id) { var e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none'; });
  }
  function press(id) { var b = document.getElementById(id); if (b && !b.disabled) b.click(); }

  // menus: File → Open Board Folder… / Recent Boards, View → Zoom (the board's own zoom, via its toolbar buttons)
  N.on('menu', function (name, arg) {
    if (name === 'open') { A.pick(); return; }
    if (name === 'mount' && arg && arg.root) { A.mount(window.__corkShim.handleFor(arg)); return; }
    if (!A.hasBoard() || busy()) return;
    if (name === 'zoomIn') press('zmIn');
    else if (name === 'zoomOut') press('zmOut');
    else if (name === 'zoomReset') press('zmN');
  });

  // drag and drop from Finder / File Explorer: photos, videos and PDFs go through the same flow as
  // "+ Add → Photos, videos & PDFs" (the same file types that picker accepts; anything else is ignored)
  function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; }
  function accepted(f) {
    return /^(image|video)\//.test(f.type) || f.type === 'application/pdf' ||
      /\.(jpe?g|png|gif|webp|avif|bmp|heic|heif|mp4|m4v|mov|webm|ogv|mkv|pdf|docx?)$/i.test(f.name);
  }
  window.addEventListener('dragover', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = A.hasBoard() && !busy() ? 'copy' : 'none';
  });
  window.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault(); e.stopPropagation();
    if (!A.hasBoard() || busy()) return;
    var list = Array.prototype.filter.call(e.dataTransfer.files, accepted);
    if (list.length) A.addFiles(list);
  }, true);
})();
