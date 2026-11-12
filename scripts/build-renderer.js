// Bundles the page's code (src/renderer/js, ES modules) into one script: src/renderer/build/app.js.
// Run by "npm run dev", "npm test" and the build:* scripts; "--watch" rebuilds on every change.
'use strict';
const esbuild = require('esbuild');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const options = {
  entryPoints: [path.join(ROOT, 'src/renderer/js/app.js')],
  outfile: path.join(ROOT, 'src/renderer/build/app.js'),
  bundle: true,
  format: 'iife', // a classic script, so it still runs before desktop/bridge.js, as before
  target: 'chrome130', // Electron 45's Chromium is newer; nothing is transpiled away
  sourcemap: 'linked', // the .map is left out of the packaged app (see electron-builder.yml)
  legalComments: 'none',
  logLevel: 'warning'
};

(async () => {
  if (process.argv.includes('--watch')) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log('watching src/renderer/js …');
  } else {
    await esbuild.build(options);
  }
})().catch(() => process.exit(1));
