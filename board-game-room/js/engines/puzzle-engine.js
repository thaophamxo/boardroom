/* Puzzle engine: hình học mảnh ghép jigsaw (mấu lồi/lõm), toạ độ đích, snap, rải mảnh. Thuần logic, test được bằng Node. */
(function () {
  var IMG_W = 800, IMG_H = 600;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Bố cục: cols×rows, mỗi cạnh trong có dấu (+1/-1) và độ lệch ngẫu nhiên.
  function makeLayout(cols, rows, rng) {
    rng = rng || Math.random;
    var w = IMG_W / cols, h = IMG_H / rows, hE = [], vE = [], r, c;
    function edge(flat) {
      return flat ? { sign: 0, off: 0 } : { sign: rng() < 0.5 ? 1 : -1, off: (rng() - 0.5) * 0.12 };
    }
    for (r = 0; r <= rows; r++) { hE[r] = []; for (c = 0; c < cols; c++) hE[r][c] = edge(r === 0 || r === rows); }
    for (r = 0; r < rows; r++) { vE[r] = []; for (c = 0; c <= cols; c++) vE[r][c] = edge(c === 0 || c === cols); }
    return { cols: cols, rows: rows, W: IMG_W, H: IMG_H, w: w, h: h, t: 0.22 * Math.min(w, h), pad: 0.22 * Math.min(w, h), hE: hE, vE: vE };
  }

  // 0 = thẳng, 1 = mấu lồi, -1 = lõm
  function tabs(L, r, c) {
    return {
      top: 0 - L.hE[r][c].sign, bottom: 0 + L.hE[r + 1][c].sign,
      left: 0 + L.vE[r][c].sign, right: 0 - L.vE[r][c + 1].sign
    };
  }

  // Danh sách điểm Bezier bậc 3 (1 + 3k điểm) của một cạnh chuẩn từ p0 đến p1, pháp tuyến n.
  function edgePoints(p0, p1, n, e, len, t) {
    var ux = p1[0] - p0[0], uy = p1[1] - p0[1];
    function P(s, hh) { return [p0[0] + ux * s + n[0] * e.sign * hh * t, p0[1] + uy * s + n[1] * e.sign * hh * t]; }
    if (!e.sign) {
      return [p0, P(1 / 3, 0), P(2 / 3, 0), p1];
    }
    var s0 = 0.5 + e.off;
    var q = [
      [0, 0],
      [s0 - 0.18, 0], [s0 - 0.10, 0.02], [s0 - 0.07, 0.12],
      [s0 - 0.05, 0.35], [s0 - 0.20, 0.45], [s0 - 0.17, 0.75],
      [s0 - 0.15, 1.0], [s0 - 0.06, 1.0], [s0, 1.0],
      [s0 + 0.06, 1.0], [s0 + 0.15, 1.0], [s0 + 0.17, 0.75],
      [s0 + 0.20, 0.45], [s0 + 0.05, 0.35], [s0 + 0.07, 0.12],
      [s0 + 0.10, 0.02], [s0 + 0.18, 0], [s0 + 0.22, 0],
      [s0 + 0.22 + (1 - s0 - 0.22) / 3, 0], [s0 + 0.22 + 2 * (1 - s0 - 0.22) / 3, 0], [1, 0]
    ];
    return q.map(function (a) { return P(a[0], a[1]); });
  }

  // Đường viền mảnh (r,c) theo toạ độ tranh gốc: [['M',x,y],['C',x1,y1,x2,y2,x,y]...,['Z']]
  function piecePath(L, r, c) {
    var x0 = c * L.w, y0 = r * L.h, x1 = x0 + L.w, y1 = y0 + L.h, t = L.t;
    var top = edgePoints([x0, y0], [x1, y0], [0, 1], L.hE[r][c], L.w, t);
    var right = edgePoints([x1, y0], [x1, y1], [-1, 0], L.vE[r][c + 1], L.h, t);
    var bottom = edgePoints([x0, y1], [x1, y1], [0, 1], L.hE[r + 1][c], L.w, t).reverse();
    var left = edgePoints([x0, y0], [x0, y1], [-1, 0], L.vE[r][c], L.h, t).reverse();
    var cmds = [['M', top[0][0], top[0][1]]];
    [top, right, bottom, left].forEach(function (pts) {
      for (var i = 1; i < pts.length; i += 3)
        cmds.push(['C', pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i + 2][0], pts[i + 2][1]]);
    });
    cmds.push(['Z']);
    return cmds;
  }

  function target(L, idx) { return { x: (idx % L.cols) * L.w, y: ((idx / L.cols) | 0) * L.h }; }

  // Hộp bao của mảnh nếu gốc ô đặt tại (x,y)
  function bbox(L, x, y) { return { x: x - L.pad, y: y - L.pad, w: L.w + 2 * L.pad, h: L.h + 2 * L.pad }; }

  // Mảnh có gốc ô ở (px,py) có đủ gần đích (tx,ty) để hít vào không (ngưỡng = ratio × cạnh nhỏ của ô).
  function snapTest(px, py, tx, ty, L, ratio) {
    var th = (ratio == null ? 0.25 : ratio) * Math.min(L.w, L.h);
    return Math.hypot(px - tx, py - ty) <= th;
  }

  // Hai bố cục thế giới: ngang (khung bên trái, khay bên phải) và dọc (khung trên, khay dưới).
  function world(portrait) {
    if (portrait) return { W: 860, H: 1500, portrait: true, frame: { x: 30, y: 30, w: IMG_W, h: IMG_H }, tray: { x: 20, y: 660, w: 820, h: 820 } };
    return { W: 1500, H: 800, portrait: false, frame: { x: 30, y: 100, w: IMG_W, h: IMG_H }, tray: { x: 870, y: 20, w: 610, h: 760 } };
  }

  // Rải n mảnh trong khay: lưới lệch ngẫu nhiên; trả về toạ độ GỐC Ô (world) sao cho hộp bao nằm trọn trong khay.
  function scatter(L, tray, n, rng) {
    rng = rng || Math.random;
    var minX = tray.x + L.pad, maxX = tray.x + tray.w - L.w - L.pad;
    var minY = tray.y + L.pad, maxY = tray.y + tray.h - L.h - L.pad;
    if (maxX < minX) maxX = minX = (minX + maxX) / 2;
    if (maxY < minY) maxY = minY = (minY + maxY) / 2;
    var rw = maxX - minX, rh = maxY - minY;
    var gc = Math.max(1, Math.round(Math.sqrt(n * (rw + L.w) / (rh + L.h))));
    var gr = Math.ceil(n / gc);
    while (gc * gr < n) gc++;
    var slots = [];
    for (var i = 0; i < gc * gr; i++) slots.push(i);
    for (i = slots.length - 1; i > 0; i--) { var j = (rng() * (i + 1)) | 0, tmp = slots[i]; slots[i] = slots[j]; slots[j] = tmp; }
    var out = [], cw = gc > 1 ? rw / (gc - 1) : 0, ch = gr > 1 ? rh / (gr - 1) : 0;
    for (i = 0; i < n; i++) {
      var s = slots[i], cx = s % gc, cy = (s / gc) | 0;
      var x = gc > 1 ? minX + cx * cw : minX + rw / 2, y = gr > 1 ? minY + cy * ch : minY + rh / 2;
      x += (rng() - 0.5) * cw * 0.3; y += (rng() - 0.5) * ch * 0.3;
      out.push({ x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) });
    }
    return out;
  }

  var X = { IMG_W: IMG_W, IMG_H: IMG_H, mulberry32: mulberry32, makeLayout: makeLayout, tabs: tabs, edgePoints: edgePoints,
            piecePath: piecePath, target: target, bbox: bbox, snapTest: snapTest, world: world, scatter: scatter };
  if (typeof module !== 'undefined' && module.exports) module.exports = X; else window.PuzzleEngine = X;
})();
