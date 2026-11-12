#!/usr/bin/env node
// A stand-in for corkcal (native/calendar) in tests: answers the same commands from a JSON file (CORK_CAL_STATE):
// { status, calendars: [{id, title, color, source, writable, default}], events: [{id, eid, title, start, end, allDay, cal}] }
'use strict';
const fs = require('fs');
const file = process.env.CORK_CAL_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const out = v => process.stdout.write(JSON.stringify(v) + '\n');
const [cmd, a, b, ids] = process.argv.slice(2);
if (cmd === 'status') out({ status: state.status });
else if (cmd === 'request') {
  if (state.status === 'notDetermined') state.status = state.answer || 'authorized';
  fs.writeFileSync(file, JSON.stringify(state));
  out({ status: state.status });
} else if (state.status !== 'authorized') {
  out({ error: 'not allowed' });
  process.exitCode = 1;
} else if (cmd === 'calendars') out(state.calendars);
else if (cmd === 'add' || cmd === 'update') {
  const ev = JSON.parse(cmd === 'add' ? a : b);
  let e;
  if (cmd === 'update') {
    e = state.events.find(x => x.eid === a);
    if (!e) {
      out({ missing: true });
      return;
    }
  } else {
    state.n = (state.n || 0) + 1;
    e = { id: 'made' + state.n, eid: 'made' + state.n, cal: ev.cal || state.calendars.find(c => c.default).id };
    state.events.push(e);
  }
  Object.assign(e, { title: ev.title, start: ev.start, end: ev.end, allDay: ev.allDay });
  fs.writeFileSync(file, JSON.stringify(state));
  out({ eid: e.eid, calendar: (state.calendars.find(c => c.id === e.cal) || {}).title });
} else if (cmd === 'remove') {
  state.events = state.events.filter(x => x.eid !== a);
  fs.writeFileSync(file, JSON.stringify(state));
  out({ ok: true });
} else if (cmd === 'events') {
  const only = ids ? ids.split(',') : null;
  const col = id => (state.calendars.find(c => c.id === id) || {}).color;
  out(
    state.events
      .filter(e => e.end > +a && e.start < +b && (!only || only.includes(e.cal)))
      .map(e => ({ ...e, color: col(e.cal) }))
  );
} else {
  out({ error: 'unknown command' });
  process.exitCode = 1;
}
