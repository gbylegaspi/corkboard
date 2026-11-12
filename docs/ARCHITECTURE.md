# Corkboard: architecture

How the app is put together, how to work on it, and where the code is heading. The README is the user guide; this file is for whoever changes the code.

## Overview

Corkboard is an [Electron](https://www.electronjs.org/) app: a web page (the board) running in a desktop window, plus a small Node.js "main process" that does what a web page can't (files on disk, menus, the window).

```
┌──────────────── main process (Node) ────────────────┐      ┌──────────── page (Chromium) ─────────────┐
│ src/main/main.js     window, app:// and cork-file://│ IPC  │ src/preload/preload.js → window.corkNative│
│ src/main/storage.js  reads/writes the board folder  │◄────►│ src/renderer/desktop/   fs-shim, bridge    │
│ src/main/menu.js     native menus                   │      │ src/renderer/js/        the board (bundled)│
│ config, updates, heic                               │      │ src/renderer/app.css, index.html           │
└─────────────────────────────────────────────────────┘      └────────────────────────────────────────────┘
```

- **Security:** the page has no Node access (`contextIsolation`, `sandbox`). It can only call the fixed list of functions in `preload.js`, and the main process checks that every call comes from the app's own page. The page is served from `app://corkboard/` with a strict Content-Security-Policy; nothing is loaded from the internet. The only network request is **Check for Updates**, made by the main process when the user clicks it.
- **Files:** a board is a normal folder: `board.json`, `photos/` (originals, untouched) and `thumbs/` (display copies, safe to delete). The page talks to it through `desktop/fs-shim.js`, which looks like the browser's File System Access API but calls the main process. Writes are atomic (temp file, fsync, rename). Photos and videos are served to the page over `cork-file://`, with range requests so long videos stream.

## Folders

| Path | What's there |
| --- | --- |
| `src/main/` | Main process: window, protocols, IPC handlers (`main.js`), board folder access (`storage.js`), menus, recent boards and window state (`config.js`), update check, HEIC → JPEG in a worker thread |
| `src/preload/` | The page's only bridge to the main process (`window.corkNative`) |
| `src/renderer/index.html`, `app.css` | The page's markup and styles |
| `src/renderer/js/` | The board's code, as ES modules (see below). Bundled by esbuild into `src/renderer/build/app.js` (not committed) |
| `src/renderer/desktop/` | Desktop glue loaded around the bundle: `fs-shim.js` (before), `bridge.js` (after: menus, drag and drop from Finder, saving on close), `thumb-worker.js` (display copies off the main thread) |
| `src/renderer/vendor/`, `fonts/` | pdf.js and Inter, copied from `node_modules` by `scripts/vendor.js` (not committed) |
| `scripts/` | Build helpers: `vendor.js`, `build-renderer.js`, `make-icons.js` |
| `tests/` | Playwright tests that drive the real app (see Testing) |
| `build/` | Icons and packaging resources for electron-builder |
| `docs/` | This file, the plan and version notes (`PLAN.md`), features (`FEATURES.md`), code signing (`SIGNING.md`) |

### The board's modules (`src/renderer/js/`)

| Module | Contents | Depends on |
| --- | --- | --- |
| `app.js` | Entry point and the board itself: cards, sections, sidebar, stacks, pins and yarn, calendar, shelf, settings, zoom, saving and loading | everything below |
| `catalog.js` | Fixed lists: themes, textures, fonts, label looks, filters, colours, calendar looks, limits, version | nothing |
| `templates.js` | Built-in section templates | `catalog`, `util` |
| `richtext.js` | Rich text as data (`[{t, u?, b?, i?}]`) and reading/writing it from editable elements | `catalog`, `util` |
| `sound.js` | Synthesised sound effects (Web Audio), on/off and volume | nothing |
| `icons.js` | The icon set and card button markup | nothing |
| `util.js` | Ids, dates, colours, URLs, SVG helpers | nothing |

The leaf modules have no access to the board's state; ESLint enforces that (an undefined name is an error), so a module can't quietly start depending on `app.js`.

## The board file (`board.json`)

One JSON object. Fields added in later versions are optional, so older boards open unchanged, and the loader cleans anything it doesn't understand (see the end of `app.js`, "open a folder").

- `sections`: `[{id, name, parent?, fold?, theme?}]`. A flat list; `parent` nests a section inside another (any depth), order among siblings is list order.
- `cur`: the open section's id.
- `photos`: polaroids, videos, strips, stickers and PDFs, by `kind` (`photo` or missing, `video`, `strip`, `sticker`, `doc`). Common: `id`, `file` (or `files` for a strip), `s` (section id, or `"shelf"`), `x` (share of the layout width), `y` (px), `rot`, `z`, `sc` (size), `caption`, `f` (filters). Kind-specific: `mode`, `ar`, `bare`/`hold`, `font`, `pile`/`po`/`fan` (stacks), `play`/`snd` (videos), `n`/`pg` (PDF pages), `fin` (sticker finish).
- `notes`: sticky notes (no `kind`), to-do lists (`todo`: `items [{t, d, rt?}]`), index cards (`idx`), calendars (`cal`: `ym`, `days {date: {t, e, m}}`, `look`, `dy`). Text is `text` plus `rt` when formatted. `hs` makes notes and cards longer or shorter.
- `labels`, `stickers` (the sticker library), `templates` (her own).
- `pins`: `{id, c}` plus either `{s, x, y}` (on the board) or `{card, ox, oy, fx?}` (stuck in a card). `yarns`: `{id, a, b, c}` ties two pins.
- Settings: `theme`, `custom`, `style`, `wallpaper`, `sound`, `volume`, `dangle`, `hover`, `spell`, `video`, `zoom`, `yarnCol`.
- `bw`: the layout width. Set from the window the first time 2.0 opens the board; the main process scales the page so the layout looks the same at any window size.

Changing the format: add optional fields only, clean them in the loader, and say what older versions do with them in `PLAN.md`.

## Working on it

```bash
npm install            # once
npm run dev            # build the page and open the app
npm run watch          # in a second terminal: rebuild the page on every change (then View → Reload in dev builds)
npm test               # all tests (builds first)
npm run lint           # ESLint
npm run format         # Prettier (npm run check = lint + format check, for CI)
npm run build:mac      # dist/Corkboard-<version>-mac-universal.dmg
```

Conventions:

- **Formatting and linting:** Prettier (`.prettierrc.json`, 120 columns, single quotes) and ESLint's recommended rules (`eslint.config.js`). Run `npm run check` before committing.
- **Comments** explain why, and new behaviour is tagged with the version that added it (`// v2.0: …`), so `git blame` and the version notes line up.
- **Commits:** plain messages, no co-author trailer. Each release is one commit titled `Corkboard X.Y.Z: …`, tagged by the GitHub release.

## Testing

`tests/` uses Playwright's Electron support to launch the real app with its own temporary profile (`CORK_USER_DATA`) and a temporary board, then clicks, drags and types like a person and checks both the screen and `board.json`. Dialogs and `shell` are stubbed in the main process. `CORK_APP_EXE=…/Corkboard.app/Contents/MacOS/Corkboard npm test` runs the same tests against a packaged build. Fixture photos, videos and PDFs are generated (`tests/fixtures.js`, `tests/tools/`), not committed.

Every change keeps all tests passing; new features get a test file per version (`16-v17`, `17-v18`, `18-v20`, …).

## Releasing

1. Bump `version` in `package.json` and `VERSION` in `src/renderer/js/catalog.js`; update the README and `PLAN.md`.
2. `npm test`, then `npm run build:mac`, then run the tests against the packaged app (`CORK_APP_EXE`).
3. Commit and push, then `gh release create vX.Y.Z dist/Corkboard-X.Y.Z-mac-universal.dmg` with notes. **Help → Check for Updates** reads GitHub's latest release.

Builds are ad-hoc signed; see `SIGNING.md` for a Developer ID or the Mac App Store.

## Where the code is heading

`app.js` is still large (about 8,000 lines) because most of it shares the board's state: `data` (what's saved), `cards` (the elements on screen), the open folder, zoom and scroll. The next steps, each one test-guarded and behaviour-neutral:

1. **A state module** (`state.js`) that owns `data`, `cards`, the folder handles and the view (zoom, scroll), with small functions to read and change them instead of shared variables.
2. **Feature modules** split out of `app.js` on top of it, roughly along its existing `// ----` sections: `cards` (drag, resize, tilt), `photos`, `notes` (sticky notes, to-do lists, index cards), `calendar`, `stacks`, `labels`, `stickers`, `documents`, `sections` (and the sidebar), `pins-yarn`, `shelf`, `settings`, `zoom-scroll`, `storage` (save/load and the board-file cleaning).
3. **Styles by component:** `app.css` grew version by version, so later rules override earlier ones. Split it into one file per component and fold each override into the rule it changes, checking screenshots before and after.
4. **Type checking:** add `// @ts-check` and JSDoc types for the board-file shapes, so a misspelled field is caught before it ships.
