# Corkboard v1.6.2: feature inventory

This checks section 4 of the brief against `corkboard v1.6.2.html`. Line numbers point into that file.

✅ means the brief and the code agree. ⚠️ means they differ, or there's something the desktop port has to handle. Each ⚠️ is repeated in `PLAN.md` under "Questions" or "Risks".

## File layout of the web version

| Lines | Contents |
|---|---|
| 1–728 | One `<style>` block (all CSS, versioned with `/* v1.x */` comments) |
| 729 | Google Fonts `<link>` for Inter. **Network request; must be replaced by a bundled font** |
| 731–914 | Static markup: board, toolbars, dialogs (`#set`, `#fx`, `#rd`, `#lb`, `#tpl`, `#ask`, `#start`), SVG filter defs (`cbB`, `cbW`, `cbG`, `cbM`), yarn overlay |
| 916–3125 | One IIFE with all the logic (no globals are exported) |
| 3129–3130 | PDF.js 6.2.108 lib and worker, gzip + base64 in `<script type="text/plain">` |

Desktop-relevant entry points inside the IIFE: `save()`/`flush()` (1026), `storeFile()` (2149), `addFiles()` (2153), `mount()` (3026), `pick()` (3093), the start-up IIFE (3101), `recallHandle()`/`rememberHandle()` (1021–1023), `setZoom()` (2543), `pdfjs()` (1745).

## Board and navigation

| Feature | Status | Where / notes |
|---|---|---|
| Start screen, "Choose a folder" | ✅ | `#start` 910; start-up IIFE 3101. The web version offers "Open my board" from a handle remembered in IndexedDB |
| `board.json`, `photos/`, `thumbs/` | ✅ | `mount()` 3029–3034; `flush()` writes `JSON.stringify(data,null,1)` |
| Editable title (60 chars, plain text, one line) | ✅ | 2531–2537 |
| Sections as tabs, sticky bar, slide-in | ✅ | `renderTabs()` 2126; `#tabs.stuck::before` 56–57; `stick()` 3119 |
| Double-click to rename a tab (24 chars) | ✅ | `rename()` 2107 |
| × with two-tap delete (current tab only, needs at least 2 sections) | ✅ | 2133–2136, `deleteSection()` 2113 |
| "+ Section" opens the template picker | ✅ | 2139 |
| Zoom 35–100%, saved as `zoom` | ✅ | `setZoom()` 2543; steps 1/.85/.7/.55/.45/.35 (2550) |
| − / % / + buttons; % resets | ✅ | 2551–2553 |
| Ctrl/Cmd + wheel, anchored at the pointer | ✅ | 2555. Anchoring is **vertical only** (it keeps `clientY`; the horizontal origin is the board centre) |
| Two-finger touch pinch | ✅ | 2560 |
| Wider board (to 1/0.35 of the width), `x` as a fraction | ✅ | `xMargin()`/`clampX()` 2864 |
| PAN: trackpad swipe, Shift + wheel | ✅ | 2839 |
| PAN: drag empty space; one-finger swipe on touch | ✅ | 2845 |
| PAN: auto-hiding scrollbar (drag, or click to jump) | ✅ | `hbar()` 2827, 2832 |
| PAN resets on section switch; new cards land in view | ✅ | `renderSection()` 2101; `slot()` adds `PAN` (2081) |
| Edge badges: click to scroll, double-click to zoom to fit | ✅ | `edges()` 2868, `panToSide()` 2877, `zoomToFit()` 2873 |
| Multi-select with Shift/Ctrl/Cmd + click; group drag; Esc or empty click clears | ✅ | 1080–1082, 2692–2696, 2777 |
| Bottom-left toolbar: ⚙, Yarn, divider, − % + | ✅ | 791–795 |
| "+ Add" menu: plus turns to ×, icons, arrow keys | ✅ | 2781–2811. The old buttons (`#cardBtn`, `#noteBtn` …) are still in the DOM but hidden (693); the menu clicks them |
| Shelf: drop target that grows and pulses | ✅ | `body.cbdrag .shbtn` 609; `overShelf()` adds a 12px margin (2699) |
| Shelf: drag out, tap out, "Put everything here" (double-click guard) | ✅ | `shelfThumb()` 2728, `unshelve()` 2719, 2772 |
| Shelf: `s:'shelf'`, `sh`; index cards leave their pile | ✅ | `toShelf()` 2702–2706 |
| Narrow layout: one bottom row | ✅ | media queries 642–643, 720 |

## Cards (common)

| Feature | Status | Where / notes |
|---|---|---|
| `.cb` buttons: 32px (40px coarse), hidden while dragging or swinging | ✅ | 82–102 |
| `IC` icon set | ✅ | 1127 |
| Two-tap delete (`armDel`, 2.5 s) | ✅ | 1047 |
| Resize `.rz` → `sc` (0.5–4); double-click resets | ✅ | `resizable()` 1107 |
| `slot()` + `pinUp()` + `keepIn()`; reflow on resize | ✅ | 2076, 1122, 3122 |
| Polaroid dangle (only cards with a `.pin`); Motion toggle | ✅ | `draggable()` 1054–1075, `data.dangle` |
| Non-destructive filters (10 presets, 7 sliders), chosen at upload and editable later | ✅ | `FX_PRESETS` 1201, `openFx()` 1254, `editFx()` 1297 |

