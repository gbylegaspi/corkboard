// Rich text (links, bold, italics) as plain data: [{t, u?, b?, i?}], and reading/writing it from editable elements.
import { TODO_LEN } from './catalog.js';
import { safeUrl } from './util.js';

// v1.7: a piece can also be bold (b) and/or italic (i); older versions just show the words
export function rtAdd(out, t, u, f) {
  if (!t) return;
  var b = !!(f && f.b),
    i = !!(f && f.i),
    l = out[out.length - 1];
  if (l && (l.u || '') === (u || '') && !!l.b === b && !!l.i === i) l.t += t;
  else {
    var p = { t: t };
    if (u) p.u = u;
    if (b) p.b = true;
    if (i) p.i = true;
    out.push(p);
  }
}

export function rtPlain(segs) {
  return segs
    .map(function (s) {
      return s.t;
    })
    .join('');
}

export function rtClean(a, max) {
  var out = [],
    n = 0;
  (Array.isArray(a) ? a : []).forEach(function (s) {
    if (!s || typeof s.t !== 'string' || n >= max) return;
    var t = s.t.slice(0, max - n);
    n += t.length;
    rtAdd(out, t, s.u ? safeUrl(s.u) : null, { b: s.b === true, i: s.i === true });
  });
  return out;
}

export function rtOf(o, max) {
  return Array.isArray(o.rt) ? rtClean(o.rt, max) : rtClean([{ t: o.text || '' }], max);
}

export function rtStore(o, segs) {
  o.text = rtPlain(segs);
  if (
    segs.some(function (s) {
      return s.u || s.b || s.i;
    })
  )
    o.rt = segs.map(function (s) {
      var p = { t: s.t };
      if (s.u) p.u = s.u;
      if (s.b) p.b = true;
      if (s.i) p.i = true;
      return p;
    });
  else delete o.rt;
}

export function rtRender(el, segs) {
  el.textContent = '';
  segs.forEach(function (s) {
    var host = el;
    if (s.u) {
      host = document.createElement('a');
      host.href = s.u;
      host.target = '_blank';
      host.rel = 'noopener noreferrer';
      el.appendChild(host);
    }
    if (s.b) {
      var bb = document.createElement('b');
      host.appendChild(bb);
      host = bb;
    }
    if (s.i) {
      var ii = document.createElement('i');
      host.appendChild(ii);
      host = ii;
    }
    s.t.split('\n').forEach(function (p, i) {
      if (i) host.appendChild(document.createElement('br'));
      if (p) host.appendChild(document.createTextNode(p));
    });
  });
}

export function rtRead(el) {
  var out = [];
  (function walk(node, u, f) {
    node.childNodes.forEach(function (c) {
      if (c.nodeType === 3) {
        rtAdd(out, c.nodeValue.replace(/\u00a0/g, ' '), u, f);
        return;
      }
      if (c.nodeType !== 1) return;
      var tg = c.tagName;
      if (tg === 'BR') {
        rtAdd(out, '\n', u, f);
        return;
      }
      if ((tg === 'DIV' || tg === 'P') && out.length && !/\n$/.test(rtPlain(out))) rtAdd(out, '\n', u, f);
      // v1.7: bold / italic, from <b>/<strong>/<i>/<em> or an inline style
      var g = { b: f.b, i: f.i },
        fw = c.style && c.style.fontWeight,
        fs = c.style && c.style.fontStyle;
      if (tg === 'B' || tg === 'STRONG' || fw === 'bold' || +fw >= 600) g.b = true;
      else if (fw === 'normal' || (+fw && +fw < 600)) g.b = false;
      if (tg === 'I' || tg === 'EM' || fs === 'italic' || fs === 'oblique') g.i = true;
      else if (fs === 'normal') g.i = false;
      walk(c, tg === 'A' ? safeUrl(c.getAttribute('href')) || u : u, g);
    });
  })(el, null, { b: false, i: false });
  // drop the stray line breaks the browser leaves at the end
  while (out.length && /\n$/.test(out[out.length - 1].t)) {
    var l = out[out.length - 1];
    l.t = l.t.replace(/\n+$/, '');
    if (!l.t) out.pop();
  }
  return out;
}

// v2.0: to-do items are rich text too (bold / italics), one line each: {t, d, rt?} like a note's text/rt
export function tdRt(it) {
  return Array.isArray(it.rt) ? rtClean(it.rt, TODO_LEN) : rtClean([{ t: it.t || '' }], TODO_LEN);
}

export function tdStore(it, segs) {
  segs = segs.map(function (q) {
    var p = { t: q.t.replace(/\n/g, ' ') };
    if (q.u) p.u = q.u;
    if (q.b) p.b = true;
    if (q.i) p.i = true;
    return p;
  });
  it.t = rtPlain(segs);
  if (
    segs.some(function (q) {
      return q.u || q.b || q.i;
    })
  )
    it.rt = segs;
  else delete it.rt;
}

// where the caret is in a contenteditable, as text offsets ({a: start, b: end}), or null when it's not in there
export function edSel(ed) {
  var g = getSelection();
  if (!g.rangeCount) return null;
  var r = g.getRangeAt(0);
  if (!ed.contains(r.startContainer) || !ed.contains(r.endContainer)) return null;
  var q = document.createRange();
  q.selectNodeContents(ed);
  q.setEnd(r.startContainer, r.startOffset);
  var a = q.toString().length;
  q.setEnd(r.endContainer, r.endOffset);
  return { a: a, b: q.toString().length };
}

export function edCaret(ed, atStart) {
  var r = document.createRange();
  r.selectNodeContents(ed);
  r.collapse(!!atStart);
  var g = getSelection();
  g.removeAllRanges();
  g.addRange(r);
}
