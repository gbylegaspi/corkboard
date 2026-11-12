// Copies third-party runtime files from node_modules into src/renderer so the app works fully offline.
//   pdf.js 6.2.108 (Apache 2.0)  -> src/renderer/vendor/pdfjs/
//   Inter 400/500/600 (OFL 1.1)   -> src/renderer/fonts/inter/
// Generated output; safe to delete (it is recreated by `npm run dev`, `npm test` and the build scripts).
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = path.join(root, 'node_modules');
const out = path.join(root, 'src', 'renderer');

function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}
function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true });
}

// ---- pdf.js ----
const pdf = path.join(nm, 'pdfjs-dist');
const pdfOut = path.join(out, 'vendor', 'pdfjs');
fs.rmSync(pdfOut, { recursive: true, force: true });
copy(path.join(pdf, 'build', 'pdf.min.mjs'), path.join(pdfOut, 'pdf.min.mjs'));
copy(path.join(pdf, 'build', 'pdf.worker.min.mjs'), path.join(pdfOut, 'pdf.worker.min.mjs'));
copyDir(path.join(pdf, 'wasm'), path.join(pdfOut, 'wasm'));
copyDir(path.join(pdf, 'cmaps'), path.join(pdfOut, 'cmaps'));
copyDir(path.join(pdf, 'standard_fonts'), path.join(pdfOut, 'standard_fonts'));
copy(path.join(pdf, 'LICENSE'), path.join(pdfOut, 'LICENSE'));

// ---- Inter (all unicode-range subsets, like the Google Fonts stylesheet the web version used) ----
const inter = path.join(nm, '@fontsource', 'inter');
const fontOut = path.join(out, 'fonts', 'inter');
fs.rmSync(fontOut, { recursive: true, force: true });
let css = '/* Inter (c) The Inter Project Authors, SIL Open Font License 1.1. Bundled from @fontsource/inter. */\n';
for (const w of ['400', '500', '600']) {
  const src = fs.readFileSync(path.join(inter, w + '.css'), 'utf8');
  css +=
    src.replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, '').replace(/url\(\.\/files\/([^)]+)\)/g, (m, f) => {
      copy(path.join(inter, 'files', f), path.join(fontOut, f));
      return 'url(./' + f + ')';
    }) + '\n';
}
fs.writeFileSync(path.join(fontOut, 'inter.css'), css);
copy(path.join(inter, 'LICENSE'), path.join(fontOut, 'LICENSE'));

console.log('vendor: pdf.js + Inter copied into src/renderer');

// ---- third-party licences: one text file, shipped with the app (Help → Third-Party Licences) ----
const ISC = who =>
  `ISC License\n\nCopyright (c) ${who}\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n`;
const ver = m => require(path.join(nm, m, 'package.json')).version;
const parts = [
  [
    'PDF.js ' + ver('pdfjs-dist') + ' (Mozilla Foundation and contributors) — shows PDF documents',
    fs.readFileSync(path.join(pdf, 'LICENSE'), 'utf8')
  ],
  [
    'Inter ' + ver('@fontsource/inter') + ' (The Inter Project Authors), via @fontsource/inter — the app’s typeface',
    fs.readFileSync(path.join(inter, 'LICENSE'), 'utf8')
  ],
  ['heic-convert ' + ver('heic-convert') + ' (Kiril Vatev) — iPhone HEIC photos', ISC('Kiril Vatev')],
  ['heic-decode ' + ver('heic-decode') + ' (Kiril Vatev)', ISC('Kiril Vatev')],
  [
    'libheif-js ' +
      ver('libheif-js') +
      ' (libheif by struktur AG and contributors, compiled to WebAssembly; used unmodified). LGPL-3.0, which adds to the GNU GPL v3 (https://www.gnu.org/licenses/gpl-3.0.txt). Source: https://github.com/catdad-experiments/libheif-js',
    fs.readFileSync(path.join(nm, 'libheif-js', 'LICENSE'), 'utf8')
  ],
  ['jpeg-js ' + ver('jpeg-js') + ' (Eugene Ware)', fs.readFileSync(path.join(nm, 'jpeg-js', 'LICENSE'), 'utf8')],
  ['pngjs ' + ver('pngjs'), fs.readFileSync(path.join(nm, 'pngjs', 'LICENSE'), 'utf8')],
  [
    'Electron ' + ver('electron') + ' (MIT) and Chromium',
    'Electron’s licence (LICENSE) and Chromium’s licences (LICENSES.chromium.html) are included with the app, next to its main program.\n'
  ]
];
const txt =
  'Corkboard uses the following open-source software. Thank you to everyone who made it.\n\n' +
  parts.map(([t, l]) => '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78) + '\n\n' + l.trim() + '\n').join('\n');
fs.writeFileSync(path.join(root, 'build', 'THIRD_PARTY_LICENSES.txt'), txt);
console.log('vendor: build/THIRD_PARTY_LICENSES.txt written');
