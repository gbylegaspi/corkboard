# Corkboard

Corkboard is a cosy board for photos, videos, PDFs, notes, to-do lists, calendars, index cards, labels, stickers, pins and yarn. It works fully offline, and everything stays in a folder on your own computer.

## Download

**[Download Corkboard for Mac](https://github.com/gbylegaspi/corkboard/releases/latest)** (`Corkboard-1.6.3-mac-universal.dmg`)

- Works on Apple Silicon and Intel Macs, with macOS 12 or later.
- There's nothing else to install.

## Install

1. Open `Corkboard-1.6.3-mac-universal.dmg`.
2. Drag **Corkboard** into **Applications**.
3. Open Corkboard from Applications.

**The first time only:** Corkboard isn't signed with an Apple Developer ID, so macOS says it can't verify it.

1. Click **Done** (not "Move to Bin").
2. Open **System Settings → Privacy & Security**, scroll down to the message about Corkboard, and click **Open Anyway**.
3. Confirm with your password or Touch ID.

After that it opens normally. On macOS 14 and earlier you can instead right-click Corkboard in Applications, then choose **Open → Open**.

If macOS says the app "is damaged", that's only the download's quarantine flag. Clear it once in Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/Corkboard.app
```

## Using it

- **First launch:** nothing to set up. Corkboard makes its own board and opens it. Later launches go straight back to your board.
- **Adding things:** drag photos, videos or PDFs from Finder onto the window, or use **+ Add** in the bottom-right corner.
  - iPhone photos (HEIC) are turned into JPEGs, and the original is kept.
  - iPhone videos play as they are.
- **Zoom:** ⌘− and ⌘+ zoom the board out and back in (35–100%). ⌘0 returns to 100%.
- **Seeing your files:** **File → Show Board Folder in Finder**.
- **More boards:** **File → Open Board Folder…** opens another board folder, and **File → Recent Boards** switches between them.

## Where everything is stored

Your board is a normal folder on your Mac:

- On first launch it's `~/Library/Application Support/Corkboard/My Board`.
- **`photos/`** holds your original photos, videos, stickers and PDFs, copied in unchanged.
- **`thumbs/`** holds smaller copies so the board stays fast. They're safe to delete and are made again when needed.
- **`board.json`** holds the layout, notes, lists, calendars, pins and settings.

Back up the whole folder to keep everything safe. Removing the app doesn't delete your board. Nothing is sent anywhere: the app makes no internet connections, and links you add to notes open in your web browser.

## Web version

`corkboard v1.6.3.html` is the same board as a single web page, for Chrome or Edge on a computer. Boards move freely between the app and the web version: open the same folder in either one.

## Licences

Corkboard uses pdf.js (Apache 2.0), the Inter font (SIL OFL 1.1), heic-convert / heic-decode (ISC), libheif-js (LGPL-3.0), jpeg-js (BSD-3-Clause), pngjs (MIT) and Electron / Chromium. The full texts are in the app under **Help → Third-Party Licences**.
