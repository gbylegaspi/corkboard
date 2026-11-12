// The one icon set used by every card button, and the buttons' markup.

// ---- one icon set for every card button, so they all render the same everywhere ----
export const IC = (function () {
  function sv(d) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }
  return {
    x: sv('<path d="M7 7l10 10M17 7 7 17"/>'),
    crop: sv('<path d="M7 3v14h14M3 7h14v14"/>'),
    rz: sv('<path d="M20 7 7 20M20 12.5 12.5 20M20 18l-2 2"/>'),
    fx: sv('<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 0 0 15z" fill="currentColor"/>'),
    font: sv(
      '<path d="M3 19 8.5 5h1L15 19M5.2 14.5h7.6"/><circle cx="18.6" cy="16.2" r="2.6"/><path d="M21.2 12.6V19"/>'
    ),
    frame: sv('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 6h8v8H8z"/>'),
    vplay: sv('<path d="M8 5.5v13l10.5-6.5z"/>'),
    vpause: sv('<path d="M8 5.5v13M16 5.5v13"/>'),
    vopt: sv('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
    calapp: sv(
      '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="2.2" fill="currentColor"/>'
    ),
    callook: sv(
      '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2"/>'
    ),
    tag: sv('<path d="M3.5 12 8 6.5h12.5v11H8z"/><circle cx="9.2" cy="12" r="1.3"/>'),
    shine: sv(
      '<path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'
    ),
    cycle: sv(
      '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5"/>'
    ),
    spread: sv(
      '<rect x="2.5" y="7" width="7" height="10" rx="1"/><rect x="14.5" y="7" width="7" height="10" rx="1"/><path d="M12 9v6"/>'
    ),
    move: sv(
      '<path d="M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>'
    ),
    tpl: sv(
      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><path d="M17 14v6M14 17h6"/>'
    ),
    link: sv(
      '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>'
    ),
    prev: sv('<path d="M14.5 6 8.5 12l6 6"/>'),
    next: sv('<path d="M9.5 6l6 6-6 6"/>'),
    rot: sv('<path d="M19.5 12.5a7.5 7.5 0 1 1-2.2-5.8"/><path d="M19.5 3.5v4.5H15"/>'),
    gather: sv('<rect x="6" y="9" width="12" height="11" rx="1.2"/><path d="M8.5 6h7M10.5 3h3"/>')
  };
})();

export const FX_BTN = '<button class="cb fx" title="Filters" aria-label="Filters">' + IC.fx + '</button>';

export const FONT_BTN = '<button class="cb font" title="Font" aria-label="Font">' + IC.font + '</button>';

// v1.7: drag the bottom edge to make a note, to-do list, index card or calendar longer or shorter (stored as hs, a height
// factor); part is the piece that stretches (the whole card, or a calendar's grid of days); double-click resets
export const RZE =
  '<i class="rze" title="Drag to make it longer or shorter (double-click to reset)" aria-hidden="true"></i>';

export const ROT_BTN =
  '<button class="cb rot" title="Drag to tilt (double-click to straighten)" aria-label="Tilt">' + IC.rot + '</button>';

export const PILE_BTNS =
  '<button class="cb pflip pt" title="Next card (puts this one at the bottom)" aria-label="Next card in the stack">' +
  IC.cycle +
  '</button>' +
  '<button class="cb pspread pt" title="Spread the stack out (or unstack for good)" aria-label="Spread the stack out">' +
  IC.spread +
  '</button>' +
  '<button class="cb pmove pt" title="Drag to move the whole stack" aria-label="Move the whole stack">' +
  IC.move +
  '</button><span class="pcount"></span>';

// ---- sticky notes (v1.1.7: resizable, and a to-do list kind: kind:'todo' with items [{t,d}]) ----
export const RZ_BTN =
  '<button class="cb rz" title="Drag to resize (double-click to reset)" aria-label="Resize">' + IC.rz + '</button>';

export const SVG_CAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  SVG_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  SVG_PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
