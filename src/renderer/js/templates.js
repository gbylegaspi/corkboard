// Built-in templates for new sections (layouts of notes, cards, labels and lists).
import { IDX_COLS } from './catalog.js';
import { jit } from './util.js';

// ---- v1.4: templates for new sections: built-in layouts plus her own (data.templates [{id,name,items:[{k,o}]}]) ----
export function T_L(text, look, c, x, y, rot) {
  return { k: 'label', o: { text: text, look: look, c: c, x: x, y: y, rot: rot } };
}

export function T_N(o) {
  return { k: 'note', o: o };
}

export function T_I(text, c, x, y, rot, pile, po) {
  var o = { kind: 'idx', text: text, c: c, x: x, y: y, rot: rot };
  if (pile) {
    o.pile = pile;
    o.po = po;
  }
  return T_N(o);
}

export function T_D(items, c, x, y, rot) {
  return T_N({
    kind: 'todo',
    c: c,
    x: x,
    y: y,
    rot: rot,
    items: items.map(function (t) {
      return { t: t, d: false };
    })
  });
}

export const TEMPLATES = [
  { id: 'blank', name: 'Blank', emoji: '✨', desc: 'An empty section', items: [] },
  {
    id: 'trip',
    name: 'Trip',
    emoji: '✈️',
    desc: 'Packing list, calendar, places to see, travel cards',
    items: [
      T_L('OUR TRIP', 'tape', '#2456b5', 0.04, 180, -2),
      T_N({ kind: 'cal', c: '#2456b5', x: 0.03, y: 240, rot: -1.5, days: {} }),
      T_D(['Passports', 'Chargers', 'Sunscreen', 'Camera', 'Tickets'], '#cdeed6', 0.3, 200, 2),
      T_N({ text: 'Places we want to see:\n• \n• \n• ', c: '#fff2a8', x: 0.52, y: 215, rot: -3 }),
      T_I('Flights ✈️\n', '#e2eefc', 0.72, 205, 1, 't1', 0),
      T_I('Hotel 🏨\n', '#fffefa', 0.72, 205, 1, 't1', 1),
      T_I('Budget 💶\n', '#fdf3c7', 0.72, 205, 1, 't1', 2),
      T_L('memories from the trip', 'washi', '#a9c6ee', 0.32, 520, -1.5)
    ]
  },
  {
    id: 'bday',
    name: 'Birthday',
    emoji: '🎂',
    desc: 'Party to-dos, wish list, calendar',
    items: [
      T_L('Happy birthday! 🎂', 'washi', '#f4b3c6', 0.05, 180, -2),
      T_D(
        ['Order the cake', 'Book a table', 'Wrap the present', 'Write a card', 'Invite friends'],
        '#ffd9e0',
        0.06,
        240,
        2
      ),
      T_N({ text: 'Wish list ✨\n• \n• ', c: '#fff2a8', x: 0.3, y: 215, rot: -2.5 }),
      T_N({ kind: 'cal', c: '#d0457f', x: 0.52, y: 200, rot: 1.5, days: {} }),
      T_L('party plans', 'tag', '#f3d3d8', 0.3, 450, 3)
    ]
  },
  {
    id: 'dates',
    name: 'Date ideas',
    emoji: '❤️',
    desc: 'A pile of date-night idea cards to flip through',
    items: [T_L('Date night ideas ❤️', 'tag', '#f3d3d8', 0.05, 180, -2)].concat(
      [
        'Picnic at sunset 🧺',
        'Cook something new together 🍝',
        'Stargazing night ✨',
        'Movie marathon & blankets 🎬',
        'Museum or gallery day 🖼️',
        'Breakfast in bed ☕'
      ].map(function (t, i) {
        return T_I(t, IDX_COLS[i % IDX_COLS.length], 0.06, 250, -1.5, 'd1', i);
      }),
      [
        T_L('done together ✓', 'washi', '#9fd8c4', 0.4, 190, 1.5),
        T_D(['', ''], '#cdeed6', 0.4, 240, -2),
        T_N({ text: 'More ideas…', c: '#d3e4ff', x: 0.65, y: 220, rot: 2.5 })
      ]
    )
  },
  {
    id: 'year',
    name: 'Our year',
    emoji: '🗓️',
    desc: 'Calendar, goals and a pile of highlights',
    items: [
      T_L('OUR YEAR', 'tape', '#c8312f', 0.04, 180, -1.5),
      T_N({ kind: 'cal', c: '#c8312f', x: 0.03, y: 240, rot: -1, days: {} }),
      T_D(
        ['Take a trip together', 'Learn something new', 'Try 10 new restaurants', 'Make a photo book'],
        '#fff2a8',
        0.3,
        210,
        2
      ),
      T_I('Highlights ✨\n', '#fffefa', 0.52, 215, -2, 'y1', 0),
      T_I('\n', '#fdf3c7', 0.52, 215, -2, 'y1', 1),
      T_L('favourite memories', 'washi', '#c8b5ea', 0.74, 195, 2),
      T_N({ text: '', c: '#ffd9e0', x: 0.74, y: 250, rot: -2 })
    ]
  },
  {
    id: 'week',
    name: 'Week planner',
    emoji: '📝',
    desc: 'An index card for each day, plus groceries',
    items: [T_L('THIS WEEK', 'tape', '#2c7a4b', 0.04, 180, -1.5)].concat(
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(function (d, i) {
        return T_I(
          d + '\n',
          IDX_COLS[i % IDX_COLS.length],
          0.03 + (i % 4) * 0.235,
          235 + Math.floor(i / 4) * 190,
          jit(d, 4) - 2
        );
      }),
      [T_D(['', '', ''], '#cdeed6', 0.74, 440, 2), T_L('groceries', 'washi', '#9fd8c4', 0.75, 405, -2)]
    )
  }
];