## Photos, strips, videos, stickers, PDFs

| Feature | Status | Where / notes |
|---|---|---|
| Polaroid: square or original (`mode`, `ar`), caption (40 chars) | ✅ | `renderPhoto()` 1391, `applyMode()` 1306 |
| Frame cycle: polaroid → bare + pin → bare + tape | ✅ | 1398–1402 (`bare`, `hold`) |
| "No frame" in the upload dialog | ✅ | `#ask` 904 |
| Photobooth strip: 4 photos (multiples of 4), caption, filters, font | ✅ | `renderStrip()` 1373; `addFiles(...,true)` |
| Film-strip video: hover plays muted, click opens lightbox with filters | ✅ | `renderVideo()` 1351. No pin, so no dangle |
| Stickers PNG/WebP/GIF, hint when there's no alpha | ✅ | `addStickers()` 1721, `hasAlpha()` 1716 |
| Sticker drag, resize, rotate (snaps under 3°, double-click straightens), delete | ✅ | `rotatable()` 1651 |
| Finishes Plain/Shiny/Matte + White border + Worn (`fin{sh,b,w}`) | ✅ | `applyFin()` 1623, SVG filters 754–790. The Shiny click plays `glint` |
| Sticker library drawer; delete only when a file is unused | ✅ | `stickerDrawer()` 1687, `fileUsed()` 1681 |
| PDF card: stapled fan, counter, ‹ ›, arrow keys, peel animation | ✅ | `renderDoc()` 1768 |
| Reader: 3D turn; buttons, keys (arrows, PgUp/PgDn), swipe, tap a half | ✅ | `openReader()` 1810, `rdFlip()` 1822, 1842 |
| `pg` remembered; password error; "save Word as PDF" hint | ✅ | `addDocs()` 1849, `WORD_MSG` 1766 |
| PDF.js runs on the main thread from gzip blob URLs | ⚠️ | `gzUrl()`/`pdfjs()` 1740–1748. It uses `DecompressionStream`, blob-URL `import()` and a blob worker. **Replaced by `pdfjs-dist` with a real worker** |

## Notes, lists, cards, labels, calendar

| Feature | Status | Where / notes |
|---|---|---|
| Sticky note: palette colours (dot cycles), resizable, 160 chars | ✅ | `renderNote()` 2026 |
| Rich text = plain text + links (`rt` pieces, `text` kept) | ✅ | `rtStore()`/`rtRead()`/`rtRender()` 1488–1517 |
| Links only http/https/mailto, normalised (`safeUrl`) | ✅ | 1488 |
| Link bubble: Open ↗ / Edit / Remove | ✅ | `linkBubble()` 1533. **Open uses `window.open(href,'_blank','noopener')`**, so `setWindowOpenHandler` has to catch it |
| Note editors use `contenteditable="true"` + `beforeinput` filtering | ⚠️ | The brief says `plaintext-only`. The code uses `contenteditable="true"` (1968, 2031) because links need `<a>` elements; the CSS accepts both (339). **No change needed**, it's just a note |
| To-do: tick sound, strike-through, Enter / Backspace / arrows, ×, max 30, 120 chars each | ✅ | `renderTodo()` 2039 |
| Calendar: header colour, ‹ ›, double-click month = today, locale week start, today highlight | ✅ | `renderCal()` 1872, `weekStart()` 1871 |
| Day pop-up: text (40), emoji (8 + none), "Circle this day"; list of 5 + "N more" | ✅ | `dayPop()` 1901 |
| Index card: ruled, red line, 6 colours, links, resizable, 300 chars | ✅ | `renderIdx()` 1960 |
| Piles: drop on a card; next (tuck), move by grip, spread, "N cards"; pull the top card off | ✅ | 1975–2012, `layoutPile()` 1950 |
| Labels: tape / washi / tag, colours, edit in place, resize, links, 40 chars | ✅ | `renderLabel()` 1579, `LOOKS` 1471 |
| Per-card font (5 system stacks) + default font in Settings → Cards | ✅ | `FONTS` 1418, `fontMenu()` 1432 |

## Pins and yarn

| Feature | Status | Where / notes |
|---|---|---|
| Yarn tool, top bar with 9 colours, "Remove all" (two-tap, section only), Done, Esc | ✅ | 2991–3008 |
| Pin on board (`s,x,y`) or in a card (`card,ox,oy`), follows the card and the shelf | ✅ | `pinAt()` 2939, `pinPos()` 2893 |
| Drag pin to pin to tie; drag to empty space makes a new pin | ✅ | `pinEvents()` 2950 |
| Sag, twisted texture, shadow | ✅ | `yPath()` 2901, `yarnDraw()` 2902 |
| Tap yarn to recolour or cut; tap pin to recolour or remove; drag pins when the tool is off | ✅ | `yarnPop()`, `pinPop()` |
| Screen-space overlay above the cards (z 60) | ✅ | `#yarn` 649 |
| Removing a card removes its pins and yarn | ✅ | `bye()` → `yarnClean()` 1124, 2931 |
| Deleting a **section** | ⚠️ | `deleteSection()` (2113) removes board pins of that section, but pins stuck in its cards stay in `board.json` until the next `mount()` → `yarnClean()`. They're invisible and harmless. It's an existing web behaviour, so I'm keeping it unless you want it fixed |

