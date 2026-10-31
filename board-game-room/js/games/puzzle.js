/* Ghép tranh – UI. Cần PuzzleEngine. Tranh tự vẽ bằng SVG (không dùng ảnh ngoài). */
(function () {
  var E = window.PuzzleEngine;
  var PICS = {
    mountain: { name: 'Núi & hồ bình minh', svg: function () {
      return '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9c9f0"/><stop offset=".6" stop-color="#f6d5cf"/><stop offset="1" stop-color="#ffe8c9"/></linearGradient>' +
        '<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d9d0"/><stop offset="1" stop-color="#8db4de"/></linearGradient></defs>' +
        '<rect width="800" height="600" fill="url(#s)"/><circle cx="560" cy="300" r="70" fill="#fff3d6" opacity=".9"/><circle cx="560" cy="300" r="110" fill="#fff3d6" opacity=".3"/>' +
        '<path d="M0 360 L150 190 L260 300 L380 150 L520 320 L640 220 L800 350 V380 H0Z" fill="#a4b9dd"/>' +
        '<path d="M380 150 L335 215 L365 205 L385 235 L410 205 L435 218Z" fill="#fff" opacity=".85"/><path d="M150 190 L120 232 L148 224 L168 240 L186 218Z" fill="#fff" opacity=".8"/>' +
        '<path d="M0 400 L120 300 L230 380 L360 280 L500 390 L640 310 L800 400 V420 H0Z" fill="#7b9bcb"/>' +
        '<rect y="395" width="800" height="205" fill="url(#w)"/><ellipse cx="560" cy="440" rx="60" ry="8" fill="#fff3d6" opacity=".7"/><ellipse cx="560" cy="470" rx="36" ry="5" fill="#fff3d6" opacity=".5"/>' +
        '<path d="M0 560 Q200 500 400 545 T800 520 V600 H0Z" fill="#5b82b4"/><path d="M0 590 Q250 550 480 585 T800 570 V600 H0Z" fill="#46688f"/>';
    } },
    city: { name: 'Thành phố hoàng hôn', svg: function () {
      var b = '', x = 0, hs = [190, 260, 150, 320, 220, 280, 170, 240, 300, 200, 260, 180], i, j, h, w;
      for (i = 0; i < hs.length; i++) {
        w = 66; h = hs[i]; x = i * 67;
        b += '<rect x="' + x + '" y="' + (470 - h) + '" width="' + w + '" height="' + h + '" fill="' + (i % 2 ? '#56619f' : '#4a5490') + '"/>';
        for (j = 0; j < h / 34 - 1; j++) b += '<rect x="' + (x + 12) + '" y="' + (470 - h + 16 + j * 34) + '" width="10" height="14" fill="#ffe3a8" opacity="' + ((i + j) % 3 ? .85 : .25) + '"/><rect x="' + (x + 38) + '" y="' + (470 - h + 16 + j * 34) + '" width="10" height="14" fill="#ffe3a8" opacity="' + ((i * j) % 3 ? .3 : .8) + '"/>';
      }
      return '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d8fd4"/><stop offset=".55" stop-color="#d9a5cf"/><stop offset="1" stop-color="#ffc9a0"/></linearGradient>' +
        '<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a78b8"/><stop offset="1" stop-color="#3f4a88"/></linearGradient></defs>' +
        '<rect width="800" height="600" fill="url(#s)"/><circle cx="400" cy="400" r="90" fill="#ffe2b8" opacity=".9"/>' +
        '<path d="M0 420 Q100 380 200 410 T400 400 T600 410 T800 395 V480 H0Z" fill="#8b86c2"/>' + b +
        '<rect y="470" width="800" height="130" fill="url(#w)"/><rect x="0" y="480" width="800" height="3" fill="#ffd9ac" opacity=".4"/>' +
        '<rect x="330" y="490" width="140" height="6" rx="3" fill="#ffe2b8" opacity=".6"/><rect x="360" y="510" width="80" height="5" rx="2" fill="#ffe2b8" opacity=".4"/>';
    } },
    forest: { name: 'Rừng thông sương mù', svg: function () {
      function pines(y, sc, col, n, off) {
        var s = '', k, x, h = 150 * sc, w = 60 * sc;
        for (k = 0; k < n; k++) { x = (k * 800 / n) + off; s += '<path d="M' + x + ' ' + (y - h) + ' L' + (x + w) + ' ' + y + ' L' + (x - w) + ' ' + y + 'Z" fill="' + col + '"/><path d="M' + x + ' ' + (y - h * .55) + ' L' + (x + w * 1.3) + ' ' + (y + h * .2) + ' L' + (x - w * 1.3) + ' ' + (y + h * .2) + 'Z" fill="' + col + '"/>'; }
        return s;
      }
      return '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f2f7"/><stop offset="1" stop-color="#c8dde8"/></linearGradient>' +
        '<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef5f8" stop-opacity="0"/><stop offset=".6" stop-color="#eef5f8" stop-opacity=".9"/><stop offset="1" stop-color="#eef5f8" stop-opacity="0"/></linearGradient></defs>' +
        '<rect width="800" height="600" fill="url(#s)"/><circle cx="620" cy="140" r="50" fill="#fff" opacity=".7"/>' +
        pines(300, .6, '#a9c4d3', 11, 30) + '<rect y="200" width="800" height="140" fill="url(#f)"/>' +
        pines(400, .85, '#7fa3b8', 8, 60) + '<rect y="300" width="800" height="150" fill="url(#f)"/>' +
        pines(520, 1.15, '#56819d', 6, 20) + '<rect y="420" width="800" height="130" fill="url(#f)" opacity=".7"/>' +
        pines(640, 1.6, '#35607f', 4, 90) + '<rect y="540" width="800" height="60" fill="#2f5675"/>';
    } },
    sea: { name: 'Biển & thuyền buồm', svg: function () {
      var w = '', i;
      for (i = 0; i < 6; i++) w += '<path d="M-20 ' + (380 + i * 40) + ' q50 -18 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0" fill="none" stroke="#fff" stroke-opacity="' + (.35 - i * .04) + '" stroke-width="4"/>';
      return '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfdcf6"/><stop offset="1" stop-color="#f4f9ff"/></linearGradient>' +
        '<linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fbbe8"/><stop offset="1" stop-color="#3a86c4"/></linearGradient></defs>' +
        '<rect width="800" height="600" fill="url(#s)"/><circle cx="170" cy="130" r="55" fill="#fff6d8"/><ellipse cx="560" cy="110" rx="90" ry="24" fill="#fff" opacity=".9"/><ellipse cx="620" cy="95" rx="60" ry="22" fill="#fff" opacity=".9"/>' +
        '<rect y="340" width="800" height="260" fill="url(#w)"/>' + w +
        '<path d="M300 440 H500 L470 490 H330Z" fill="#c9764f"/><rect x="396" y="250" width="8" height="190" fill="#8a6a55"/>' +
        '<path d="M404 255 L470 425 H404Z" fill="#fff"/><path d="M396 280 L330 425 H396Z" fill="#f0f6fc"/><path d="M404 250 L440 262 L404 274Z" fill="#e0646a"/>' +
        '<path d="M0 560 Q200 530 400 560 T800 550 V600 H0Z" fill="#2f78b4" opacity=".6"/>' +
        '<path d="M80 345 q10 -10 20 0 q10 -10 20 0" stroke="#fff" fill="none" stroke-width="3"/><path d="M640 330 q8 -8 16 0 q8 -8 16 0" stroke="#fff" fill="none" stroke-width="3"/>';
    } },
    balloon: { name: 'Khinh khí cầu', svg: function () {
      function bal(x, y, r, c1, c2) {
        return '<line x1="' + (x - r * .6) + '" y1="' + (y + r * 1.1) + '" x2="' + (x - r * .25) + '" y2="' + (y + r * 1.9) + '" stroke="#6f6a80" stroke-width="2"/><line x1="' + (x + r * .6) + '" y1="' + (y + r * 1.1) + '" x2="' + (x + r * .25) + '" y2="' + (y + r * 1.9) + '" stroke="#6f6a80" stroke-width="2"/>' +
          '<rect x="' + (x - r * .3) + '" y="' + (y + r * 1.9) + '" width="' + (r * .6) + '" height="' + (r * .4) + '" rx="4" fill="#a67b5b"/>' +
          '<path d="M' + x + ' ' + (y - r) + ' C' + (x + r * 1.3) + ' ' + (y - r) + ' ' + (x + r * 1.1) + ' ' + (y + r * .7) + ' ' + (x + r * .3) + ' ' + (y + r * 1.15) + ' H' + (x - r * .3) + ' C' + (x - r * 1.1) + ' ' + (y + r * .7) + ' ' + (x - r * 1.3) + ' ' + (y - r) + ' ' + x + ' ' + (y - r) + 'Z" fill="' + c1 + '"/>' +
          '<path d="M' + x + ' ' + (y - r) + ' C' + (x + r * .5) + ' ' + (y - r * .4) + ' ' + (x + r * .35) + ' ' + (y + r * .6) + ' ' + (x + r * .1) + ' ' + (y + r * 1.15) + ' H' + (x - r * .1) + ' C' + (x - r * .35) + ' ' + (y + r * .6) + ' ' + (x - r * .5) + ' ' + (y - r * .4) + ' ' + x + ' ' + (y - r) + 'Z" fill="' + c2 + '"/>';
      }
      return '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ebcec"/><stop offset="1" stop-color="#e6f1fb"/></linearGradient></defs>' +
        '<rect width="800" height="600" fill="url(#s)"/>' +
        '<ellipse cx="150" cy="150" rx="100" ry="26" fill="#fff" opacity=".85"/><ellipse cx="210" cy="132" rx="60" ry="24" fill="#fff" opacity=".85"/><ellipse cx="650" cy="260" rx="110" ry="28" fill="#fff" opacity=".8"/><ellipse cx="600" cy="242" rx="55" ry="22" fill="#fff" opacity=".8"/>' +
        '<path d="M0 470 Q150 400 300 460 T600 440 T800 450 V600 H0Z" fill="#9fcfb8"/><path d="M0 520 Q200 470 400 520 T800 500 V600 H0Z" fill="#7db89c"/><path d="M0 570 Q250 540 500 575 T800 560 V600 H0Z" fill="#5f9e86"/>' +
        bal(400, 190, 90, '#ee8f8f', '#fbe3e0') + bal(160, 330, 48, '#f3c36b', '#fff1cf') + bal(640, 380, 40, '#6fa9e6', '#dcecfb');
    } }
  };
  var PIC_ORDER = ['mountain', 'city', 'forest', 'sea', 'balloon'];
  var SIZES = { '3x3': [3, 3], '4x4': [4, 4], '5x5': [5, 5], '6x6': [6, 6], '8x6': [8, 6] };

  function fmt(ms) {
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s %= 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var hasP2D = typeof Path2D === 'function';

  function mkPath(cmds) {
    var p = null;
    if (hasP2D) {
      p = new Path2D();
      cmds.forEach(function (c) {
        if (c[0] === 'M') p.moveTo(c[1], c[2]); else if (c[0] === 'C') p.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); else p.closePath();
      });
    }
    return { cmds: cmds, p: p };
  }
  function trace(ctx, P) {
    ctx.beginPath();
    P.cmds.forEach(function (c) {
      if (c[0] === 'M') ctx.moveTo(c[1], c[2]); else if (c[0] === 'C') ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); else ctx.closePath();
    });
  }

  var imgCache = {};
  function loadPic(key, cb) {
    if (imgCache[key]) return cb(imgCache[key]);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">' + PICS[key].svg() + '</svg>';
    var im = new Image();
    im.onload = function () { imgCache[key] = im; cb(im); };
    im.onerror = function () { cb(null); };
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function create(root, ctx) {
    var picKey = (ctx.opts && PICS[ctx.opts.pic]) ? ctx.opts.pic : 'mountain';
    var sizeKey = (ctx.opts && SIZES[ctx.opts.size]) ? ctx.opts.size : '4x4';
    var G = null, L = null, W = null, pieces = [], img = null, base = null, sprites = [];
    var cssW = 0, scale = 1, dpr = 1, spriteK = 0, portrait = false;
    var drag = null, done = false, elapsed = 0, lastTick = 0, timer = null, destroyed = false, gen = 0;
    var preview = false, previewT = null, raf = 0, dirty = true, anims = [], ro = null, scratch = null;

    root.innerHTML = ''; root.classList.add('g-puzzle');
    var wrap = div('pz-wrap', root), top = div('pz-top', wrap);
    var timeEl = span('pz-time chip', top), cntEl = span('chip', top), picEl = span('chip', top), bestEl = span('chip muted', top);
    var stage = div('pz-stage', wrap);
    var loading = div('pz-loading', stage); loading.textContent = 'Đang vẽ tranh…';
    var cv = document.createElement('canvas'); cv.className = 'pz-canvas'; stage.appendChild(cv);
    var cx = cv.getContext('2d');
    function div(c, p) { var e = document.createElement('div'); e.className = c; p.appendChild(e); return e; }
    function span(c, p) { var e = document.createElement('span'); e.className = c; p.appendChild(e); return e; }

    function bestKey() { return 'bgr:puzzle:best:' + picKey + ':' + sizeKey; }
    function placedCount() { var n = 0; pieces.forEach(function (p) { if (p.locked) n++; }); return n; }
    function tgt(p) { var t = E.target(L, p.idx); return { x: W.frame.x + t.x, y: W.frame.y + t.y }; }

    function setStatus() {
      var n = placedCount(), N = pieces.length;
      cntEl.textContent = n + '/' + N + ' mảnh';
      ctx.ui.status(done ? 'Hoàn thành!' : 'Đã ghép ' + n + '/' + N + ' mảnh', done ? 'good' : 'info');
    }
    function toolbar() {
      ctx.ui.toolbar([
        { id: 'peek', label: 'Xem tranh mẫu', icon: '🖼', primary: preview, onClick: togglePreview },
        { id: 'hint', label: 'Gợi ý', icon: '💡', disabled: done || !pieces.length, onClick: hint },
        { id: 'shuffle', label: 'Xáo lại', icon: '🔀', disabled: done || !pieces.length, onClick: reshuffle }
      ]);
    }

    // ---- bố cục / kích thước ----
    function measure() {
      var rw = root.clientWidth || 800;
      var np = rw < 700;
      var w0 = Math.min(rw, np ? 640 : 1100);
      var d = Math.min(window.devicePixelRatio || 1, 3);
      return { np: np, w: Math.max(260, w0), d: d };
    }
    function applySize(force) {
      var m = measure(), changedO = m.np !== portrait || !W;
      if (changedO) {
        var old = W, oldP = portrait;
        portrait = m.np; W = E.world(portrait);
        if (old && pieces.length) pieces.forEach(function (p) {
          var fx = (p.x - old.tray.x) / old.tray.w, fy = (p.y - old.tray.y) / old.tray.h;
          if (p.locked) { var t = tgt(p); p.x = t.x; p.y = t.y; return; }
          p.x = W.tray.x + fx * W.tray.w; p.y = W.tray.y + fy * W.tray.h; clampPiece(p);
        });
      }
      if (!force && !changedO && m.w === cssW && m.d === dpr) return;
      cssW = m.w; dpr = m.d; scale = cssW / W.W;
      cv.style.width = cssW + 'px'; cv.style.height = Math.round(W.H * scale) + 'px';
      cv.width = Math.round(cssW * dpr); cv.height = Math.round(W.H * scale * dpr);
      buildSprites(); dirty = true; schedule();
    }
    function clampPiece(p) {
      p.x = Math.min(W.W - L.w - L.pad, Math.max(L.pad, p.x));
      p.y = Math.min(W.H - L.h - L.pad, Math.max(L.pad, p.y));
    }

    // ---- sprites ----
    function buildSprites() {
      if (!L || !img) return;
      var k = (cv.width / W.W), wasK = spriteK;
      if (sprites.length && Math.abs(k - wasK) / k < 0.04) return;
      spriteK = k;
      base = document.createElement('canvas');
      base.width = Math.round(E.IMG_W * k); base.height = Math.round(E.IMG_H * k);
      var bc = base.getContext('2d'); if (bc) bc.drawImage(img, 0, 0, base.width, base.height);
      var sw = Math.ceil((L.w + 2 * L.pad) * k), sh = Math.ceil((L.h + 2 * L.pad) * k);
      sprites = [];
      pieces.forEach(function (p) {
        var s = document.createElement('canvas'); s.width = sw; s.height = sh;
        sprites[p.i] = s;
        var c = s.getContext('2d'); if (!c) return;
        var ox = L.pad - p.c * L.w, oy = L.pad - p.r * L.h;
        c.save(); c.scale(k, k); c.translate(ox, oy);
        trace(c, p.path); c.save(); c.clip();
        c.drawImage(base, 0, 0, E.IMG_W, E.IMG_H);
        // chút sáng/tối nhẹ ở mép để mảnh nổi
        c.restore();
        c.lineJoin = 'round';
        trace(c, p.path); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.75)'; c.stroke();
        trace(c, p.path); c.lineWidth = 1.2; c.strokeStyle = 'rgba(40,80,125,.55)'; c.stroke();
        c.restore();
      });
    }

    // ---- vẽ ----
    function schedule() { if (!raf && !destroyed) raf = requestAnimationFrame(frame); }
    function frame(ts) {
      raf = 0;
      if (destroyed) return;
      if (anims.length) {
        var now = Date.now();
        anims = anims.filter(function (a) {
          var t = Math.min(1, (now - a.t0) / a.dur), e = 1 - Math.pow(1 - t, 3);
          a.p.x = a.x0 + (a.x1 - a.x0) * e; a.p.y = a.y0 + (a.y1 - a.y0) * e;
          if (t >= 1) { if (a.end) a.end(); return false; }
          return true;
        });
        dirty = true;
      }
      if (dirty) { dirty = false; draw(); }
      if (anims.length) schedule();
    }
    function rr(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
    function draw() {
      if (!cx || !L) return;
      var k = cv.width / W.W;
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
      cx.setTransform(k, 0, 0, k, 0, 0);
      var fr = W.frame, tr = W.tray;
      cx.fillStyle = '#e6f1fb'; rr(cx, tr.x, tr.y, tr.w, tr.h, 24); cx.fill();
      cx.strokeStyle = '#d3e4f5'; cx.lineWidth = 2; cx.setLineDash([10, 8]); cx.stroke(); cx.setLineDash([]);
      cx.fillStyle = '#ffffff'; cx.fillRect(fr.x - 8, fr.y - 8, fr.w + 16, fr.h + 16);
      if (base) {
        if (done || preview) {
          cx.drawImage(base, fr.x, fr.y, fr.w, fr.h);
        } else {
          cx.globalAlpha = 0.13; cx.drawImage(base, fr.x, fr.y, fr.w, fr.h); cx.globalAlpha = 1;
          cx.save(); cx.translate(fr.x, fr.y); cx.strokeStyle = 'rgba(90,140,200,.35)'; cx.lineWidth = 1.5;
          pieces.forEach(function (p) { trace(cx, p.path); cx.stroke(); });
          cx.restore();
        }
      }
      if (!done) {
        var i, p;
        for (i = 0; i < pieces.length; i++) { p = pieces[i]; if (p.locked) drawPiece(p, false); }
        if (!preview) for (i = 0; i < pieces.length; i++) { p = pieces[i]; if (!p.locked) drawPiece(p, true); }
        else for (i = 0; i < pieces.length; i++) { p = pieces[i]; if (!p.locked) drawPiece(p, true); }
      }
      if (preview && !done) { cx.strokeStyle = 'rgba(61,138,208,.8)'; cx.lineWidth = 3; cx.strokeRect(fr.x, fr.y, fr.w, fr.h); }
      if (!pieces.length) return;
    }
    function drawPiece(p, shadow) {
      var s = sprites[p.i]; if (!s) return;
      var lifted = drag && drag.p === p;
      if (shadow) { cx.shadowColor = 'rgba(40,80,125,' + (lifted ? .4 : .22) + ')'; cx.shadowBlur = (lifted ? 18 : 7) * spriteK; cx.shadowOffsetY = (lifted ? 6 : 2) * spriteK; }
      cx.drawImage(s, p.x - L.pad, p.y - L.pad, L.w + 2 * L.pad, L.h + 2 * L.pad);
      if (shadow) { cx.shadowColor = 'transparent'; cx.shadowBlur = 0; cx.shadowOffsetY = 0; }
    }

    // ---- trò chơi ----
    function startGame() {
      var my = ++gen;
      stopTimer(); done = false; drag = null; anims = []; preview = false; clearTimeout(previewT);
      pieces = []; sprites = []; spriteK = 0; elapsed = 0;
      picEl.textContent = PICS[picKey].name + ' · ' + sizeKey.replace('x', '×');
      var best = +lsGet(bestKey()) || 0;
      bestEl.textContent = best ? 'Kỷ lục: ' + fmt(best) : 'Chưa có kỷ lục';
      timeEl.textContent = '⏱ 00:00'; loading.style.display = ''; cv.style.visibility = 'hidden';
      var dim = SIZES[sizeKey]; L = E.makeLayout(dim[0], dim[1]);
      W = null; applySize(true);
      toolbar(); setStatus();
      loadPic(picKey, function (im) {
        if (my !== gen || destroyed) return;
        img = im;
        W = W || E.world(portrait);
        var n = L.cols * L.rows, i, r, c;
        for (i = 0; i < n; i++) {
          r = (i / L.cols) | 0; c = i % L.cols;
          pieces.push({ i: i, idx: i, r: r, c: c, path: mkPath(E.piecePath(L, r, c)), x: 0, y: 0, locked: false });
        }
        scatterPieces();
        loading.style.display = 'none'; cv.style.visibility = '';
        applySize(true); buildSprites();
        lastTick = Date.now(); startTimer(); toolbar(); setStatus(); dirty = true; schedule();
      });
    }
    function scatterPieces() {
      var loose = pieces.filter(function (p) { return !p.locked; });
      var pos = E.scatter(L, W.tray, loose.length);
      loose.forEach(function (p, k) { p.x = pos[k].x; p.y = pos[k].y; });
      // thứ tự chồng ngẫu nhiên
      for (var i = pieces.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = pieces[i]; pieces[i] = pieces[j]; pieces[j] = t; }
    }
    function reshuffle() {
      if (done) return;
      ctx.sound.play('click'); scatterPieces(); dirty = true; schedule();
    }
    function startTimer() { stopTimer(); lastTick = Date.now(); timer = setInterval(tick, 500); }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function tick() {
      var now = Date.now();
      if (document.hidden || done) { lastTick = now; return; }
      elapsed += now - lastTick; lastTick = now; timeEl.textContent = '⏱ ' + fmt(elapsed);
    }
    function onVis() { lastTick = Date.now(); }
    document.addEventListener('visibilitychange', onVis);

    function lock(p) {
      var t = tgt(p); p.x = t.x; p.y = t.y; p.locked = true;
      // mảnh đã khoá xuống đáy thứ tự vẽ
      pieces.splice(pieces.indexOf(p), 1); pieces.unshift(p);
    }
    function afterPlace() {
      setStatus(); dirty = true; schedule();
      if (placedCount() === pieces.length) finish();
    }
    function finish() {
      done = true; stopTimer(); tick();
      var best = +lsGet(bestKey()) || 0, isNew = !best || elapsed < best;
      if (isNew) { lsSet(bestKey(), String(elapsed)); bestEl.textContent = 'Kỷ lục: ' + fmt(elapsed); }
      ctx.sound.play('complete'); setStatus(); toolbar(); dirty = true; schedule();
      ctx.ui.result({ title: 'Hoàn thành!', text: 'Thời gian ' + fmt(elapsed) + (isNew ? ' (kỷ lục mới!)' : ''), tone: 'win' });
    }
    function hint() {
      if (done) return;
      var loose = pieces.filter(function (p) { return !p.locked; });
      if (!loose.length) return;
      var p = loose[(Math.random() * loose.length) | 0], t = tgt(p);
      if (drag) drag = null;
      ctx.sound.play('hint');
      anims.push({ p: p, x0: p.x, y0: p.y, x1: t.x, y1: t.y, t0: Date.now(), dur: 260, end: function () { lock(p); afterPlace(); } });
      p.locked = false; schedule();
    }
    function togglePreview() {
      if (done) return;
      preview = !preview; clearTimeout(previewT);
      if (preview) previewT = setTimeout(function () { preview = false; toolbar(); dirty = true; schedule(); }, 3500);
      ctx.sound.play('click'); toolbar(); dirty = true; schedule();
    }

    // ---- kéo thả ----
    function toWorld(e) {
      var r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * W.W, y: (e.clientY - r.top) / r.height * W.H };
    }
    function hit(p, x, y) {
      var lx = x - p.x + p.c * L.w, ly = y - p.y + p.r * L.h;   // về toạ độ tranh gốc
      if (hasP2D && cx && cx.isPointInPath) {
        try {
          var save = cx.getTransform ? cx.getTransform() : null;
          cx.setTransform(1, 0, 0, 1, 0, 0);
          var r = cx.isPointInPath(p.path.p, lx, ly);
          if (save) cx.setTransform(save);
          return r;
        } catch (e) {}
      }
      return x >= p.x - L.t * 0.5 && x <= p.x + L.w + L.t * 0.5 && y >= p.y - L.t * 0.5 && y <= p.y + L.h + L.t * 0.5;
    }
    function onDown(e) {
      if (done || !L || drag || (e.button != null && e.button > 0)) return;
      var w = toWorld(e), i;
      for (i = pieces.length - 1; i >= 0; i--) {
        var p = pieces[i];
        if (p.locked || anims.some(function (a) { return a.p === p; })) continue;
        if (hit(p, w.x, w.y)) {
          pieces.splice(i, 1); pieces.push(p);
          drag = { p: p, dx: w.x - p.x, dy: w.y - p.y, id: e.pointerId };
          try { cv.setPointerCapture(e.pointerId); } catch (er) {}
          cv.classList.add('drag'); ctx.sound.play('pop'); dirty = true; schedule();
          e.preventDefault(); return;
        }
      }
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var w = toWorld(e), p = drag.p;
      p.x = w.x - drag.dx; p.y = w.y - drag.dy; clampPiece(p);
      dirty = true; schedule(); e.preventDefault();
    }
    function onUp(e) {
      if (!drag || (e.pointerId !== drag.id && e.type !== 'pointercancel')) return;
      var p = drag.p; drag = null; cv.classList.remove('drag');
      try { cv.releasePointerCapture(e.pointerId); } catch (er) {}
      var t = tgt(p);
      if (e.type !== 'pointercancel' && E.snapTest(p.x, p.y, t.x, t.y, L)) {
        lock(p); ctx.sound.play('snap'); afterPlace();
      } else { dirty = true; schedule(); }
    }
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);

    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(function () { if (W) applySize(false); }); ro.observe(root); }
    else window.addEventListener('resize', onWinResize);
    function onWinResize() { if (W) applySize(false); }

    startGame();

    return {
      restart: function () {
        if (ctx.opts && PICS[ctx.opts.pic]) picKey = ctx.opts.pic;
        if (ctx.opts && SIZES[ctx.opts.size]) sizeKey = ctx.opts.size;
        startGame();
      },
      destroy: function () {
        destroyed = true; stopTimer(); clearTimeout(previewT); if (raf) cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', onWinResize);
        root.innerHTML = ''; root.classList.remove('g-puzzle');
      }
    };
  }

  window.Games = window.Games || {};
  Games.register({
    id: 'puzzle', name: 'Ghép tranh', tagline: 'Ghép mảnh jigsaw thành bức tranh', players: 1,
    options: [
      { key: 'pic', label: 'Tranh', choices: PIC_ORDER.map(function (k) { return { v: k, l: PICS[k].name }; }), default: 'mountain' },
      { key: 'size', label: 'Số mảnh', choices: [{ v: '3x3', l: '3×3' }, { v: '4x4', l: '4×4' }, { v: '5x5', l: '5×5' }, { v: '6x6', l: '6×6' }, { v: '8x6', l: '8×6' }], default: '4x4' }
    ],
    create: create
  });
})();
