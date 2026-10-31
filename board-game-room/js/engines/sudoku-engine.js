/* Sudoku engine: sinh đề (đúng 1 nghiệm), giải, kiểm tra xung đột. Lưới = mảng 81 số (0 = trống). */
(function () {
  var ALL = 0x1FF;
  var BOX = [];
  for (var i = 0; i < 81; i++) BOX[i] = ((i / 27) | 0) * 3 + (((i % 9) / 3) | 0);
  var POP = [];
  for (var m = 0; m < 512; m++) { var c = 0, x = m; while (x) { c += x & 1; x >>= 1; } POP[m] = c; }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Trả về {count, first} – đếm nghiệm, dừng khi đạt limit. random=true: thử số theo thứ tự ngẫu nhiên.
  function search(grid, limit, random) {
    var g = grid.slice(), rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
    for (var i = 0; i < 81; i++) {
      var v = g[i];
      if (v) {
        var b = 1 << (v - 1), r = (i / 9) | 0, c = i % 9;
        if ((rows[r] | cols[c] | boxes[BOX[i]]) & b) return { count: 0, first: null };
        rows[r] |= b; cols[c] |= b; boxes[BOX[i]] |= b;
      }
    }
    var count = 0, first = null;
    function rec() {
      var best = -1, bestMask = 0, bestN = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var mask = ALL & ~(rows[(i / 9) | 0] | cols[i % 9] | boxes[BOX[i]]);
        var n = POP[mask];
        if (n < bestN) { bestN = n; best = i; bestMask = mask; if (n <= 1) break; }
      }
      if (best < 0) { count++; if (!first) first = g.slice(); return count >= limit; }
      if (bestN === 0) return false;
      var r = (best / 9) | 0, c = best % 9, bx = BOX[best], digits = [];
      for (var d = 0; d < 9; d++) if (bestMask & (1 << d)) digits.push(d);
      if (random) shuffle(digits);
      for (var k = 0; k < digits.length; k++) {
        var bit = 1 << digits[k];
        g[best] = digits[k] + 1; rows[r] |= bit; cols[c] |= bit; boxes[bx] |= bit;
        var stop = rec();
        g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[bx] &= ~bit;
        if (stop) return true;
      }
      return false;
    }
    rec();
    return { count: count, first: first };
  }

  function countSolutions(grid, limit) { return search(grid, limit || 2, false).count; }
  function solve(grid) { return search(grid, 1, false).first; }

  function fullGrid() { return search(new Array(81).fill(0), 1, true).first; }

  var LEVELS = { easy: 40, medium: 32, hard: 26 };

  // Đục lỗ giữ nghiệm duy nhất, cố đạt `clues` ô cho sẵn (có thể nhiều hơn chút nếu không đục thêm được).
  function generate(clues) {
    if (typeof clues === 'string') clues = LEVELS[clues] || 32;
    var best = null;
    for (var attempt = 0; attempt < 6; attempt++) {
      var solution = fullGrid(), puzzle = solution.slice(), left = 81;
      var order = shuffle(Array.from({ length: 81 }, function (_, i) { return i; }));
      for (var k = 0; k < 81 && left > clues; k++) {
        var i = order[k], keep = puzzle[i];
        puzzle[i] = 0;
        if (countSolutions(puzzle, 2) !== 1) puzzle[i] = keep; else left--;
      }
      if (!best || left < best.left) best = { puzzle: puzzle, solution: solution, left: left };
      if (left <= clues) break;
    }
    return { puzzle: best.puzzle, solution: best.solution, clues: best.left };
  }

  // Tập chỉ số các ô bị trùng (cùng số trong hàng/cột/khối).
  function conflicts(grid) {
    var bad = {};
    function scan(idx) {
      var seen = {};
      idx.forEach(function (i) {
        var v = grid[i]; if (!v) return;
        (seen[v] = seen[v] || []).push(i);
      });
      for (var v in seen) if (seen[v].length > 1) seen[v].forEach(function (i) { bad[i] = true; });
    }
    for (var u = 0; u < 9; u++) {
      var r = [], c = [], b = [];
      for (var k = 0; k < 9; k++) {
        r.push(u * 9 + k); c.push(k * 9 + u);
        b.push((((u / 3) | 0) * 3 + ((k / 3) | 0)) * 9 + (u % 3) * 3 + (k % 3));
      }
      scan(r); scan(c); scan(b);
    }
    return Object.keys(bad).map(Number);
  }

  // Số v đặt vào ô i có trùng với ô khác không.
  function hasConflict(grid, i, v) {
    if (!v) return false;
    var r = (i / 9) | 0, c = i % 9;
    for (var k = 0; k < 81; k++) {
      if (k === i || grid[k] !== v) continue;
      if (((k / 9) | 0) === r || k % 9 === c || BOX[k] === BOX[i]) return true;
    }
    return false;
  }

  function isComplete(grid) {
    for (var i = 0; i < 81; i++) if (!grid[i]) return false;
    return conflicts(grid).length === 0;
  }

  var X = { generate: generate, solve: solve, countSolutions: countSolutions, conflicts: conflicts,
            hasConflict: hasConflict, isComplete: isComplete, LEVELS: LEVELS, boxOf: function (i) { return BOX[i]; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = X; else window.SudokuEngine = X;
})();
