// Corkboard desktop: makes display copies off the main thread.
// Same steps and output as makeThumb() in app.js: decode, shrink so the long edge is px, encode WebP at 0.86;
// replies blob:null when the photo is already small (long edge <= px * 1.15).
'use strict';
self.onmessage = async function (e) {
  var id = e.data.id, f = e.data.f, px = e.data.px, b = null;
  try {
    b = await createImageBitmap(f);
    var long = Math.max(b.width, b.height);
    if (long <= px * 1.15) { self.postMessage({ id: id, blob: null }); return; }
    var sc = px / long, w = Math.max(1, Math.round(b.width * sc)), h = Math.max(1, Math.round(b.height * sc));
    var r = await createImageBitmap(b, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' });
    var c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(r, 0, 0); if (r.close) r.close();
    self.postMessage({ id: id, blob: await c.convertToBlob({ type: 'image/webp', quality: 0.86 }) });
  } catch (err) {
    self.postMessage({ id: id, err: String(err && err.message || err) });
  } finally { if (b && b.close) b.close(); }
};
