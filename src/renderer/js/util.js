// Small helpers with no app state: ids, dates, colours, URLs, SVG.

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---- v1.3: links on words in notes and labels ----
// Text is saved as plain "text" (so older versions still show it) plus "rt": a list of pieces [{t:'words', u:'https://…'}].
// The board never stores raw HTML, only these pieces, and links are limited to web and email addresses.
export function safeUrl(u) {
  if (typeof u !== 'string') return null;
  u = u.trim().slice(0, 600);
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) u = 'mailto:' + u;
    else if (/^(www\.)?[^\s/]+\.[^\s/]{2,}/i.test(u)) u = 'https://' + u;
    else return null;
  }
  try {
    var x = new URL(u);
    if (!/^(https?|mailto):$/.test(x.protocol)) return null;
    return x.href;
  } catch (e) {
    return null;
  }
}

export function linkHost(a) {
  try {
    var x = new URL(a);
    return x.protocol === 'mailto:'
      ? x.pathname
      : x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname : '');
  } catch (e) {
    return a;
  }
}

export function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

export function ymNow() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

export function jit(id, r) {
  var h = 0;
  for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h % 1000) / 1000) * r;
}

export const HEX = /^#[0-9a-f]{6}$/i;

export function hexOr(v, d) {
  return HEX.test(v || '') ? v.toLowerCase() : d;
}

export function autoOr(v) {
  return v === 'auto' || !HEX.test(v || '') ? 'auto' : v.toLowerCase();
}

export function rgbOf(h) {
  return [1, 3, 5].map(function (i) {
    return parseInt(h.slice(i, i + 2), 16);
  });
}

export function lum(h) {
  var c = rgbOf(h);
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
}

export function rgba(h, a) {
  return 'rgba(' + rgbOf(h).join(',') + ',' + a + ')';
}

export function plural(n, one, many) {
  return n + ' ' + (n === 1 ? one : many);
}

export const SVGNS = 'http://www.w3.org/2000/svg';

export function sEl(tag, attrs, parent) {
  var e = document.createElementNS(SVGNS, tag);
  for (var k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function shade(hex, f) {
  var n = parseInt(hex.slice(1), 16),
    r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  function m(v) {
    return Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f));
  }
  return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
}
