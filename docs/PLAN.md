# Corkboard desktop: plan

**Version 2.1.0:** calendar cards link to the Mac's Calendar app (and so to Google or any account added to the Mac). A Swift helper (`native/calendar`, EventKit) reads events for the days shown, and day notes on a linked card become Calendar events: all-day, or an hour from an optional time, in a chosen calendar (`macTo`). Changing or removing a note changes or removes the event it made (`days[date].ev`); other events are never changed. macOS asks for access the first time. A diagnostic log (`logs/calendar.log` in the app's data folder) records each step without any note text. `npm test` runs 38 tests.

**Clean-up:** the single-file web version (`corkboard v1.6.2.html`, `v1.6.3.html`) is no longer kept or tested: the app is the only version. Its round-trip test (11) and the feature inventory of the old file (`FEATURES.md`) went with it; all are still in git history.

**Code tidy-up (after 2.0.1, no change for users):** Prettier and ESLint across the project; the page's code is now ES modules in `src/renderer/js/`, bundled by esbuild (`scripts/build-renderer.js`). Self-contained parts moved out of `app.js` into `catalog`, `templates`, `richtext`, `sound`, `icons` and `util`; dead code from the web version removed. See `ARCHITECTURE.md` for the layout and the next steps.

Status (2026-11-12): **Phases 1–4 done for macOS.** `npm test` runs 29 Electron tests and passes against the source and against the installed universal `.dmg` build, including macOS behaviour (Dock, ⌘Q saving, password-protected PDFs, sound without a click). `npm run build:mac` makes `dist/Corkboard-1.6.3-mac-universal.dmg` (229 MB, ad-hoc signed, Apple Silicon and Intel). The Windows configuration is written but not built or tested; that waits until you ask.

