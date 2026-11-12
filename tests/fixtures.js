// Test fixtures generated on the fly (no binary files in the repo): PNG photos, transparent stickers, PDFs, old boards.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc(b) { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (~c) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
// a gradient photo (RGB), or a transparent sticker (RGBA: a filled circle on a clear background)
function png(w, h, opts = {}) {
  const alpha = !!opts.sticker, bpp = alpha ? 4 : 3, hue = opts.hue || 0, row = w * bpp + 1, raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) {
    const o = y * row; raw[o] = 0;
    for (let x = 0; x < w; x++) {
      const p = o + 1 + x * bpp;
      raw[p] = (x * 255 / w + hue) & 255; raw[p + 1] = (y * 255 / h) & 255; raw[p + 2] = (128 + hue) & 255;
      if (alpha) { const dx = x - w / 2, dy = y - h / 2; raw[p + 3] = dx * dx + dy * dy < (w * .42) * (w * .42) ? 255 : 0; }
    }
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]);
}
// a plain PDF with N numbered pages
function pdf(pages) {
  const objs = [], kids = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  for (let i = 0; i < pages; i++) {
    const pid = 4 + i * 2, cid = pid + 1, s = `BT /F1 64 Tf 72 680 Td (Page ${i + 1}) Tj ET`;
    kids.push(pid + ' 0 R');
    objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${cid} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objs[cid] = `<< /Length ${s.length} >>\nstream\n${s}\nendstream`;
  }
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`;
  let out = '%PDF-1.4\n'; const offs = [];
  for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const x = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const DIR = path.join(__dirname, '.fixtures');
// big files are made once and reused across runs
function cached(name, make) {
  const p = path.join(DIR, name);
  if (!fs.existsSync(p)) { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(p + '.part', make()); fs.renameSync(p + '.part', p); }
  return p;
}
const photo24 = i => cached(`photo24mp-${i}.png`, () => png(6000, 4000, { hue: i * 40 }));
const photoSmall = i => cached(`photo-${i}.png`, () => png(1200, 900, { hue: i * 50 }));
const sticker = () => cached('sticker.png', () => png(600, 600, { sticker: true, hue: 90 }));
const pdf5 = () => cached('five-pages.pdf', () => pdf(5));

// macOS only: an iPhone-style HEIC photo (sips) and H.264 / HEVC videos (AVFoundation, via a small Swift tool)
const { execFileSync } = require('child_process');
const heic = () => cached('IMG_0001.heic', () => {
  const src = cached('heic-src.png', () => png(3024, 4032, { hue: 20 })), out = path.join(DIR, 'tmp.heic');
  execFileSync('sips', ['-s', 'format', 'heic', src, '--out', out], { stdio: 'ignore' });
  const b = fs.readFileSync(out); fs.rmSync(out); return b;
});
function video(codec, ext) {
  return cached(`${codec}.${ext}`, () => {
    const tool = cached('mkvid', () => { const out = path.join(DIR, 'mkvid.bin'); execFileSync('swiftc', ['-O', path.join(__dirname, 'tools', 'mkvid.swift'), '-o', out], { stdio: 'ignore' }); const b = fs.readFileSync(out); fs.rmSync(out); return b; });
    fs.chmodSync(tool, 0o755);
    const out = path.join(DIR, `tmp-${codec}.${ext}`); execFileSync(tool, [out, codec], { stdio: 'ignore' });
    const b = fs.readFileSync(out); fs.rmSync(out); return b;
  });
}

// macOS only: a password-protected PDF (PDFKit, via a small Swift tool)
const lockedPdf = () => cached('locked.pdf', () => {
  const out = path.join(DIR, 'tmp-locked.pdf');
  execFileSync('swift', [path.join(__dirname, 'tools', 'lockpdf.swift'), pdf5(), out, 'secret'], { stdio: 'ignore' });
  const b = fs.readFileSync(out); fs.rmSync(out); return b;
});

module.exports = { png, pdf, photo24, photoSmall, sticker, pdf5, heic, video, lockedPdf, DIR };
