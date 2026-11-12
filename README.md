# Corkboard (desktop)

Corkboard is a cosy board for photos, videos, PDFs, notes, to-do lists, calendars, index cards, labels, stickers, pins and yarn. Everything is saved into **a folder she chooses**, and the app works fully offline.

This is the desktop app for **macOS** (and, later, Windows). It's built with Electron from the web version, [`corkboard v1.6.3.html`](corkboard%20v1.6.3.html). Boards move freely between the two: the folder layout (`board.json`, `photos/`, `thumbs/`) and the `board.json` format are the same.

## Using it

- **First launch:** nothing to set up. The app makes its own board folder and opens it:
  - macOS: `~/Library/Application Support/Corkboard/My Board`
  - Windows: `%APPDATA%\Corkboard\My Board`

  If that folder is ever deleted, the next launch makes a fresh, empty one.
- **Later launches** reopen the last board straight away.
- **Other boards:** **File → Open Board Folder…** opens any other board folder, such as one the web version uses, and **File → Recent Boards** switches between them. If a folder she chose goes missing, the start screen says so and lets her choose it again.
- **Uninstalling the app** doesn't delete the board folder.
- **Show the files:** **File → Show Board Folder in Finder** (in Explorer on Windows), or Settings → Board → Show folder….
- **Adding files:** drag photos, videos or PDFs from Finder onto the window, or use **+ Add**. iPhone HEIC photos are turned into JPEGs on import, and the original `.heic` is kept next to the JPEG in `photos/`.
- **Zoom:** **View → Zoom In / Zoom Out / Actual Size** (⌘+ ⌘− ⌘0) zoom the board itself (35–100%), the same as the toolbar.
- **Settings:** recent boards and the window size live in the app's own settings file, not in the board:
  - macOS: `~/Library/Application Support/Corkboard/config.json`
  - Windows: `%APPDATA%\Corkboard\config.json`

Opening an unsigned build the first time: see [docs/SIGNING.md](docs/SIGNING.md#opening-an-unsigned-build).

## Developing

You need **Node.js 22** (on this Mac: `brew install node@22`, then put `/opt/homebrew/opt/node@22/bin` on your `PATH`).

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app from source |
| `npm test` | Runs the Playwright tests against the source (23 tests, about 3 minutes; they open real app windows) |
| `npm run build:mac` | Builds `dist/Corkboard-<version>-mac-universal.dmg` (Apple Silicon + Intel), unsigned (ad-hoc) |
| `npm run build:win` | Builds the Windows NSIS installer and a portable `.exe` for x64 and arm64. Not built or tested yet; best run on a Windows PC |
| `npm run icons` | Remakes `build/icon.icns`, `icon.ico` and `icon.png` from `build/icon.svg` (the `.icns` needs macOS) |

To run the tests against a built app instead of the source:

```bash
CORK_APP_EXE="$PWD/dist/mac-universal/Corkboard.app/Contents/MacOS/Corkboard" npm test
```

`npm run dev`, `npm test` and the builds first run `scripts/vendor.js`. It copies pdf.js 6.2.108 and the Inter font from `node_modules` into `src/renderer/`, and writes `build/THIRD_PARTY_LICENSES.txt`. Nothing is loaded from the internet at runtime.

## How it's put together

```
src/main/        main process: window, menus, app:// and cork-file:// protocols, board-folder access (storage.js),
                 settings (config.js), HEIC conversion (heic.js + worker)
src/preload/     the small API the page gets (window.corkNative)
src/renderer/    the web app, split into index.html, app.css and app.js. app.js is the web code with a few changes,
                 each marked "DESKTOP:" or "app fix:"
  desktop/       fs-shim.js (the browser's folder API, backed by the main process), bridge.js (menus, drag and drop,
                 saving on close), thumb-worker.js (display copies off the main thread)
tests/           Playwright for Electron: one file per scenario, plus web-host/ for the round trip into the web version
build/           icon source and generated icons, licences
docs/            FEATURES.md (feature inventory), PLAN.md (plan, decisions, status), SIGNING.md
```

Safety:
- The page runs sandboxed, with context isolation and a strict Content-Security-Policy.
- File access is limited to the chosen board folder, and the main process rejects any path outside it.
- `board.json` and every other file are written to a temporary file first and then renamed into place, so a crash can't leave a half-written board.
- Links open in the default browser (http, https and mailto only), and any other network request is blocked.

## Licences

Corkboard uses pdf.js (Apache 2.0), Inter (SIL OFL 1.1), heic-convert / heic-decode (ISC), libheif-js (LGPL-3.0), jpeg-js (BSD-3-Clause), pngjs (MIT) and Electron/Chromium. The full texts ship with the app: **Help → Third-Party Licences**.
