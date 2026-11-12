// Worker thread for heic.js: decodes the first image of a HEIC/HEIF file and encodes it as a high-quality JPEG.
'use strict';
const { parentPort } = require('worker_threads');
const convert = require('heic-convert');
parentPort.on('message', async ({ id, buf }) => {
  try {
    const out = await convert({ buffer: Buffer.from(buf), format: 'JPEG', quality: 0.92 });
    const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    parentPort.postMessage({ id, jpeg: ab }, [ab]);
  } catch (e) {
    parentPort.postMessage({ id, err: String((e && e.message) || e) });
  }
});
