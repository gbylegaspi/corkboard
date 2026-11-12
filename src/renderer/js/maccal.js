// v2.1: events from the Mac's Calendar app on calendar cards, fetched fresh (never saved in board.json). Day notes on a
// linked card become Calendar events too; only those events (their ids are kept on the notes) are ever changed or removed.
// Talks to the main process through window.corkNative (src/main/calendar.js → the corkcal helper).
import { pad2 } from './util.js';

const N = () => window.corkNative;

// is the link offered at all (macOS app with the helper), and what macOS has answered about access
let infoP = null;
export function supported() {
  return !!(N() && N().calInfo && N().platform === 'darwin');
}
export function info(fresh) {
  if (!supported()) return Promise.resolve({ available: false, status: 'unavailable' });
  if (fresh || !infoP)
    infoP = N()
      .calInfo()
      .catch(() => ({ available: false, status: 'unavailable' }));
  return infoP;
}
// asks for access (macOS shows its prompt the first time); returns the new status
export async function requestAccess() {
  const status = await N().calRequest();
  infoP = Promise.resolve({ available: true, status });
  return status;
}
export function calendars() {
  return N().calCalendars();
}
export function openPrivacySettings() {
  return N().calSettings();
}

// the card's choice: c.mac === true (all calendars) or a list of calendar ids
export function cleanChoice(v) {
  if (v === true) return true;
  if (!Array.isArray(v)) return undefined;
  const ids = v.filter(s => typeof s === 'string' && s && s.length <= 300 && !s.includes(',')).slice(0, 200);
  return ids;
}

export function dayKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// events between two dates, grouped by day: { 'YYYY-MM-DD': [event, …] } (an event over several days is on each)
export async function eventsByDay(from, to, choice) {
  const list = await N().calEvents(+from, +to, choice === true ? null : choice);
  const by = {};
  for (const e of list) {
    if (!e || !Number.isFinite(e.start) || !Number.isFinite(e.end)) continue;
    const d = new Date(Math.max(e.start, +from));
    d.setHours(0, 0, 0, 0);
    const end = Math.min(Math.max(e.end, e.start + 1), +to);
    for (let n = 0; +d < end && n < 400; n++) {
      (by[dayKey(d)] = by[dayKey(d)] || []).push(e);
      d.setDate(d.getDate() + 1);
    }
  }
  return { by, sig: JSON.stringify(list.map(e => [e.id, e.title, e.start, e.end, e.color, e.allDay])) };
}

// "9:30 Dentist", or just the title for all-day events
export function timeOf(e) {
  return e.allDay ? '' : new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function label(e) {
  const t = timeOf(e);
  return (t ? t + ' ' : '') + (e.title || 'Event');
}
// a calendar colour from the helper, or a soft grey
export function colourOf(e) {
  return /^#[0-9a-f]{6}$/i.test(e && e.color) ? e.color : '#8a8178';
}

// a day note as a Calendar event: all-day, or an hour from its time (tm: "HH:MM"); the day's sticker leads the title
export function noteEvent(key, note, cal) {
  const [y, m, d] = key.split('-').map(Number);
  const title = ((note.e ? note.e + ' ' : '') + note.t.trim()).slice(0, 200);
  const tm = /^(\d{2}):(\d{2})$/.exec(note.tm || '');
  const start = tm ? new Date(y, m - 1, d, +tm[1], +tm[2]) : new Date(y, m - 1, d);
  const end = tm ? new Date(+start + 3600000) : new Date(y, m - 1, d, 23, 59, 59);
  const ev = { title, start: +start, end: +end, allDay: !tm };
  if (cal) ev.cal = cal;
  return ev;
}
// adds the note's event, or changes the one it already made (adding it again if that was deleted in Calendar);
// returns { eid, added: the calendar's name when a new event was made }
export async function writeNote(key, note, cal) {
  const ev = noteEvent(key, note, cal);
  if (note.ev) {
    const r = await N().calUpdate(note.ev, ev);
    if (r && !r.missing) return { eid: r.eid || note.ev, added: null };
  }
  const r = await N().calAdd(ev);
  return { eid: (r && r.eid) || null, added: (r && r.calendar) || 'Calendar' };
}
// a line in the diagnostic log (decisions only; never note text)
export function logLine(msg) {
  try {
    N()
      .calLog(msg)
      .catch(() => {});
  } catch (e) {}
}
export function removeEvent(eid) {
  return N().calRemove(eid);
}
