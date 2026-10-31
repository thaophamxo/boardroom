/* Cờ Caro (Gomoku) – engine thuần (chạy được trong Node).
 * board[i]: 0 trống, 1 = X, 2 = O; i = r*size + c. s.turn: 0 = X đi, 1 = O đi.
 * Luật: >=5 liền thắng. Nếu s.block = true: hàng bị chặn cả 2 đầu (quân đối thủ hoặc mép bàn) không tính.
 */
(function () {
  'use strict';
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function newGame(size, block) {
    size = size || 15;
    return { size: size, board: new Uint8Array(size * size), turn: 0, block: !!block, last: -1,
             moves: [], winner: -1, line: null, over: false, draw: false };
  }
  function clone(s) {
    return { size: s.size, board: s.board.slice(), turn: s.turn, block: s.block, last: s.last,
             moves: s.moves.slice(), winner: s.winner, line: s.line ? s.line.slice() : null, over: s.over, draw: s.draw };
  }
  function inb(size, r, c) { return r >= 0 && c >= 0 && r < size && c < size; }

  // Phân tích 1 hướng quanh (r,c) giả sử ô đó là `color`.
  // Trả {len, a, b, openA, openB, ext} ; a/b = số quân liên tiếp mỗi phía; open = đầu còn trống trong bàn;
  // ext = số quân cùng màu nằm sau 1 ô trống ở phía có thể nối (để nhận ra "bốn cách quãng").
  function analyze(board, size, r, c, color, d) {
    var dr = d[0], dc = d[1], a = 0, b = 0, rr, cc;
    rr = r + dr; cc = c + dc;
    while (inb(size, rr, cc) && board[rr * size + cc] === color) { a++; rr += dr; cc += dc; }
    var openA = inb(size, rr, cc) && board[rr * size + cc] === 0, eA = 0;
    if (openA) { var r2 = rr + dr, c2 = cc + dc; while (inb(size, r2, c2) && board[r2 * size + c2] === color) { eA++; r2 += dr; c2 += dc; } }
    rr = r - dr; cc = c - dc;
    while (inb(size, rr, cc) && board[rr * size + cc] === color) { b++; rr -= dr; cc -= dc; }
    var openB = inb(size, rr, cc) && board[rr * size + cc] === 0, eB = 0;
    if (openB) { var r3 = rr - dr, c3 = cc - dc; while (inb(size, r3, c3) && board[r3 * size + c3] === color) { eB++; r3 -= dr; c3 -= dc; } }
    return { len: a + b + 1, a: a, b: b, openA: openA, openB: openB, eA: eA, eB: eB };
  }

  function lineWins(an, block) {
    if (an.len < 5) return false;
    if (block && !an.openA && !an.openB) return false;
    return true;
  }

  // Kiểm tra quân vừa đặt ở (r,c) có thắng không. Trả mảng chỉ số dãy thắng hoặc null.
  function checkWin(board, size, r, c, block) {
    var color = board[r * size + c];
    if (!color) return null;
    for (var k = 0; k < 4; k++) {
      var d = DIRS[k], an = analyze(board, size, r, c, color, d);
      if (lineWins(an, block)) {
        var line = [];
        for (var i = -an.b; i <= an.a; i++) line.push((r + d[0] * i) * size + (c + d[1] * i));
        return line;
      }
    }
    return null;
  }

  function play(s, r, c) {
    if (s.over || !inb(s.size, r, c)) return { ok: false };
    var i = r * s.size + c;
    if (s.board[i] !== 0) return { ok: false };
    s.board[i] = s.turn + 1; s.last = i; s.moves.push(i);
    var line = checkWin(s.board, s.size, r, c, s.block);
    if (line) { s.over = true; s.winner = s.turn; s.line = line; return { ok: true, win: true, line: line }; }
    if (s.moves.length >= s.size * s.size) { s.over = true; s.draw = true; return { ok: true, draw: true }; }
    s.turn ^= 1;
    return { ok: true };
  }

  // Lùi n nước (không dùng khi đã kết thúc nếu không muốn; vẫn hợp lệ).
  function undo(s, n) {
    n = n || 1;
    while (n-- > 0 && s.moves.length) {
      var i = s.moves.pop(); s.board[i] = 0;
      s.turn = s.moves.length % 2;
    }
    s.last = s.moves.length ? s.moves[s.moves.length - 1] : -1;
    s.over = false; s.winner = -1; s.line = null; s.draw = false;
  }

  // ---------- AI ----------
  var LV = { win: 100000 };
  // Đánh giá đặt `color` vào ô trống (r,c): {score, win, fours, threes}
  function evalCell(board, size, r, c, color, block) {
    var i = r * size + c, score = 0, fours = 0, threes = 0, win = false;
    board[i] = color;
    for (var k = 0; k < 4; k++) {
      var an = analyze(board, size, r, c, color, DIRS[k]);
      var len = an.len, ends = (an.openA ? 1 : 0) + (an.openB ? 1 : 0);
      if (lineWins(an, block)) { win = true; score += LV.win; continue; }
      if (len >= 5) { // bị chặn cả hai đầu theo luật chặn: vô giá trị
        continue;
      }
      var gap = Math.max(an.openA ? an.eA : 0, an.openB ? an.eB : 0);
      if (len === 4) {
        if (ends === 2) { score += 10000; fours += 2; }
        else if (ends === 1) { score += 2000; fours++; }
      } else if (len + gap >= 5 && gap > 0 && len >= 2) { // bốn cách quãng (vd XX_XX)
        score += 1800; fours++;
      } else if (len === 3) {
        if (ends === 2) {
          score += (len + gap >= 4 && gap > 0) ? 1500 : 1000; threes++;
        } else if (ends === 1) score += 100;
      } else if (len === 2) {
        if (ends === 2) score += (gap > 0 ? 140 : 100); else if (ends === 1) score += 10;
      } else if (ends === 2) score += 2;
      else if (ends === 1) score += 1;
    }
    board[i] = 0;
    return { score: score, win: win, fours: fours, threes: threes };
  }

  function candidates(s, rad) {
    var size = s.size, b = s.board, out = [], mark = new Uint8Array(size * size), any = false;
    rad = rad || 2;
    for (var i = 0; i < b.length; i++) {
      if (!b[i]) continue;
      any = true;
      var r = (i / size) | 0, c = i % size;
      for (var dr = -rad; dr <= rad; dr++) for (var dc = -rad; dc <= rad; dc++) {
        var rr = r + dr, cc = c + dc;
        if (inb(size, rr, cc)) { var j = rr * size + cc; if (!b[j] && !mark[j]) { mark[j] = 1; out.push(j); } }
      }
    }
    if (!any) { var m = (size / 2) | 0; out.push(m * size + m); }
    return out;
  }

  function doubleThreat(e) { return e.fours >= 2 || (e.fours >= 1 && e.threes >= 1) || e.threes >= 2; }

  // Trả {r,c} hoặc null nếu bàn đầy.
  function aiMove(s, level, opts) {
    opts = opts || {};
    level = level || 2;
    var rnd = opts.rnd || Math.random, size = s.size, board = s.board.slice();
    var me = s.turn + 1, opp = 3 - me, block = s.block;
    var cands = candidates(s, 2);
    if (!cands.length) {
      for (var z = 0; z < board.length; z++) if (!board[z]) cands.push(z);
      if (!cands.length) return null;
    }
    var info = [], i, j;
    for (i = 0; i < cands.length; i++) {
      var idx = cands[i], r = (idx / size) | 0, c = idx % size;
      info.push({ idx: idx, r: r, c: c, a: evalCell(board, size, r, c, me, block), d: evalCell(board, size, r, c, opp, block) });
    }
    // thắng ngay / chặn thua ngay
    var winNow = null, blockNow = null;
    for (i = 0; i < info.length; i++) { if (info[i].a.win) { winNow = info[i]; break; } }
    if (winNow && !(level === 1 && rnd() < 0.1)) return { r: winNow.r, c: winNow.c };
    for (i = 0; i < info.length; i++) { if (info[i].d.win) { blockNow = info[i]; break; } }
    if (blockNow && !(level === 1 && rnd() < 0.2)) return { r: blockNow.r, c: blockNow.c };

    var defW = level === 1 ? 0.6 : level === 2 ? 0.95 : 1.05;
    var noise = level === 1 ? 0.7 : level === 2 ? 0.18 : 0.05;
    for (i = 0; i < info.length; i++) {
      var it = info[i];
      var sc = it.a.score + it.d.score * defW;
      if (level >= 2) {
        if (doubleThreat(it.a)) sc += 30000;
        if (doubleThreat(it.d)) sc += 16000;
      }
      // ưu tiên gần trung tâm khi điểm ngang nhau
      var cr = Math.abs(it.r - (size - 1) / 2), cc2 = Math.abs(it.c - (size - 1) / 2);
      sc += (size - cr - cc2) * 0.3;
      it.sc = sc;
    }
    info.sort(function (x, y) { return y.sc - x.sc; });

    if (level === 3) {
      var deadline = Date.now() + (opts.timeMs || 800), top = info.slice(0, 10);
      for (i = 0; i < top.length; i++) {
        if (Date.now() > deadline) break;
        var t = top[i];
        if (t.sc >= 30000) continue; // đã quyết định
        board[t.idx] = me;
        // phản đòn tốt nhất của đối thủ
        var oc = candidates({ size: size, board: board }, 1), best = 0, bestMine = 0;
        for (j = 0; j < oc.length; j++) {
          var rr = (oc[j] / size) | 0, c3 = oc[j] % size;
          var eo = evalCell(board, size, rr, c3, opp, block), v = eo.score;
          if (doubleThreat(eo)) v += 30000;
          if (v > best) best = v;
        }
        board[t.idx] = 0;
        t.sc -= best * 0.55;
      }
      info.sort(function (x, y) { return y.sc - x.sc; });
    }

    var pick = info[0];
    if (level === 1 && info.length > 3 && rnd() < 0.2) pick = info[1 + ((rnd() * Math.min(4, info.length - 1)) | 0)];
    else if (noise) {
      var bs = -1e18;
      for (i = 0; i < Math.min(info.length, 6); i++) {
        var v2 = info[i].sc * (1 + (rnd() - 0.5) * 2 * noise);
        if (v2 > bs) { bs = v2; pick = info[i]; }
      }
    }
    return { r: pick.r, c: pick.c };
  }

  var GomokuEngine = {
    newGame: newGame, clone: clone, play: play, undo: undo, checkWin: checkWin, aiMove: aiMove, analyze: analyze
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GomokuEngine; else window.GomokuEngine = GomokuEngine;
})();