## Templates

| Feature | Status | Where / notes |
|---|---|---|
| Picker: name field, 6 built-ins, her own, double-click creates | ✅ | `TEMPLATES` 2573, `tplTile()` 2635 |
| Save section as template (notes/todo/cal/idx/piles/labels/stickers; no photos) | ✅ | `captureSection()` 2611 |
| Rename ✎, delete two-tap × | ✅ | 2644–2654 |
| From Settings → Board → Templates… and "+ Section" | ✅ | 2682, 2139 |

## Settings

| Feature | Status | Where / notes |
|---|---|---|
| Four tabs, arrow keys | ✅ | `showPane()` 2436 |
| General: sound, volume (preview sound on release), Motion | ✅ | 805–815 |
| General: folder info, switch folder, About | ⚠️ | In the code, **"Show folder…" is under Board → Storage** (845), not General. About is a footer under every tab (848). I'll keep the code layout. The text in that "Where is everything stored" view (853–866) is web-specific ("A web page can't open your file explorer…", "Open folder picker here"). See Question 2 in PLAN.md |
| Theme: 10 presets + Custom (colour, texture ×8, strength, text/tabs/buttons auto or colour) | ✅ | `THEMES` 2204, `customVars()` 2232 |
| Wallpaper photo + dim (0–80), 2560px display copy | ✅ | `renderWall()` 2341, `setWallUrl()` 2363 |
| Cards: frame, pin, note palette, default font, default label look | ✅ | `renderStyle()` 2397 |
| Board: sections with counts per type, Templates | ✅ | `renderSecList()` 2472 |

## Sound

✅ `sfx` module (929–1016): `land`, `lift`, `set`, `pop`, `tab`, `blip`, `warn`, `trash`, `tape`, `peel`, `shelf`, `flip`, `tick`, `glint`, `chime`, `chime2`, `sample`. It's all synthesised with Web Audio, using a seeded reverb, and there are no typing sounds. `delete data.keys` (3087) strips the old typing-sound setting from older boards.

⚠️ The `AudioContext` is created lazily on the first sound. With `autoplayPolicy: 'no-user-gesture-required'` the first sound plays immediately instead of being silently suspended.

## Performance

| Feature | Status | Where / notes |
|---|---|---|
| Display copies: WebP 640 / 1600 / 2560, a queue of 2, cached in `thumbs/` as `<name>@<px>.webp` | ✅ | 1151–1183 |
| `ResizeObserver` upgrades to the sharper copy | ✅ | `bindImg()` 1186 |
| Originals never shown on cards (except GIF/SVG, or a card bigger than about 1760px) | ✅ | `thumbable()`, `pick()` in `bindImg` |
| No `backdrop-filter` | ✅ | (none in the CSS) |
| `will-change` only while moving; `contain: layout style` | ✅ | 645–646 |
| Thumbnail decode | ⚠️ | `createImageBitmap` + `OffscreenCanvas`, but it runs **on the main thread's task queue** (only the decode is off-thread). Moving it into a worker is a safe improvement |

## board.json: fields actually read and written

All the fields in the brief are present. There are also a few the brief doesn't list, which have to be kept as they are:

- `photos[].kind` is `'photo'` for new photos (2187); older boards have no `kind`.
- `photos[].id` equals the file name for photos, videos and PDFs (`id:name`). Strips use `'b…'` and stickers use `'k…'`. **Desktop code must not assume `id ≠ file`.**
- `photos[].files[4]` is for strips; `fileKey()` maps strip frames to `id#i`.
- `wallpaper{file,dim}`; wallpaper files are `photos/wallpaper-*.ext`.
- Shelved labels keep `sh` (3077).
- `data.zoom` is deleted when it's 1 (3088). `data.keys` is always deleted.
- File name prefixes: `sticker-`, `doc-`, `wallpaper-`, and none for photos and videos. The extension comes from the original name, or `.mp4`/`.jpg` if there isn't one.

## Web-platform APIs the app calls (the surface the desktop shim has to provide)

- `window.showDirectoryPicker({id, mode, startIn})`
- Directory handle: `name`, `getDirectoryHandle(n,{create})`, `getFileHandle(n,{create})`, `removeEntry(n)`, `isSameEntry(h)`, `requestPermission({mode})`
  - `getFileHandle` without `create` must **reject** when the file is missing. The thumb cache and the mount loop rely on this.
- File handle: `getFile()`, which returns a real `File` (used with `.text()`, `.arrayBuffer()`, `.size`, `.type`, `.name`, `createImageBitmap`, `URL.createObjectURL`), and `createWritable()`, then `write(string | Blob | File)` and `close()`
- `indexedDB` is used only for the remembered handle and is replaced in the app.
- `<input type="file">` works unchanged in Electron.
