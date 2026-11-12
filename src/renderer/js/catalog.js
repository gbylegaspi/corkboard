// Fixed lists the app offers: themes, textures, fonts, label looks, filters, colours, calendar looks, limits.

// ---- filters: stored as numbers in board.json, shown with CSS filters + overlay layers (originals untouched) ----
export const FX_PRESETS = [
  { id: 'none', name: 'Original' },
  { id: 'golden', name: 'Golden', w: 45, s: 15, b: 4 },
  { id: 'vivid', name: 'Vivid', s: 45, c: 18 },
  { id: 'cool', name: 'Cool', w: -45, b: 3, c: 4 },
  { id: 'film', name: 'Faded film', fd: 45, c: -10, s: -15, w: 10, g: 30 },
  { id: 'vintage', name: 'Vintage', w: 30, fd: 30, s: -25, v: 40, g: 25 },
  { id: 'dreamy', name: 'Dreamy', b: 10, fd: 25, s: -10, w: 15, c: -15 },
  { id: 'bw', name: 'B&W', mono: 'bw', c: 15 },
  { id: 'noir', name: 'Noir', mono: 'bw', c: 45, b: -5, v: 45, g: 20 },
  { id: 'sepia', name: 'Sepia', mono: 'sepia', c: 5, fd: 10 }
];

export const FX_SL = [
  { k: 'b', n: 'Brightness', min: -100 },
  { k: 'c', n: 'Contrast', min: -100 },
  { k: 's', n: 'Saturation', min: -100 },
  { k: 'w', n: 'Warmth', min: -100 },
  { k: 'fd', n: 'Fade', min: 0 },
  { k: 'v', n: 'Vignette', min: 0 },
  { k: 'g', n: 'Grain', min: 0 }
];

// v2.0: Settings → Videos (data.video: {play: 'always' | 'hover' | 'click', sound: true}; the defaults are left out)
export const VPLAY = ['always', 'hover', 'click'];

// ---- v1.1.6: fonts for captions and labels (system fonts that ship with Windows and macOS; each style lists both) ----
export const FONTS = [
  { id: 'hand', name: 'Handwritten', ff: '"Bradley Hand","Segoe Print","Noteworthy","Ink Free",cursive', z: 1.04 },
  { id: 'type', name: 'Typewriter', ff: '"American Typewriter","Courier New",Courier,monospace', z: 1 },
  { id: 'sans', name: 'Clean sans', ff: '"Avenir Next","Segoe UI","Helvetica Neue",Arial,sans-serif', z: 1 },
  { id: 'serif', name: 'Serif', ff: 'Georgia,"Times New Roman",serif', z: 1.02 },
  { id: 'marker', name: 'Marker', ff: '"Marker Felt","Ink Free","Segoe Print",cursive', z: 1.06 }
];

export const BODY_FF = '"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

// ---- v1.1.6: labels (label-maker tape, washi tape or a handwritten tag), stored in data.labels ----
export const LOOKS = [
  {
    id: 'tape',
    name: 'Label-maker tape',
    ph: 'LABEL',
    cols: ['#1f1f1f', '#c8312f', '#2456b5', '#2c7a4b', '#d0457f', '#6a43b0', '#1f7f86']
  },
  {
    id: 'washi',
    name: 'Washi tape',
    ph: 'write a label…',
    cols: ['#9fd8c4', '#f4b3c6', '#f2d77e', '#a9c6ee', '#c8b5ea', '#e3c39b'],
    pats: ['stripes', 'dots', 'grid', 'dots', 'stripes', 'plain']
  },
  {
    id: 'tag',
    name: 'Handwritten tag',
    ph: 'write a label…',
    cols: ['#d8bb8a', '#f6ecd6', '#fffdf8', '#f3d3d8', '#d4e2cf', '#d6e3f2']
  }
];

export const LABEL_MAX = 40;

