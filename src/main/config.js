// App settings that belong to the computer, not to a board: recent board folders and the window's size.
// Stored as JSON in the app's userData folder (never in the board folder, never in the browser's storage).
'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const MAX_RECENT = 8;
let cache = null;

function file() { return path.join(app.getPath('userData'), 'config.json'); }
function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch (e) { cache = {}; }
  if (!cache || typeof cache !== 'object') cache = {};
  if (!Array.isArray(cache.recent)) cache.recent = [];
  cache.recent = cache.recent.filter(p => typeof p === 'string' && path.isAbsolute(p)).slice(0, MAX_RECENT);
  return cache;
}
let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(saveNow, 200);
}
function saveNow() {
  clearTimeout(timer); timer = null;
  if (!cache) return;
  const f = file(), tmp = f + '.tmp';
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(tmp, JSON.stringify(cache, null, 1)); fs.renameSync(tmp, f); } catch (e) { /* not fatal */ }
}

function recent() { return load().recent.slice(); }
function addRecent(p) { const c = load(); c.recent = [p].concat(c.recent.filter(q => q !== p)).slice(0, MAX_RECENT); save(); }
function removeRecent(p) { const c = load(); c.recent = c.recent.filter(q => q !== p); save(); }
function clearRecent() { load().recent = []; save(); }
function get(key) { return load()[key]; }
function set(key, value) { load()[key] = value; save(); }

module.exports = { recent, addRecent, removeRecent, clearRecent, get, set, saveNow };