**Version 1.7.0** (her requests; app only, the web file isn't updated):
- **Theme per section:** `sections[].theme`. Optional; the board's theme applies otherwise.
- **Fonts:** a font button (`font`) on sticky notes, to-do lists and index cards.
- **Bold and italics:** ⌘B / ⌘I in sticky notes and index cards, stored as `b` / `i` on the `rt` pieces.
- **Longer text:** notes 1,000 characters (were 160); to-do items 300 (were 120); 60 items per list (were 30).
- **Longer or shorter:** drag the bottom edge of notes, to-do lists, index cards and calendars (`hs`).
- **Tilt:** a rotate handle on notes, to-do lists and index cards.
- **Mixed stacks:** sticky notes, to-do lists and index cards. "Spread out to look" (`fan`) keeps the group, "Stack again" gathers it, "Unstack for good" ends it.
- **Pins on stacks:** one pin per stack, drawn on the top card; each card's own pins return when the stack is spread or unstacked. Pins in board.json are never changed.
- **To-do select all:** ⌘A twice selects the list; copy, cut, delete and paste work on the whole list.

The web version opens these boards but ignores the new fields; saving there can shorten long notes and drop bold and italics. `npm test` runs 29 tests.

**Version 1.6.4:** adds Help → Check for Updates… (asks GitHub's latest-release API only when clicked, and offers to open the download page; nothing downloads or installs by itself). It also makes dragging smoother and removes the dark placeholder flash:
- The sound engine is set up in idle time instead of on the first drag. On a 6× slowed CPU that first drag's freeze went from 175 ms to 24 ms.
- The yarn overlay measures the board once per frame instead of once per pin.
- The edge badges recount a few times a second during a drag instead of every frame.
- Cards get their GPU layer on hover.
- Card photos are decoded before they're drawn.
- The empty-photo placeholder is a paper tone instead of near-black.

`npm test` now runs 24 tests.

**Found while testing, fixed in the app only (the web file still has it):** double-clicking the month name on a calendar never jumps back to today. The card captures the pointer when it's pressed (to start a drag), so the double-click is delivered to the card, not to the month name. The app now listens for the double-click on the card and checks it was on the month name; test 4 uses a real double-click.

**Also fixed in the app only:** a new label's buttons (shown above it) were covered by the sticky section tabs in smaller windows, and could hang off the left edge of the screen. They now go below the label when the tabs would cover them, and are nudged sideways at the window edges. Test 2 checks this at 1280×860 and 900×700.

Phase 2 media results (this Mac, Electron 45): H.264 and HEVC both play, in `.mp4` and in `.mov` (1280×720 test files written with AVFoundation, as an iPhone does). A 12 MP HEIC photo converts to JPEG in about 0.5 s.

## 1. Approach in one paragraph

Electron with electron-builder, as the brief recommends; I don't think Tauri is worth it here. The web app is split into `index.html`, `app.css` and `app.js` with the **logic unchanged**. It runs from a custom `app://` protocol. A renderer-side shim (`desktop/fs-shim.js`) provides `window.showDirectoryPicker` and handle objects with the same surface the app already uses, backed by a small IPC API to Node `fs` in the main process. So `save()`, `storeFile()`, `mount()`, thumbnails and the sticker library all run as they are. The app code changes are limited to a short, clearly marked list (section 3).

## 2. Project layout

```
package.json               scripts: dev, build:win, build:mac, test, icons
electron-builder.yml
src/
  main/
    main.js                window, protocol, CSP, single instance, menus, IPC wiring
    storage.js             fs operations, root registry, path guard, atomic writes
    config.js              userData/config.json: recent boards, window state
    menu.js                File / Edit / View / Help (+ macOS app menu)
    heic.js                (only if Q3 = yes) HEIC → JPEG on import
  preload/
    preload.js             contextBridge → window.corkNative (minimal, typed IPC calls)
  renderer/
    index.html             markup from the web file + <script src> tags, no inline JS
    app.css                the web CSS, unchanged except the font link
    app.js                 the web IIFE, unchanged except the hooks in section 3
    desktop/
      fs-shim.js           FileSystem*Handle look-alikes + showDirectoryPicker
      bridge.js            menus → app hooks, OS drag and drop, flush-on-close
      thumb-worker.js      (Q4) makeThumb in a Web Worker
    fonts/inter/*.woff2    from @fontsource/inter (OFL), plus inter.css
    vendor/pdfjs/          pdf.min.mjs + pdf.worker.min.mjs copied from pdfjs-dist
build/
  icon.svg                 one source: cork board with a red push pin
  icon.icns, icon.ico      generated by scripts/make-icons.js
scripts/make-icons.js      renders the SVG with Electron offscreen → PNGs → png2icons
tests/                     Playwright for Electron (section 6)
docs/PLAN.md, SIGNING.md, README.md, THIRD_PARTY_LICENSES.md
```

## 3. Changes to the web code (the complete list)

Everything else in `app.js` stays byte-for-byte the same as the web version, apart from being moved out of the HTML.

1. **Font:** the Google Fonts `<link>` becomes `<link rel="stylesheet" href="fonts/inter/inter.css">` (Inter 400/500/600, local woff2).
2. **pdf.js:** `pdfjs()` and `gzUrl()` load `vendor/pdfjs/pdf.min.mjs` with a dynamic `import()`, and `GlobalWorkerOptions.workerSrc` points to the bundled worker file. That gives a real module worker. `getDocument` options stay the same (`isEvalSupported:false`). I'll pin `pdfjs-dist` to **6.2.108** to match the web build if that version is on npm, and tell you if it isn't.
3. **Start-up:** the start-up IIFE gets a desktop branch. If there's a last board and its folder exists, it calls `mount()` straight away, with no button or prompt. If the folder is missing, it shows the start screen with a friendly message (Q7). With no recent board, the start screen shows only "Choose a folder".
4. **Remembering the folder:** `rememberHandle()` and `recallHandle()` use the main-process config instead of IndexedDB when running on the desktop.
5. **Hooks:** at the end of the IIFE, `window.__cork = {flush, pick, mount, addFiles}` (desktop only). The menus, the recent-boards list, OS drag and drop and flush-on-close use these. Board zoom from the menu clicks the existing `#zmOut`, `#zmIn` and `#zmN` buttons, so it behaves exactly like the toolbar.
6. **(Q2) Storage view text:** on the desktop only, the "Where is everything stored" view shows the full path, "Show in Finder/Explorer" replaces "Open folder picker here", and the paragraph about what a web page can't do is reworded.
7. **(Q4) Thumbnails:** `makeThumb()` posts to a worker when one is available and otherwise falls back to the current code. Same sizes, quality (0.86 WebP) and cache names.

The web version stays `corkboard v1.6.3.html` itself. `app.js` is the desktop copy: its pdf.js loading now points at the bundled files, so it isn't meant to run as a web page. The round-trip test opens boards saved by the app in the original HTML file.

## 4. Storage adapter (Phase 1, the main job)

**IPC surface** (preload → main, all `ipcRenderer.invoke`). The renderer never sees an absolute path except the board path shown in Settings.

| Call | Purpose |
|---|---|
| `pickFolder({defaultPath})` | Native `showOpenDialog` with `openDirectory` and `createDirectory`. It registers the folder as a root and returns `{root, name}` |
| `openRecent(path)` / `lastBoard()` | Reopens from config. It registers the root only if the folder still exists |
| `stat(root, segs)` | Checks for a file or directory; used by `getFileHandle`/`getDirectoryHandle` without `create` (rejects with `NotFoundError`, like the real API) |
| `mkdir(root, segs)` | `{create:true}` for directories |
| `read(root, segs)` | Returns an `ArrayBuffer` plus `{size, mtime, type}` |
| `write(root, segs, ArrayBuffer)` | Atomic write: temp file in the same folder, `fsync`, then `rename` over the target. On Windows it retries on `EPERM`/`EBUSY` (antivirus locks) |
| `copyIn(root, segs, srcPath)` | Fast path when the `File` came from a file input or an OS drop (path from `webUtils.getPathForFile`): the main process copies it to a temp file and renames, so big videos never pass through renderer memory |
| `remove(root, segs)` | `removeEntry` |
| `sameEntry(a, b)` | Compares real paths |
| `reveal(root)` | `shell.showItemInFolder` |

**Path guard (main process):**
- Roots exist only from a dialog result or the recent-boards config.
- Each segment is checked: no `/`, `\`, NUL, `.`, `..`, drive letters or empty segments.
- After `path.resolve` and `fs.realpath`, the target must lie inside the root's real path, which blocks symlink escapes. Anything else is rejected.

**Shim (renderer):**
- `DirHandle` and `FileHandle` classes keep `{root, segs}`.
- `kind`, `name`, `queryPermission`/`requestPermission` (always `'granted'`).
- `createWritable()` buffers `write()` calls and commits on `close()`.
- `getFile()` returns a real `File` with the right name, MIME type (from the extension), size and `lastModified`.

**board.json:** the existing 300 ms debounce stays. When the window closes, the main process asks the renderer to `__cork.flush()` and waits up to 3 s before closing, so a pending save is never lost.

## 5. Phases

| Phase | Contents | Done when |
|---|---|---|
| **1** | Electron shell; `app://` protocol with CSP; the split and the hooks; fs shim and storage; Inter bundled; pdf.js with a worker; `autoplayPolicy`; links through `setWindowOpenHandler` → `shell.openExternal` (http/https/mailto only); navigation blocked | Every item in FEATURES.md works by hand on macOS; a web-made board opens; no network requests (checked by logging `session.webRequest`) |
| **2** | Native menus; recent boards; Show in Finder/Explorer; zoom mapping (Ctrl/Cmd +/−/0 → board zoom, `setVisualZoomLevelLimits(1,1)`, Chromium zoom shortcuts disabled); window state and minimum size (≈ 800×600); single instance; OS drag and drop → the same flow as "Photos, videos & PDFs"; media format check (3.4); HEIC (if Q3 = yes) | Manual checks plus a short media report |
| **3** | Playwright suite (section 6) | `npm test` passes on macOS |
| **4** | electron-builder: mac universal dmg; Win NSIS (per-user) + portable, x64 + arm64; icons from SVG; `SIGNING.md`, `README.md`, licences | Unsigned builds created; the mac build is installed and run on this Mac |

## 6. Tests (Playwright `_electron.launch`)

- Each test gets a temporary `userData` folder and a temporary board folder.
- Native dialogs are stubbed from the test through `electronApp.evaluate(({dialog}) => …)`, and `shell.openExternal` is stubbed the same way to check links. **No test-only code ships in the app.**
- Fixtures are generated at test time:
  - 24 MP JPEGs (dev dependency `jpeg-js`, or encoded in an Electron window)
  - a 5-page PDF (`pdf-lib`, dev only)
  - a transparent PNG sticker
  - a hand-written v1.1.5-style `board.json`
- Scenarios 1–10 follow the brief.
- **Scenario 11 (round trip):**
  1. Launch Playwright's Chromium on `corkboard v1.6.3.html` (and v1.6.2, to check older web versions too).
  2. Copy the app-saved board into OPFS (`navigator.storage.getDirectory()`, a real `FileSystemDirectoryHandle`).
  3. Stub `showDirectoryPicker` to return it.
  4. Check that the cards render and that `board.json` keeps the same field values.

## 7. Risks and how I'll handle them

| # | Risk | Plan |
|---|---|---|
| R1 | **Resolved 2026-11-12:** a board with a 1 GB video took 2.8 s to open, so with your OK video cards now stream from `cork-file://` (opening: about 1.1 s; playback, seeking and the filter still all work). The original note: **Opening boards with many large videos.** The web `File` from the File System Access API is disk-backed and lazy. A shim `getFile()` has to read the bytes, and `mount()` calls it for every photo and video when the board opens | `read` uses Chromium-side streaming (the shim does `fetch()` on a guarded `cork-file://` URL and makes a `File` from the response blob; Chromium keeps large blobs on disk). I'll measure with 1 GB of video. If opening still takes more than about 2 s, I'll **ask you** before adding a small change so video cards stream from that URL instead of a blob |
| R2 | HEVC playback | Chromium uses the OS decoder for HEVC: macOS has it built in; Windows needs the "HEVC Video Extensions" from the Store or hardware support. I'll report what I actually see. I can't test Windows here (R4) |
| R3 | CSP versus the existing code | Policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob: cork-file:; font-src 'self'; worker-src 'self' blob:; connect-src 'self' cork-file:; object-src 'none'; base-uri 'none'`. `'unsafe-inline'` for styles is needed because the app writes `style=""` attributes in its markup; scripts stay strict. I'll add `'wasm-unsafe-eval'` only if pdf.js 6 needs it for its image decoders |
| R4 | **No Windows machine here, and Node isn't installed on this Mac** | I need Node 22 LTS installed (Q6). I can cross-build the Windows NSIS and portable targets from macOS, but setting the `.exe` icon and version info can need Wine, so it's more reliable to build on Windows or in GitHub Actions (Q6). Any Windows behaviour I can't test will be listed in each phase report |
| R5 | `webUtils.getPathForFile` returns `''` for files that don't come from disk | The shim falls back to `ArrayBuffer` writes |
| R6 | Two boards in a row, or switching boards while a save is pending | This already works in `mount()` (it flushes first); the shim keeps the old root registered until that write finishes |

## 8. Decisions (answered 2026-11-12)

| # | Decision |
|---|---|
| 1 | Electron |
| 2 | Desktop wording in the storage view: full path, "Show in Finder/Explorer" button, reworded paragraph (desktop only) |
| 3 | HEIC → JPEG on import with `heic-convert`; the original `.heic` is kept next to it and deleted with it |
| 4 | Thumbnails made in a Web Worker; no `sharp` |
| 5 | Version **1.6.3** (changed from 1.6.2 after the pin fix; About shows "Corkboard v1.6.3"), bundle ID `app.corkboard.desktop`, publisher "Corkboard" |
| 6 | Node 22 via Homebrew. **macOS only for now**: Windows packaging and testing wait until you ask. The Windows code paths (menus, Explorer, `rename` retry) are still written, just not built or tested |
| 7 | Missing-folder text as proposed |
| 8 | macOS: closing the window keeps the app in the Dock |
| 9 | **Fix the deleted-section pins in both versions.** `deleteSection()` also removes pins stuck in that section's cards, and their yarn. The fix goes into `app.js` and into the web file, a one-line change that keeps the rest of the file untouched (I'll check with you whether the web file's version label should change) |
| 10 | (added later) **No folder to choose on first launch.** The app makes its own board at `<app data>/My Board` (`~/Library/Application Support/Corkboard/My Board` on macOS, `%APPDATA%\Corkboard\My Board` on Windows) and opens it. It lives in app data rather than Documents so macOS doesn't ask for folder access. If it's deleted, it's made again. Other folders can still be opened from the File menu |

The original questions are below for reference.

## Questions (original wording)

1. **Framework:** I agree with Electron and won't use Tauri. Nothing for you to do unless you disagree.
2. **"Where is everything stored" (Settings → Board → Show folder…):** on the desktop, may I show the full folder path, replace "Open folder picker here" with **"Show in Finder" / "Show in Explorer"**, and reword the paragraph that says a web page can't open your file explorer? The web version stays as it is. *(Recommended: yes. As it stands, the text would be wrong in the app.)*
3. **HEIC from iPhone:** convert to JPEG on import with **`heic-convert`**? It's pure JavaScript/WASM with **no native dependency**, but it's slow (about 1–2 s per photo). The JPEG becomes the card's `file`, so the web version can show it too. The original `.heic` is kept next to it in `photos/` under the same base name and deleted along with it. The alternative, `sharp`, is native, and its prebuilt binaries can't decode HEIC anyway. *(Recommended: heic-convert.)*
4. **Thumbnails:** move `makeThumb()` into a **Web Worker** (no new dependencies, same output) instead of using `sharp`? *(Recommended: the worker.)*
5. **Version and IDs:** app version **1.6.2** (About: "Corkboard v1.6.2"), bundle ID **`app.corkboard.desktop`**, Windows publisher name **"Corkboard"**. Change any of these?
6. **Build machines:**
   - (a) May I install Node 22 LTS on this Mac (Homebrew or the nodejs.org installer, whichever you prefer)?
   - (b) For reliable Windows builds, should I add a GitHub Actions workflow that builds both platforms? That needs a GitHub repo. The other option is that you run `npm run build:win` on a Windows PC.
7. **Missing-folder message:** "I couldn't find your board folder (*name*). If you moved or renamed it, choose it again below." Is that OK?
8. **Closing on macOS:** quit when the window closes, or keep running in the Dock (the usual Mac behaviour, where clicking the icon reopens the board)? *(Recommended: the usual Mac behaviour; Windows always quits.)*
9. **Small existing web quirk:** pins stuck in cards of a deleted section stay in `board.json` until the board is next opened. They're invisible and harmless. I'll leave this alone unless you want it fixed in both versions.

Notes, not questions: the brief puts folder info in Settings → General, but the code has it in **Board → Storage**. I'm keeping the code layout. The brief also says notes use `plaintext-only`, but they use `contenteditable="true"` with input filtering so links can work. That's unchanged, and the parity is identical.