export const WORD_MSG = 'Word files need saving as a PDF first: in Word choose File → Save As → PDF, then add the PDF';

// ---- v1.3: wall calendar (kept with the notes as kind:'cal'; days: {'2026-11-14':{t:'text',e:'emoji',m:true}}) ----
export const CAL_COLS = ['#c8312f', '#2456b5', '#2c7a4b', '#d0457f', '#6a43b0', '#d9822b', '#35312c'];

export const CAL_EMO = ['', '❤️', '🎂', '🎉', '✈️', '⭐', '🌸', '🍽️', '📌'];

export const CAL_LOOKS = [
  { id: 'month', name: 'Month' },
  { id: 'wide', name: 'Wide month' },
  { id: 'mini', name: 'Mini month' },
  { id: 'week', name: 'Week' },
  { id: 'day', name: 'Tear-off day' }
];

// ---- v1.4: index cards (kept with the notes as kind:'idx'); drop one onto another to pile them up (pile:'p…', po: order) ----
export const IDX_COLS = ['#fffefa', '#fdf3c7', '#fbe1e6', '#e2eefc', '#e3f3e6', '#efe6fb'],
  IDX_MAX = 300;

export const TODO_MAX = 60,
  TODO_LEN = 300,
  NOTE_MAX = 1000;

// ---- settings panel ----
export const VERSION = 'v2.1.0';

// pv = small preview of each theme's texture for the theme picker
export const THEMES = [
  {
    id: 'classic',
    name: 'Classic cork',
    bg: '#c8945a',
    pv: 'radial-gradient(rgba(90,55,25,.45) 1px,transparent 1.6px) 0 0/7px 7px,radial-gradient(rgba(255,230,180,.35) 1px,transparent 1.8px) 3px 5px/11px 11px,#c8945a'
  },
  {
    id: 'chalkboard',
    name: 'Chalkboard',
    bg: '#2f3d37',
    pv: 'radial-gradient(rgba(255,255,255,.08) 1px,transparent 1.6px) 0 0/9px 9px,#2f3d37'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    bg: '#1b2340',
    pv: 'radial-gradient(rgba(190,205,255,.3) 1px,transparent 1.5px) 0 0/13px 13px,#1b2340'
  },
  {
    id: 'linen',
    name: 'Linen',
    bg: '#eee7da',
    pv: 'repeating-linear-gradient(0deg,rgba(120,100,70,.1) 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(120,100,70,.1) 0 1px,transparent 1px 4px),#eee7da'
  },
  {
    id: 'blush',
    name: 'Blush',
    bg: '#e8b4bd',
    pv: 'radial-gradient(rgba(255,255,255,.45) 1.5px,transparent 2px) 0 0/12px 12px,#e8b4bd'
  },
  {
    id: 'walnut',
    name: 'Walnut',
    bg: '#6e4528',
    pv: 'repeating-linear-gradient(90deg,rgba(25,12,4,.35) 0 2px,transparent 2px 46px),repeating-linear-gradient(91deg,rgba(25,12,4,.15) 0 1px,transparent 1px 6px),#6e4528'
  },
  {
    id: 'kraft',
    name: 'Kraft paper',
    bg: '#c9a87c',
    pv: 'radial-gradient(rgba(90,60,25,.35) .8px,transparent 1.3px) 0 0/5px 5px,radial-gradient(rgba(255,245,220,.4) .8px,transparent 1.4px) 2px 4px/9px 9px,#c9a87c'
  },
  {
    id: 'felt',
    name: 'Sage felt',
    bg: '#6d8c75',
    pv: 'radial-gradient(rgba(0,0,0,.12) .8px,transparent 1.2px) 0 0/3px 3px,radial-gradient(rgba(255,255,255,.1) .8px,transparent 1.2px) 1px 2px/4px 4px,#6d8c75'
  },
  {
    id: 'lavender',
    name: 'Lavender',
    bg: '#cdc2e8',
    pv: 'radial-gradient(rgba(255,255,255,.55) 1.5px,transparent 2px) 0 0/12px 12px,#cdc2e8'
  },
  {
    id: 'ocean',
    name: 'Ocean',
    bg: '#1d4d5c',
    pv: 'radial-gradient(circle at 50% 120%,transparent 58%,rgba(160,230,240,.14) 60%,transparent 63%) 0 0/24px 12px,#1d4d5c'
  },
  { id: 'custom', name: 'Custom', bg: '#7d9a8c' }
];

