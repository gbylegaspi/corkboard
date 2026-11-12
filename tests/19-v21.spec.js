// 19. Version 2.1: events from the Mac's Calendar app on calendar cards (read-only). A stand-in for the corkcal
// helper (tests/tools/fake-corkcal.js) plays the Calendar app, so no real calendars or permission prompts are involved.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const now = new Date(),
  Y = now.getFullYear(),
  M = now.getMonth();
const ym = Y + '-' + String(M + 1).padStart(2, '0');
const at = (d, hh = 0, mm = 0) => new Date(Y, M, d, hh, mm).getTime();
const day = d => `#layer .card.cal .cald:nth-child(${d + lead()})`;
let leadDays = 0;
const lead = () => leadDays;

function fakeCalendar(ctx, status, answer) {
  const file = path.join(ctx.tmp, 'calendar.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      status,
      answer,
      calendars: [
        { id: 'home', title: 'Home', color: '#d6264f', source: 'iCloud', writable: true, default: true },
        { id: 'work', title: 'Work', color: '#2456b5', source: 'Google', writable: true, default: false }
      ],
      events: [
        {
          id: 'e1',
          eid: 'e1',
          title: 'Dentist',
          start: at(10, 9, 30),
          end: at(10, 10, 30),
          allDay: false,
          cal: 'home'
        },
        { id: 'e2', eid: 'e2', title: 'Offsite', start: at(12), end: at(14) - 1, allDay: true, cal: 'work' }
      ]
    })
  );
  process.env.CORK_CAL_HELPER = path.join(__dirname, 'tools', 'fake-corkcal.js');
  process.env.CORK_CAL_STATE = file;
  return file;
}
test.afterEach(() => {
  delete process.env.CORK_CAL_HELPER;
  delete process.env.CORK_CAL_STATE;
});
const board = () => ({
  title: 'T',
  cur: 's1',
  sections: [{ id: 's1', name: 'One' }],
  notes: [{ id: 'c', kind: 'cal', s: 's1', x: 0.3, y: 220, rot: 0, z: 1, c: '#c8312f', ym, days: {} }]
});

