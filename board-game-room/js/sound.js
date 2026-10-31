/* Âm thanh hiệu ứng tổng hợp bằng Web Audio (không file, không nhạc nền). */
(function () {
  var ctx = null, master = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('bgr:muted') === '1'; } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.35;
      var comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function unlock() {
    var c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(function () {});
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { passive: true });
  });

  // tone: dao động đơn với envelope
  function tone(o) {
    var t0 = ctx.currentTime + (o.at || 0), dur = o.dur || 0.15;
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    var v = o.vol == null ? 0.5 : o.vol, a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.dest || master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  // noise: nhiễu lọc (tiếng gõ / lướt)
  function noise(o) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var t0 = ctx.currentTime + (o.at || 0), dur = o.dur || 0.08;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = o.ftype || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1500, t0); f.Q.value = o.q || 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(o.vol == null ? 0.4 : o.vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  function seq(notes, step, o) {
    notes.forEach(function (f, i) {
      var p = {}; for (var k in o) p[k] = o[k];
      p.f = f; p.at = i * step; tone(p);
    });
  }

  var S = {
    click: function () { tone({ f: 900, f2: 700, dur: 0.05, type: 'triangle', vol: 0.3 }); },
    select: function () { tone({ f: 620, dur: 0.07, type: 'sine', vol: 0.4 }); tone({ f: 930, dur: 0.09, at: 0.04, type: 'sine', vol: 0.3 }); },
    move: function () { // "tạch" gỗ nhẹ
      noise({ f: 1800, q: 2, dur: 0.04, vol: 0.5 });
      tone({ f: 260, f2: 140, dur: 0.09, type: 'triangle', vol: 0.55 });
    },
    capture: function () {
      noise({ f: 1200, q: 0.8, dur: 0.14, vol: 0.7 });
      tone({ f: 200, f2: 70, dur: 0.18, type: 'square', vol: 0.3 });
      tone({ f: 340, f2: 120, dur: 0.12, type: 'triangle', vol: 0.5 });
    },
    check: function () { tone({ f: 880, dur: 0.12, type: 'square', vol: 0.18 }); tone({ f: 660, dur: 0.18, at: 0.13, type: 'square', vol: 0.18 }); },
    place: function () { // đặt quân cờ vây/caro: cộc nhẹ
      noise({ f: 2400, q: 3, dur: 0.03, vol: 0.4 });
      tone({ f: 420, f2: 300, dur: 0.07, type: 'sine', vol: 0.55 });
    },
    error: function () { tone({ f: 190, f2: 140, dur: 0.18, type: 'sawtooth', vol: 0.2 }); },
    win: function () { seq([523, 659, 784, 1047, 1319], 0.1, { dur: 0.22, type: 'triangle', vol: 0.45 }); tone({ f: 1568, at: 0.5, dur: 0.5, type: 'sine', vol: 0.3 }); },
    lose: function () { seq([392, 330, 262, 196], 0.17, { dur: 0.3, type: 'sine', vol: 0.4 }); },
    draw: function () { seq([440, 440, 392], 0.16, { dur: 0.22, type: 'triangle', vol: 0.35 }); },
    snap: function () { noise({ f: 3200, q: 4, dur: 0.025, vol: 0.5 }); tone({ f: 1400, f2: 900, dur: 0.04, type: 'square', vol: 0.15 }); },
    pop: function () { tone({ f: 380, f2: 900, dur: 0.09, type: 'sine', vol: 0.5 }); },
    tick: function () { tone({ f: 1500, dur: 0.025, type: 'square', vol: 0.12 }); },
    complete: function () {
      seq([523, 659, 784], 0.09, { dur: 0.18, type: 'triangle', vol: 0.4 });
      seq([784, 1047], 0.12, { dur: 0.45, type: 'triangle', vol: 0.4, at: 0 });
      tone({ f: 1047, at: 0.36, dur: 0.5, type: 'sine', vol: 0.35 });
      tone({ f: 1319, at: 0.36, dur: 0.5, type: 'sine', vol: 0.25 });
    },
    hint: function () { tone({ f: 1046, dur: 0.12, type: 'sine', vol: 0.35 }); tone({ f: 1568, at: 0.09, dur: 0.22, type: 'sine', vol: 0.3 }); }
  };
  // complete: sửa lại để không dùng seq với "at" lặp
  S.complete = function () {
    seq([523, 659, 784, 1047], 0.09, { dur: 0.16, type: 'triangle', vol: 0.4 });
    tone({ f: 1047, at: 0.4, dur: 0.55, type: 'sine', vol: 0.35 });
    tone({ f: 1319, at: 0.4, dur: 0.55, type: 'sine', vol: 0.25 });
    tone({ f: 784, at: 0.4, dur: 0.55, type: 'sine', vol: 0.2 });
  };

  window.Sound = {
    play: function (name) {
      if (muted || !S[name]) return;
      try { var c = ensure(); if (!c) return; if (c.state === 'suspended') c.resume().catch(function () {}); S[name](); } catch (e) {}
    },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem('bgr:muted', muted ? '1' : '0'); } catch (e) {}
    },
    isMuted: function () { return muted; },
    unlock: unlock
  };
})();
