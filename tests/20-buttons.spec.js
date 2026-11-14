// 20. No overlapping buttons: every kind of item, at small, normal and large sizes, hovered so its buttons show.
// Any two visible controls on the same item that overlap (by more than a sliver) fail the test, with their names.
const { test } = require('@playwright/test');
const h = require('./helpers');
const fx = require('./fixtures');

const CONTROLS = '.cb, .rze, .calnav, .tdx, .tdadd, .pcount, .pgn, input.cap, .film input, .lbar button';
const now = new Date(),
  ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

// one of everything; stacks of notes and of polaroids; calendars in each look
function items(sc) {
  const base = (i, extra) => ({
    s: 's1',
    x: 0.04 + (i % 4) * 0.24,
    y: 200 + Math.floor(i / 4) * 520,
    rot: 0,
    z: i + 1,
    ...(sc === 1 ? {} : { sc }),
    ...extra
  });
  const photos = [
    base(0, { id: 'p.png', file: 'p.png', kind: 'photo', mode: 'square', caption: '' }),
    base(1, { id: 'q.png', file: 'q.png', kind: 'photo', mode: 'original', bare: true, hold: 'pin', caption: '' }),
    base(2, { id: 'st', kind: 'strip', files: ['a.png', 'b.png', 'c.png', 'd.png'], caption: '' }),
    base(3, { id: 'v.mp4', file: 'v.mp4', kind: 'video', ar: 1.78, caption: '' }),
    base(4, { id: 'k.png', file: 'k.png', kind: 'sticker', ar: 1 }),
    base(5, { id: 'd.pdf', file: 'd.pdf', kind: 'doc', n: 5, pg: 0, ar: 0.707 }),
    base(6, { id: 'r1.png', file: 'r1.png', kind: 'photo', mode: 'square', pile: 'pp', po: 0 }),
    base(6, { id: 'r2.png', file: 'r2.png', kind: 'photo', mode: 'square', pile: 'pp', po: 1, z: 40 })
  ];
  const notes = [
    base(7, { id: 'n', c: '#fff2a8', text: 'note' }),
    base(8, {
      id: 't',
      kind: 'todo',
      c: '#cdeed6',
      items: [
        { t: 'one', d: false },
        { t: 'two', d: true }
      ]
    }),
    base(9, { id: 'i', kind: 'idx', c: '#fffefa', text: 'card' }),
    base(10, { id: 'm1', c: '#ffd9e0', text: 'a', pile: 'pn', po: 0 }),
    base(10, { id: 'm2', kind: 'idx', c: '#fffefa', text: 'b', pile: 'pn', po: 1, z: 41 }),
    ...['month', 'wide', 'mini', 'week', 'day'].map((look, j) =>
      base(11 + j, { id: 'c-' + look, kind: 'cal', c: '#c8312f', ym, days: {}, ...(look === 'month' ? {} : { look }) })
    )
  ];
  const labels = [base(16, { id: 'l1', text: 'LABEL', look: 'tape', c: '#1f1f1f' })];
  return { title: 'T', cur: 's1', sections: [{ id: 's1', name: 'One' }], photos, notes, labels };
}

async function overlaps(page, el) {
  return el.evaluate((card, sel) => {
    const vis = e => {
      const s = getComputedStyle(e),
        r = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.5 && r.width > 1 && r.height > 1;
    };
    const name = e => e.className.baseVal || e.className || e.tagName;
    const els = [...card.querySelectorAll(sel)].filter(vis);
    const out = [];
    for (let i = 0; i < els.length; i++)
      for (let j = i + 1; j < els.length; j++) {
        if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
        const a = els[i].getBoundingClientRect(),
          b = els[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left),
          hh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && hh > 2) out.push(name(els[i]) + ' × ' + name(els[j]));
      }
    return out;
  }, CONTROLS);
}

for (const sc of [0.5, 1, 2]) {
  test(`no overlapping buttons at size ${sc}`, async () => {
    const files = {
      'p.png': fx.photoSmall(1),
      'q.png': fx.photoSmall(2),
      'r1.png': fx.photoSmall(3),
      'r2.png': fx.photoSmall(4),
      'k.png': fx.sticker(),
      'd.pdf': fx.pdf5(),
      'v.mp4': fx.video('h264', 'mp4')
    };
    ['a', 'b', 'c', 'd'].forEach((n, i) => (files[n + '.png'] = fx.photoSmall(5 + i)));
    const ctx = h.newBoard({ files, data: items(sc) });
    const page = await h.launch(ctx);
    try {
      const found = [];
      const ids = await page.$$eval('#layer .card', a =>
        a.filter(c => !c.classList.contains('inpile') || c.classList.contains('ptop')).map(c => c._p.id)
      );
      for (const id of ids) {
        const el = await h.card(page, id);
        await el.scrollIntoViewIfNeeded();
        const b = await el.boundingBox();
        await page.mouse.move(5, 5);
        await page.waitForTimeout(150);
        // point at the middle of the card (labels: their text), then let the buttons fade in
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(600);
        for (const o of await overlaps(page, el)) found.push(id + ': ' + o);
      }
      h.expect(found, 'overlapping controls at size ' + sc).toEqual([]);
      h.expect(ctx.errors).toEqual([]);
    } finally {
      await h.close(ctx);
    }
  });
}
