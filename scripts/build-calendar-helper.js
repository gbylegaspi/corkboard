// Builds native/calendar (corkcal, the link to the Mac's Calendar app) into build/bin/corkcal: one universal binary
// (Apple Silicon + Intel), ad-hoc signed. macOS only; skipped elsewhere, and when the binary is newer than its source.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'native/calendar/main.swift');
const OUT = path.join(ROOT, 'build/bin/corkcal');

if (process.platform !== 'darwin') process.exit(0);
if (fs.existsSync(OUT) && fs.statSync(OUT).mtimeMs >= fs.statSync(SRC).mtimeMs) process.exit(0);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'corkcal-'));
try {
  // Intel needs macOS 13 or later: the current Swift tools no longer link Intel code for macOS 12. On an Intel Mac
  // still on macOS 12 the helper won't start, and the app simply doesn't offer the Calendar link.
  const targets = { arm64: 'arm64-apple-macos12', x86_64: 'x86_64-apple-macos13' };
  const parts = Object.entries(targets).map(([arch, target]) => {
    const out = path.join(tmp, arch);
    execFileSync('swiftc', ['-O', '-swift-version', '5', '-target', target, SRC, '-o', out], {
      stdio: 'inherit'
    });
    return out;
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  execFileSync('lipo', ['-create', ...parts, '-output', OUT]);
  execFileSync('codesign', ['--force', '--sign', '-', '--identifier', 'app.corkboard.desktop.corkcal', OUT]);
  console.log('built build/bin/corkcal');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
