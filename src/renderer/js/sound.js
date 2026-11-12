// Sound effects, synthesised with Web Audio (no audio files). The board's settings switch them on/off and set the volume.

let enabled = true,
  volume = 0.8,
  ac = null,
  master = null;

export function soundOn() {
  return enabled;
}
export function setSound(on) {
  enabled = !!on;
}
export function getVolume() {
  return volume;
}
// 0–1; returns the volume it was set to
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, +v || 0));
  if (ac && master) master.gain.setTargetAtTime(volume, ac.currentTime, 0.01);
  return volume;
}

// ---- sound effects (synthesised in the browser, no audio files needed) ----
const REV_SEED = 7;
export const sfx = (function () {
  // Gentle, "physical" sounds built from filtered noise + soft resonances, with a small room reverb.
  // No audio files needed.
  var nb = null,
    rv = null;
  function C() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = volume;
        // transparent below ~-4 dB, gently rounds off peaks if many sounds stack up at once
        var sh = ac.createWaveShaper(),
          cv = new Float32Array(2049);
        for (var q = 0; q < cv.length; q++) {
          var xx = q / 1024 - 1,
            ax = Math.abs(xx);
          cv[q] = (xx < 0 ? -1 : 1) * (ax < 0.6 ? ax : 0.6 + 0.4 * Math.tanh((ax - 0.6) / 0.4));
        }
        sh.curve = cv;
        master.connect(sh);
        sh.connect(ac.destination);
        var r = ac.sampleRate,
          len = Math.floor(r * 2),
          b = ac.createBuffer(1, len, r),
          d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        nb = b;
        var il = Math.floor(r * 0.8),
          ir = ac.createBuffer(2, il, r);
        // the same small "room" every time (seeded), so sounds don't change from one visit to the next
        var sd = REV_SEED;
        function rnd0() {
          sd |= 0;
          sd = (sd + 0x6d2b79f5) | 0;
          var z = Math.imul(sd ^ (sd >>> 15), 1 | sd);
          z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
          return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
        }
        for (var c = 0; c < 2; c++) {
          var x = ir.getChannelData(c);
          for (var j = 0; j < il; j++) x[j] = (rnd0() * 2 - 1) * Math.pow(1 - j / il, 3.4);
        }
        rv = ac.createConvolver();
        rv.buffer = ir;
        var wet = ac.createGain();
        wet.gain.value = 0.5;
        rv.connect(wet);
        wet.connect(master);
      } catch (e) {
        ac = null;
      }
    }
    if (ac && ac.state === 'suspended' && ac.resume) ac.resume().catch(function () {});
    return ac;
  }
  function out(a, g, send) {
    g.connect(master);
    if (send && rv) {
      var s = a.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(rv);
    }
  }
  function env(g, n, at, d, v) {
    g.gain.value = 0;
    g.gain.setValueAtTime(0, 0);
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), n + at);
    g.gain.exponentialRampToValueAtTime(0.0001, n + at + d);
  }
  // filtered noise burst: o={type,f,f2,q,v,a,rev}
  function nz(t, d, o) {
    var a = C();
    if (!a || !enabled || !nb) return;
    var n = a.currentTime + t,
      at = o.a || 0.002,
      s = a.createBufferSource(),
      fl = a.createBiquadFilter(),
      g = a.createGain();
    s.buffer = nb;
    fl.type = o.type || 'bandpass';
    fl.Q.value = o.q == null ? 0.8 : o.q;
    fl.frequency.setValueAtTime(o.f, n);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, n + at + d);
    env(g, n, at, d, o.v);
    s.connect(fl);
    fl.connect(g);
    out(a, g, o.rev);
    s.start(n, Math.random() * (nb.duration - at - d - 0.1), at + d + 0.06);
  }
  // soft resonance: o={f,f2,type,v,a,rev}
  function osc(t, d, o) {
    var a = C();
    if (!a || !enabled) return;
    var n = a.currentTime + t,
      at = o.a || 0.003,
      s = a.createOscillator(),
      g = a.createGain();
    s.type = o.type || 'sine';
    s.frequency.setValueAtTime(o.f, n);
    if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, n + at + d);
    env(g, n, at, d, o.v);
    s.connect(g);
    out(a, g, o.rev);
    s.start(n);
    s.stop(n + at + d + 0.06);
  }
  // music-box / glass bell: inharmonic partials that ring out naturally
  function bell(t, f, v, d) {
    [
      [1, 1, 1],
      [2.756, 0.42, 0.6],
      [5.404, 0.18, 0.35],
      [8.933, 0.07, 0.2]
    ].forEach(function (p) {
      if (f * p[0] < 12000) osc(t, d * p[2], { f: f * p[0], v: v * p[1], a: 0.003, rev: 0.3 });
    });
    nz(t, 0.012, { type: 'highpass', f: 5000, q: 0.5, v: v * 0.25 });
  }
  function knock(t, f, v) {
    osc(t, 0.07, { f: f, f2: f * 0.82, v: v, a: 0.002, rev: 0.15 });
    nz(t, 0.035, { type: 'lowpass', f: 1400, f2: 500, q: 0.5, v: v * 0.9, rev: 0.1 });
  }
  var rnd = function (a, b) {
    return a + Math.random() * (b - a);
  };
  return {
    // photo/note lands on the cork, then the pin presses in
    land: function (t) {
      t = t || 0;
      nz(t, 0.1, { type: 'lowpass', f: 1000, f2: 260, q: 0.4, v: 0.5, a: 0.0015, rev: 0.08 });
      osc(t, 0.13, { f: 105, f2: 62, v: 0.22, a: 0.002 });
      nz(t + 0.04, 0.028, { type: 'bandpass', f: 3300, q: 1.3, v: 0.16, rev: 0.12 });
      osc(t + 0.04, 0.06, { f: 2100, f2: 1800, v: 0.018, rev: 0.2 });
    },
    // picking a card up: a soft paper rustle
    lift: function () {
      nz(0, 0.11, { type: 'highpass', f: 2600, q: 0.4, v: 0.06, a: 0.025 });
      nz(0, 0.08, { type: 'bandpass', f: 1300, f2: 2700, q: 0.9, v: 0.06, a: 0.015 });
    },
    // putting it down: a muffled paper pat
    set: function () {
      nz(0, 0.07, { type: 'lowpass', f: 1500, f2: 480, q: 0.4, v: 0.34, a: 0.0015, rev: 0.06 });
      osc(0, 0.08, { f: 125, f2: 82, v: 0.12 });
    },
    // sticky note peeled off the pad and patted down
    pop: function () {
      nz(0, 0.13, { type: 'bandpass', f: 800, f2: 4200, q: 1.3, v: 0.15, a: 0.05 });
      nz(0.15, 0.05, { type: 'lowpass', f: 1800, f2: 700, q: 0.4, v: 0.36, rev: 0.08 });
    },
    // switching sections: a soft wooden click
    tab: function () {
      nz(0, 0.022, { type: 'bandpass', f: 2300, q: 1.8, v: 0.24, rev: 0.12 });
      osc(0, 0.045, { f: 640, f2: 560, type: 'triangle', v: 0.05, rev: 0.15 });
    },
    // toggles and small buttons: a gentle tactile tick
    blip: function () {
      nz(0, 0.016, { type: 'bandpass', f: 3400, q: 1.4, v: 0.15, rev: 0.1 });
      osc(0, 0.03, { f: 1250, f2: 1100, v: 0.035, rev: 0.12 });
    },
    // "are you sure?": two soft knocks
    warn: function () {
      knock(0, 250, 0.12);
      knock(0.1, 230, 0.1);
    },
    // paper crumpled and tossed
    trash: function () {
      var t = 0;
      for (var i = 0; i < 20; i++) {
        t += rnd(0.01, 0.03);
        nz(t, rnd(0.01, 0.03), {
          type: 'bandpass',
          f: rnd(1400, 5200),
          q: 1.4,
          v: rnd(0.08, 0.2) * (1 - i / 24),
          rev: 0.06
        });
      }
      nz(0.16, 0.3, { type: 'bandpass', f: 2000, f2: 350, q: 0.7, v: 0.07, a: 0.07, rev: 0.2 });
    },
    // label tape pulled off the roll (a quick sticky crackle), then smoothed down
    tape: function () {
      var t = 0;
      for (var i = 0; i < 9; i++) {
        t += rnd(0.012, 0.022);
        nz(t, rnd(0.008, 0.016), { type: 'bandpass', f: rnd(2600, 5200), q: 2, v: rnd(0.03, 0.06), rev: 0.05 });
      }
      nz(0, 0.2, { type: 'bandpass', f: 1800, f2: 4200, q: 1.1, v: 0.05, a: 0.05 });
      nz(0.25, 0.06, { type: 'lowpass', f: 1700, f2: 600, q: 0.4, v: 0.3, rev: 0.08 });
      osc(0.25, 0.07, { f: 120, f2: 80, v: 0.08 });
    },
    // sticker peeled off its backing sheet and pressed on with a thumb
    peel: function (t) {
      t = t || 0;
      var u = t;
      for (var i = 0; i < 14; i++) {
        u += rnd(0.008, 0.016);
        nz(u, rnd(0.006, 0.012), {
          type: 'highpass',
          f: rnd(3000, 6000),
          q: 0.8,
          v: rnd(0.025, 0.05) * (1 - i / 18)
        });
      }
      nz(t + 0.02, 0.18, { type: 'bandpass', f: 3000, f2: 1400, q: 0.9, v: 0.035, a: 0.04 });
      nz(t + 0.26, 0.05, { type: 'lowpass', f: 1500, f2: 500, q: 0.4, v: 0.28, rev: 0.06 });
      osc(t + 0.26, 0.06, { f: 130, f2: 90, v: 0.08 });
    },
    // putting something on the shelf: a soft wooden knock
    shelf: function () {
      osc(0, 0.09, { f: 210, f2: 130, v: 0.13 });
      nz(0, 0.06, { type: 'lowpass', f: 900, f2: 300, q: 0.6, v: 0.25, rev: 0.06 });
      osc(0.07, 0.06, { f: 160, f2: 110, v: 0.06 });
    },
    // a page turning: a quick airy paper swish
    flip: function () {
      nz(0, 0.16, { type: 'bandpass', f: 900, f2: 3200, q: 0.9, v: 0.07, a: 0.05, rev: 0.1 });
      nz(0.1, 0.05, { type: 'highpass', f: 3500, q: 0.6, v: 0.035, rev: 0.08 });
    },
    // ticking off a to-do: a quick pencil check mark
    tick: function () {
      nz(0, 0.035, { type: 'bandpass', f: 3800, f2: 2600, q: 1.2, v: 0.09, a: 0.004, rev: 0.05 });
      nz(0.05, 0.07, { type: 'bandpass', f: 2400, f2: 4200, q: 1.1, v: 0.1, a: 0.006, rev: 0.05 });
    },
    // a tiny glint for the shiny sticker finish
    glint: function () {
      bell(0, 2349, 0.035, 0.7);
      bell(0.07, 3136, 0.025, 0.6);
    },
    chime: function () {
      [784, 988, 1175, 1568].forEach(function (f, i) {
        bell(i * 0.085, f, 0.065, 1.5);
      });
    },
    chime2: function () {
      bell(0, 880, 0.09, 1.2);
      bell(0.11, 1319, 0.08, 1.4);
    },
    sample: function () {
      bell(0, 988, 0.1, 1.1);
    },
    // perf: set the sound engine up ahead of time (the first sound otherwise builds its buffers mid-drag)
    warm: function () {
      C();
    }
  };
})();