export const TEXTURES = [
  { id: 'cork', name: 'Cork' },
  { id: 'dots', name: 'Dots' },
  { id: 'weave', name: 'Weave' },
  { id: 'grid', name: 'Grid' },
  { id: 'stripes', name: 'Stripes' },
  { id: 'felt', name: 'Felt' },
  { id: 'wood', name: 'Wood' },
  { id: 'plain', name: 'Plain' }
];

export const THEME_VARS = [
  '--body-bg',
  '--bg-color',
  '--bg-image',
  '--bg-size',
  '--bg-pos',
  '--vig',
  '--h1',
  '--h1-sh',
  '--muted',
  '--empty-sh',
  '--tab-bg',
  '--tab-bg-h',
  '--tab-ink',
  '--tab-line',
  '--tab-on-bg',
  '--tab-on-ink',
  '--gear-bg',
  '--gear-bg-h',
  '--gear-ink',
  '--btn',
  '--btn-ink'
];

// ---- card style: polaroid frame, pin and sticky-note colours ----
export const FRAMES = [
  ['#fffdf8', 'Classic white'],
  ['#ffffff', 'Bright white'],
  ['#f4e9d3', 'Cream'],
  ['#d9c09a', 'Kraft'],
  ['#f6dfe3', 'Blush'],
  ['#dcefe4', 'Mint'],
  ['#dde8f5', 'Sky'],
  ['#232120', 'Black']
];

export const PINS = [
  ['#d6264f', 'Red'],
  ['#e0a526', 'Gold'],
  ['#2f6fd6', 'Blue'],
  ['#2e9e6a', 'Green'],
  ['#8a4fd6', 'Purple'],
  ['#f4f1ea', 'Pearl'],
  ['#2b2b2b', 'Black']
];

export const PALETTES = [
  { id: 'classic', name: 'Classic', c: ['#fff2a8', '#ffd9e0', '#cdeed6', '#d3e4ff'] },
  { id: 'pastel', name: 'Pastel', c: ['#fdf3c7', '#f9e0ec', '#e3f1e8', '#e6e3f7'] },
  { id: 'bright', name: 'Bright', c: ['#ffe44d', '#ff9ec1', '#8ee6a8', '#7fc8ff'] },
  { id: 'earthy', name: 'Earthy', c: ['#f1dfb5', '#e9c6ae', '#cfd8b8', '#d6cbb9'] },
  { id: 'sunset', name: 'Sunset', c: ['#ffd27a', '#ffb199', '#f6a5c0', '#c7b3f0'] }
];

// v2.0: the big title is the name of the section you're in; typing in it renames the section (data.title is kept, unused)
export const TITLE_MAX = 24;

export const Z_STEPS = [1, 0.85, 0.7, 0.55, 0.45, 0.35];

// ---- v1.6: pins and yarn. data.pins: {id,c, s,x,y} on the board, or {id,c, card,ox,oy} stuck in a card (moves with it).
// data.yarns: {id,a,b,c} ties pin a to pin b. Drawn in one overlay above everything except the dialogs. ----
export const YARN_COLS = [
  '#d6264f',
  '#2f6fd6',
  '#2c9a5a',
  '#f2c230',
  '#ff8fb1',
  '#8a4fd6',
  '#e07b2a',
  '#f7f3ea',
  '#2a2622'
];
