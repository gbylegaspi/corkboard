// The link to the Mac's Calendar app. Runs the bundled helper (native/calendar → corkcal), which uses Apple's EventKit,
// and returns what it prints. It reads events, and adds, changes or removes the events Corkboard made from day notes.
// Nothing leaves the Mac. Tests swap in a stand-in helper
// with CORK_CAL_HELPER.
'use strict';
const { app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function helper() {
  if (process.env.CORK_CAL_HELPER) return process.env.CORK_CAL_HELPER;
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bin', 'corkcal')
    : path.join(__dirname, '..', '..', 'build', 'bin', 'corkcal');
}

// a short diagnostic log (userData/logs/calendar.log): each command and how it went, never titles or note text
const LOG_MAX = 256 * 1024;
function log(line) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs'),
      f = path.join(dir, 'calendar.log');
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(f) && fs.statSync(f).size > LOG_MAX) fs.renameSync(f, f + '.1');
    fs.appendFileSync(f, new Date().toISOString() + ' ' + line + '\n');
  } catch (e) {}
}

function run(args, timeout) {
  const t0 = Date.now(),
    what = args[0] + (args[0] === 'update' || args[0] === 'remove' ? ' ' + args[1] : '');
  return new Promise((resolve, reject) => {
    execFile(helper(), args, { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      let out;
      try {
        out = JSON.parse(String(stdout).trim());
      } catch (e) {
        log(
          `${what}: no answer after ${Date.now() - t0} ms (${err ? err.code || err.signal || err.message : 'empty'}) ${String(stderr).slice(0, 300).replace(/\s+/g, ' ')}`
        );
        return reject(err || new Error('The Calendar link gave no answer'));
      }
      if (out && out.error) {
        log(`${what}: error after ${Date.now() - t0} ms: ${out.error}`);
        return reject(new Error(out.error));
      }
      const summary = Array.isArray(out)
        ? out.length + ' items'
        : JSON.stringify(out)
            .replace(/"title":"[^"]*"/g, '"title":…')
            .slice(0, 200);
      log(`${what}: ok after ${Date.now() - t0} ms: ${summary}`);
      resolve(out);
    });
  });
}

// { available, status }: available = this Mac can run the helper; status = macOS's answer for calendar access
async function info() {
  if (process.platform !== 'darwin' || !fs.existsSync(helper())) return { available: false, status: 'unavailable' };
  try {
    return { available: true, status: (await run(['status'], 10000)).status };
  } catch (e) {
    return { available: false, status: 'unavailable' }; // e.g. an Intel Mac on macOS 12 (see build-calendar-helper.js)
  }
}

// asks for access (macOS shows its prompt the first time); waits for her answer
async function request() {
  return (await run(['request'], 5 * 60 * 1000)).status;
}

async function calendars() {
  const list = await run(['calendars'], 15000);
  return Array.isArray(list) ? list : [];
}

// events between two times (ms), from some calendars (ids) or all (none given)
async function events(from, to, ids) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 400 * 86400000) {
    throw new TypeError('A range of up to 400 days is needed.');
  }
  const list = Array.isArray(ids)
    ? ids.filter(s => typeof s === 'string' && s && s.length <= 300 && !s.includes(',')).slice(0, 200)
    : [];
  if (Array.isArray(ids) && !list.length) return [];
  const out = await run(['events', String(Math.round(from)), String(Math.round(to)), list.join(',')], 20000);
  return Array.isArray(out) ? out : [];
}

// an event from a day note: { title, start, end, allDay, cal? } (times in ms)
function eventJson(ev) {
  const o = ev && typeof ev === 'object' ? ev : {};
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 200) : '';
  if (
    !title ||
    !Number.isFinite(o.start) ||
    !Number.isFinite(o.end) ||
    o.end < o.start ||
    o.end - o.start > 7 * 86400000
  ) {
    throw new TypeError('An event needs a title, a start and an end.');
  }
  const out = { title, start: Math.round(o.start), end: Math.round(o.end), allDay: o.allDay === true };
  if (typeof o.cal === 'string' && o.cal && o.cal.length <= 300) out.cal = o.cal;
  return JSON.stringify(out);
}
function eventId(eid) {
  if (typeof eid !== 'string' || !eid || eid.length > 500) throw new TypeError('An event id is needed.');
  return eid;
}
async function add(ev) {
  return run(['add', eventJson(ev)], 20000);
}
async function update(eid, ev) {
  return run(['update', eventId(eid), eventJson(ev)], 20000);
}
async function remove(eid) {
  return run(['remove', eventId(eid)], 20000);
}

module.exports = { info, request, calendars, events, add, update, remove, log };