test('link a calendar card to the Calendar app; pick calendars; events refresh', async () => {
  const ctx = h.newBoard({ data: board() });
  const state = fakeCalendar(ctx, 'notDetermined');
  const page = await h.launch(ctx);
  try {
    const cel = await h.card(page, 'c');
    leadDays = await cel.$$eval('.calg > span', a => a.length);
    // not linked yet: no events
    h.expect(await page.locator('.cald .cme').count()).toBe(0);
    // the Calendar app button → switch on → macOS is asked (here: the stand-in says yes)
    await h.buttonBox(page, cel, 'cmac');
    await (await cel.$('.cb.cmac')).click();
    await page.locator('.pop .cmacp label.trow input').click();
    let d = await h.saved(ctx, d => d.notes[0].mac === true);
    h.expect(JSON.parse(fs.readFileSync(state, 'utf8')).status).toBe('authorized');
    await h.expect(page.locator('.pop .cmrow')).toHaveCount(2);
    // the events show on their days (the all-day event on both of its days), and in the list under the month
    await h.expect(page.locator(day(10) + ' .cme b')).toHaveCount(1);
    h.expect(await page.getAttribute(day(10), 'title')).toContain('Dentist');
    await h.expect(page.locator(day(12) + ' .cme b')).toHaveCount(1);
    await h.expect(page.locator(day(13) + ' .cme b')).toHaveCount(1);
    await h.expect(page.locator(day(14) + ' .cme b')).toHaveCount(0);
    h.expect(await cel.$eval('.call', e => e.textContent)).toContain('Dentist');
    // only the Home calendar
    await page.locator('.pop .cmrow', { hasText: 'Work' }).locator('input').click();
    d = await h.saved(ctx, d => Array.isArray(d.notes[0].mac));
    h.expect(d.notes[0].mac).toEqual(['home']);
    await h.expect(page.locator(day(12) + ' .cme b')).toHaveCount(0);
    await h.expect(page.locator(day(10) + ' .cme b')).toHaveCount(1);
    await page.keyboard.press('Escape');
    // a day's pop-up lists its events
    await page.click(day(10));
    await h.expect(page.locator('.pop .cpev')).toContainText('Dentist');
    await page.keyboard.press('Escape');
    // a new event in the Calendar app shows up when the window comes back to the front
    const s = JSON.parse(fs.readFileSync(state, 'utf8'));
    s.events.push({ id: 'e3', title: 'Dinner', start: at(20, 19), end: at(20, 21), allDay: false, cal: 'home' });
    fs.writeFileSync(state, JSON.stringify(s));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await h.expect(page.locator(day(20) + ' .cme b')).toHaveCount(1);
    // the week look shows them as lines
    await cel.evaluate((e, dy) => (e._p.dy = dy), ym + '-10'); // (the week with the 10th in it)
    await cel.hover();
    await page.waitForTimeout(450);
    await (await cel.$('.cb.clook')).click();
    await page.locator('.pop .pi', { hasText: /^Week$/ }).click();
    await h.expect(page.locator('#layer .card.cal .calwd .cwe')).toContainText('Dentist');
    // nothing about the events themselves is saved in the board
    d = await h.saved(ctx);
    h.expect(JSON.stringify(d)).not.toContain('Dentist');
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('access refused: the card stays unlinked and points to Privacy settings', async () => {
  const ctx = h.newBoard({ data: board() });
  fakeCalendar(ctx, 'notDetermined', 'denied');
  const page = await h.launch(ctx);
  try {
    const cel = await h.card(page, 'c');
    await cel.hover();
    await page.waitForTimeout(450);
    await (await cel.$('.cb.cmac')).click();
    await page.locator('.pop .cmacp label.trow input').click();
    await h.expect(page.locator('.pop .cmacp .sbtn', { hasText: 'Open Privacy Settings' })).toBeVisible();
    h.expect(await page.locator('.pop .cmacp label.trow input').isChecked()).toBe(false);
    h.expect(h.readBoard(ctx).notes[0].mac).toBeUndefined();
    await page.locator('.pop .cmacp .sbtn').click();
    await page.waitForTimeout(300);
    h.expect(await ctx.app.evaluate(() => global.__external)).toEqual([
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars'
    ]);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});

test('day notes on a linked card go to the Calendar app, and follow changes', async () => {
  const data = board();
  data.notes[0].mac = true;
  const ctx = h.newBoard({ data });
  const state = fakeCalendar(ctx, 'authorized');
  const cal = () => JSON.parse(fs.readFileSync(state, 'utf8')).events;
  const page = await h.launch(ctx);
  try {
    const cel = await h.card(page, 'c');
    leadDays = await cel.$$eval('.calg > span', a => a.length);
    await h.expect(page.locator(day(10) + ' .cme b')).toHaveCount(1); // the Dentist, from Calendar
    // write on the 15th: once the pop-up closes, it's an all-day event in the default calendar (Home)
    await page.click(day(15));
    await page.locator('.pop input.lki').fill('Mum\u2019s birthday');
    await page.locator('.pop .cale button', { hasText: '🎂' }).click();
    await page.keyboard.press('Escape');
    await h.expect.poll(() => cal().filter(e => e.eid.startsWith('made')).length).toBe(1);
    await h.expect(page.locator('.toast')).toContainText('Added to the Calendar app (Home)');
    let made = cal().find(e => e.eid.startsWith('made'));
    h.expect(made).toMatchObject({ title: '🎂 Mum\u2019s birthday', allDay: true, cal: 'home', start: at(15) });
    await h.saved(ctx, d => d.notes[0].days[ym + '-15'] && d.notes[0].days[ym + '-15'].ev === made.eid);
    // it isn't shown twice: the note is on the day, its own event isn't added as a dot
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(500);
    await h.expect(page.locator(day(15) + ' .cme b')).toHaveCount(0);
    // a time: the event becomes an hour long; a new wording renames it
    await page.click(day(15));
    await page.locator('.pop input.ctime').fill('19:30');
    await page.locator('.pop input.lki').fill('Birthday dinner');
    await page.keyboard.press('Escape');
    await h.expect.poll(() => cal().find(e => e.eid === made.eid).title).toBe('🎂 Birthday dinner');
    made = cal().find(e => e.eid === made.eid);
    h.expect(made).toMatchObject({ allDay: false, start: at(15, 19, 30), end: at(15, 20, 30) });
    // notes can go to another calendar
    await cel.hover();
    await page.waitForTimeout(450);
    await (await cel.$('.cb.cmac')).click();
    await page.locator('.pop .cmacp select').selectOption('work');
    await h.saved(ctx, d => d.notes[0].macTo === 'work');
    await page.keyboard.press('Escape');
    await page.click(day(16));
    await page.locator('.pop input.lki').fill('Standup');
    await page.keyboard.press('Escape');
    await h.expect.poll(() => (cal().find(e => e.title === 'Standup') || {}).cal).toBe('work');
    // removing the note removes its event; the Dentist (made in Calendar) is never touched
    await page.click(day(15));
    await page.locator('.pop input.lki').fill('');
    await page.locator('.pop .cale button', { hasText: '–' }).click();
    await page.keyboard.press('Escape');
    await h.expect.poll(() => cal().some(e => e.eid === made.eid)).toBe(false);
    await h.saved(ctx, d => !d.notes[0].days[ym + '-15']);
    h.expect(
      cal()
        .map(e => e.title)
        .sort()
    ).toEqual(['Dentist', 'Offsite', 'Standup']);
    h.expect(ctx.errors).toEqual([]);
  } finally {
    await h.close(ctx);
  }
});
