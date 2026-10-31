const assert = require('assert');
const P = require('../js/engines/puzzle-engine.js');
const sizes = [[3, 3], [4, 4], [5, 5], [6, 6], [8, 6]];
for (const [cols, rows] of sizes) {
  const L = P.makeLayout(cols, rows, P.mulberry32(cols * 10 + rows));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const tb = P.tabs(L, r, c);
    if (c === 0) assert.strictEqual(tb.left, 0); else assert.strictEqual(tb.left, -P.tabs(L, r, c - 1).right);
    if (c === cols - 1) assert.strictEqual(tb.right, 0);
    if (r === 0) assert.strictEqual(tb.top, 0); else assert.strictEqual(tb.top, -P.tabs(L, r - 1, c).bottom);
    if (r === rows - 1) assert.strictEqual(tb.bottom, 0);
    if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) ['top', 'bottom', 'left', 'right'].forEach(k => assert.ok(tb[k] === 1 || tb[k] === -1));
    // đường viền: kín, nằm trong hộp bao, 4 cạnh ngoài thẳng
    const path = P.piecePath(L, r, c), bb = P.bbox(L, c * L.w, r * L.h);
    assert.strictEqual(path[0][0], 'M'); assert.strictEqual(path[path.length - 1][0], 'Z');
    assert.ok(path.length >= 6); // M + >=4 cạnh + Z
    path.forEach(s => { for (let i = 1; i < s.length; i += 2) {
      assert.ok(s[i] >= bb.x - 1e-6 && s[i] <= bb.x + bb.w + 1e-6 && s[i + 1] >= bb.y - 1e-6 && s[i + 1] <= bb.y + bb.h + 1e-6, 'ngoài bbox'); } });
    if (c === 0) path.forEach(s => { if (s[0] === 'C') {} });
    // đích
    const idx = r * cols + c, tg = P.target(L, idx);
    assert.ok(Math.abs(tg.x - c * L.w) < 1e-9 && Math.abs(tg.y - r * L.h) < 1e-9);
  }
  // cạnh chung khớp tuyệt đối: điểm cạnh phải của (r,c) (đảo) = điểm cạnh trái của (r,c+1)
  if (cols > 1) {
    const a = P.piecePath(L, 0, 0), b = P.piecePath(L, 0, 1);
    const n = a.filter(s => s[0] === 'C').length;
    assert.ok(n >= 4 && b.filter(s => s[0] === 'C').length >= 4);
    const sharedA = P.edgePoints([L.w, 0], [L.w, L.h], [-1, 0], L.vE[0][1], L.h, L.t);
    assert.deepStrictEqual(sharedA[0], [L.w, 0]);
    assert.ok(Math.abs(sharedA[sharedA.length - 1][1] - L.h) < 1e-9);
  }
  // scatter
  const world = P.world(false), wp = P.world(true);
  [world, wp].forEach(wd => {
    const pos = P.scatter(L, wd.tray, cols * rows, P.mulberry32(5));
    assert.strictEqual(pos.length, cols * rows);
    pos.forEach(p => {
      const bb = P.bbox(L, p.x, p.y);
      assert.ok(bb.x >= wd.tray.x - 1e-6 && bb.y >= wd.tray.y - 1e-6 && bb.x + bb.w <= wd.tray.x + wd.tray.w + 1e-6 && bb.y + bb.h <= wd.tray.y + wd.tray.h + 1e-6, 'ngoài khay');
      assert.ok(bb.x >= 0 && bb.y >= 0 && bb.x + bb.w <= wd.W && bb.y + bb.h <= wd.H);
      const fr = wd.frame; // không chồng khung đích
      assert.ok(bb.x + bb.w <= fr.x || bb.x >= fr.x + fr.w || bb.y + bb.h <= fr.y || bb.y >= fr.y + fr.h, 'chồng khung');
    });
    assert.ok(new Set(pos.map(p => Math.round(p.x) + ',' + Math.round(p.y))).size > pos.length * 0.8);
  });
}
// snap
const L = P.makeLayout(4, 4), th = 0.25 * Math.min(L.w, L.h);
assert.ok(P.snapTest(100, 100, 100, 100, L));
assert.ok(P.snapTest(100 + th - 0.01, 100, 100, 100, L));
assert.ok(!P.snapTest(100 + th + 0.01, 100, 100, 100, L));
assert.ok(P.snapTest(100 + th * 0.7, 100 + th * 0.7, 100, 100, L));
assert.ok(!P.snapTest(100 + th * 0.8, 100 + th * 0.8, 100, 100, L));
console.log('puzzle tests OK');
