# Corkboard

Corkboard is a cosy board for photos, videos, PDFs, notes, to-do lists, calendars, index cards, labels, stickers, pins and yarn. It works fully offline, and everything stays in a folder on your own computer.

## Download

**[Download Corkboard for Mac](https://github.com/gbylegaspi/corkboard/releases/latest)** (the `.dmg` file under Assets)

- Works on Apple Silicon and Intel Macs, with macOS 12 or later.
- There's nothing else to install.

## Install

1. Open the downloaded `Corkboard-…-mac-universal.dmg`.
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
- **Any screen size:** a board keeps the same layout on every screen. On a smaller or bigger screen, or in a smaller window, the whole board is shown smaller or bigger, so nothing shifts or overlaps.
- **Seeing your files:** **File → Show Board Folder in Finder**.
- **More boards:** **File → Open Board Folder…** opens another board folder, and **File → Recent Boards** switches between them.
- **Notes and cards:**
  - Sticky notes, to-do lists and index cards each have a **font** button.
  - In sticky notes, index cards and to-do lists, **⌘B** and **⌘I** make words bold or italic (also in the Edit menu).
  - Misspelled words are underlined; right-click one for suggestions. Turn it off in Settings → General → **Check spelling**.
  - The **rotate** handle tilts a note or card; double-click it to straighten.
  - Drag the **bottom edge** of a note or card to make it longer or shorter; double-click the edge to reset.
- **Calendars:** the calendar button on a calendar picks its look: **Month**, **Wide month**, **Mini month**, **Week** or **Tear-off day**.
- **Photos:** "add a caption" only shows while you point at a photo or video.
- **Pins:** polaroids and photo strips have no pin; stick one in with pins and yarn if you like. Calendars come with a real pin you can move, recolour or remove.
- **Tilt:** the **rotate** handle tilts polaroids and photo strips too; double-click it to straighten.
- **Videos:** Settings → General → **Videos** chooses whether videos play always, when you point at them, or only when you press play, and whether they play with sound. The speaker button on a video sets that video on its own.
- **Stacks:** drop a polaroid, photo strip, sticky note, to-do list or index card onto another to stack them. The stack button (**Spread out to look**, **Stack again**, **Unstack for good**) lays the cards out and gathers them back. Pins on stacked cards show as one pin on the stack.
- **To-do lists:** press ⌘A twice to select the whole list, then ⌘C copies it, Delete clears it, and pasting several lines adds one item per line.
- **Sections:** the button at the top left (or **⌘\\**) opens the sections sidebar. Click a section to go to it.
  - **+ New section** at the bottom adds one. The **+** on a section's row adds a section inside it, and those can have sections inside them too.
  - Drag a section onto another to put it inside, or between two to move it. The arrow next to a section hides or shows what's inside.
  - Double-click a name (or use ✎) to rename it. **×** deletes a section, together with everything inside it.
- **Title:** the big title at the top is the name of the section you're in. Click it to rename the section.
- **Toolbar:** Settings, pins and yarn, and zoom are at the top right.
- **Holding things still:** Settings → General → turn off **Cards lift and straighten when you point at them** to place things precisely.
- **Themes:** Settings → Theme → **Different theme for this section** gives the section you're looking at its own theme. Sections inside it use that theme too, unless they have their own.

## Updates

Choose **Help → Check for Updates…** (or **Corkboard → Check for Updates…**). Corkboard asks GitHub whether there's a newer version. This is the only time the app goes online, and only when you choose it.

If there's a newer version, click **Download…** to open its page. Open the new `.dmg`, drag Corkboard into Applications, and choose **Replace**. Your board and photos aren't touched, because they're stored outside the app. The first time you open the new version, you may need to click **Open Anyway** again (see Install).

## Where everything is stored

Your board is a normal folder on your Mac:

- On first launch it's `~/Library/Application Support/Corkboard/My Board`.
- **`photos/`** holds your original photos, videos, stickers and PDFs, copied in unchanged.
- **`thumbs/`** holds smaller copies so the board stays fast. They're safe to delete and are made again when needed.
- **`board.json`** holds the layout, notes, lists, calendars, pins and settings.

Back up the whole folder to keep everything safe. Removing the app doesn't delete your board. Nothing is sent anywhere. The app only goes online when you choose Check for Updates, and links you add to notes open in your web browser.

## Licences

Corkboard uses pdf.js (Apache 2.0), the Inter font (SIL OFL 1.1), heic-convert / heic-decode (ISC), libheif-js (LGPL-3.0), jpeg-js (BSD-3-Clause), pngjs (MIT) and Electron / Chromium. The full texts are in the app under **Help → Third-Party Licences**.
