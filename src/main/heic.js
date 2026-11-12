// HEIC/HEIF (iPhone photos) → JPEG, so Chromium can show them. Runs in a worker thread so the window never stalls.
// Uses heic-convert (ISC) with libheif-js (LGPL-3.0, WebAssembly; no native code).
'use strict';
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

let worker = null, seq = 0;
const jobs = new Map();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(path.join(__dirname, 'heic-worker.js'));
  worker.on('message', m => { const j = jobs.get(m.id); if (!j) return; jobs.delete(m.id); m.err ? j.reject(new Error(m.err)) : j.resolve(m.jpeg); });
  const failAll = err => { for (const j of jobs.values()) j.reject(err); jobs.clear(); worker = null; };
  worker.on('error', failAll);
  worker.on('exit', () => failAll(new Error('HEIC converter stopped')));
  worker.unref();
  return worker;
}
// input: an absolute file path or bytes; resolves to a Buffer with the JPEG
async function toJpeg(input) {
  if (typeof input === 'string' && (!path.isAbsolute(input) || !/\.(heic|heif)$/i.test(input))) throw new Error('not a HEIC file');
  const buf = typeof input === 'string' ? await fs.promises.readFile(input) : Buffer.from(input);
  const id = ++seq, w = getWorker();
  return new Promise((resolve, reject) => {
    jobs.set(id, { resolve: r => resolve(Buffer.from(r)), reject });
    w.postMessage({ id, buf });
  });
}
module.exports = { toJpeg, licence: 'HEIC support: heic-convert (ISC) and libheif-js © struktur AG and libheif contributors, LGPL-3.0.' };
