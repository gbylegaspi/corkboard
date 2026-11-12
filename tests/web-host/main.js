// A bare Chromium window (Electron's) that opens the web version of Corkboard from a file, for the round-trip test.
// Network requests (the web file's Google Fonts link) are blocked so the test stays offline.
const { app, BrowserWindow, session } = require('electron');
if (process.env.WEB_USER_DATA) app.setPath('userData', process.env.WEB_USER_DATA);
app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: /^https?:/.test(d.url) }));
  const w = new BrowserWindow({ width: 1280, height: 860 });
  w.webContents.setAudioMuted(true);
  w.loadFile(process.env.WEB_FILE);
});
