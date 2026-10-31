/* Cờ Vây – engine thuần (chạy được trong Node).
 * Quy ước: board[i] = 0 trống, 1 Đen, 2 Trắng; i = r*size + c.
 * s.turn: 0 = Đen đi, 1 = Trắng đi (màu quân = turn + 1).
 * Luật Ko: dùng POSITIONAL SUPERKO bằng hash Zobrist (không cho phép tạo lại bất kỳ
 *   thế cờ nào đã xuất hiện trước đó, bất kể bên đi). Playout của AI dùng ko đơn giản
 *   (koMode = 'simple': chỉ cấm tái lập thế cờ ngay trước đó) cho nhanh.
 * Chấm điểm: Trung Quốc (area): quân + ô trống chỉ giáp một màu + komi cho Trắng.
 */
(function () {
  'use strict';

  var MAXN = 361;
  var Z1 = [new Int32Array(MAXN), new Int32Array(MAXN)];
  var Z2 = [new Int32Array(MAXN), new Int32Array(MAXN)];
  (function seed() {
    var a = 0x9e3779b9;
    function rnd() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) | 0;
    }
    for (var k = 0; k < 2; k++) for (var i = 0; i < MAXN; i++) { Z1[k][i] = rnd(); Z2[k][i] = rnd(); }
  })();

  var NBCACHE = {};
  function getNB(size) {
    if (NBCACHE[size]) return NBCACHE[size];
    var nb = [];
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
      var l = [];
      if (r > 0) l.push((r - 1) * size + c);
      if (c > 0) l.push(r * size + c - 1);
      if (c < size - 1) l.push(r * size + c + 1);
      if (r < size - 1) l.push((r + 1) * size + c);
      nb.push(l);
    }
    NBCACHE[size] = nb;
    return nb;
  }

  function komiFor(size) { return size === 9 ? 6.5 : 7.5; }
  function keyOf(h1, h2) { return (h2 & 0x1fffff) * 4294967296 + (h1 >>> 0); }

  function newGame(size) {
    size = size || 9;
    var s = {
      size: size, board: new Uint8Array(size * size), turn: 0, caps: [0, 0], passes: 0,
      h1: 0, h2: 0, key: 0, prevKey: -1, seen: new Set(), last: -1, moveCount: 0,
      koMode: 'super', komi: komiFor(size)
    };
    s.key = keyOf(0, 0);
    s.seen.add(s.key);
    return s;
  }

  function clone(s, light) {
    return {
      size: s.size, board: s.board.slice(), turn: s.turn, caps: s.caps.slice(), passes: s.passes,
      h1: s.h1, h2: s.h2, key: s.key, prevKey: s.prevKey,
      seen: light ? null : new Set(s.seen), last: s.last, moveCount: s.moveCount,
      koMode: light ? 'simple' : s.koMode, komi: s.komi
    };
  }

  // Nhóm quân liền kề chứa idx: {stones:[], libs:số khí, libList:[]}
  function group(board, size, idx) {
    var nb = getNB(size), col = board[idx];
    var stones = [idx], seen = {}; seen[idx] = 1;
    var libSeen = {}, libList = [];
    for (var h = 0; h < stones.length; h++) {
      var ns = nb[stones[h]];
      for (var k = 0; k < ns.length; k++) {
        var q = ns[k];
        if (board[q] === 0) { if (!libSeen[q]) { libSeen[q] = 1; libList.push(q); } }
        else if (board[q] === col && !seen[q]) { seen[q] = 1; stones.push(q); }
      }
    }
    return { stones: stones, libs: libList.length, libList: libList };
  }

  // Thử nước đi (không sửa s). Trả {ok, board, captured, h1, h2, key} hoặc {ok:false, reason}
  function tryMove(s, idx, color) {
    var size = s.size, board = s.board;
    color = color || (s.turn + 1);
    if (idx < 0 || idx >= size * size || board[idx] !== 0) return { ok: false, reason: 'occupied' };
    var nb = getNB(size), opp = 3 - color;
    var b = board.slice(); b[idx] = color;
    var h1 = s.h1 ^ Z1[color - 1][idx], h2 = s.h2 ^ Z2[color - 1][idx];
    var captured = [];
    var ns = nb[idx];
    for (var k = 0; k < ns.length; k++) {
      var q = ns[k];
      if (b[q] === opp) {
        var g = group(b, size, q);
        if (g.libs === 0) {
          for (var j = 0; j < g.stones.length; j++) {
            var x = g.stones[j]; b[x] = 0; captured.push(x);
            h1 ^= Z1[opp - 1][x]; h2 ^= Z2[opp - 1][x];
          }
        }
      }
    }
    var own = group(b, size, idx);
    if (own.libs === 0) return { ok: false, reason: 'suicide' };
    var key = keyOf(h1, h2);
    if (s.koMode === 'simple') { if (key === s.prevKey) return { ok: false, reason: 'ko' }; }
    else if (s.seen.has(key)) return { ok: false, reason: 'ko' };
    return { ok: true, board: b, captured: captured, h1: h1, h2: h2, key: key, libs: own.libs, size: own.stones.length };
  }

  // Đi thật (sửa s). Trả như tryMove.
  function play(s, idx) {
    var r = tryMove(s, idx);
    if (!r.ok) return r;
    s.board = r.board;
    s.caps[s.turn] += r.captured.length;
    s.h1 = r.h1; s.h2 = r.h2;
    s.prevKey = s.key; s.key = r.key;
    if (s.seen) s.seen.add(r.key);
    s.last = idx; s.passes = 0; s.turn ^= 1; s.moveCount++;
    return r;
  }

  // Bỏ lượt. Trả {scoring: true} khi đã 2 pass liên tiếp.
  function pass(s) {
    s.passes++; s.turn ^= 1; s.last = -1; s.moveCount++;
    s.prevKey = s.key; // pass không đổi thế cờ
    return { scoring: s.passes >= 2 };
  }

  function isOver(s) { return s.passes >= 2; }

  function legalMoves(s) {
    var out = [];
    for (var i = 0; i < s.size * s.size; i++) if (s.board[i] === 0 && tryMove(s, i).ok) out.push(i);
    return out;
  }

  // Chấm điểm area. dead: mảng chỉ số quân chết (bị nhấc khỏi bàn trước khi tính).
  function score(s, dead) {
    var size = s.size, n = size * size, nb = getNB(size);
    var b = s.board.slice();
    if (dead) for (var d = 0; d < dead.length; d++) b[dead[d]] = 0;
    var owner = new Uint8Array(n);
    var stones = [0, 0, 0];
    for (var i = 0; i < n; i++) if (b[i]) stones[b[i]]++;
    var terr = [0, 0, 0];
    var seen = new Uint8Array(n);
    for (var st = 0; st < n; st++) {
      if (b[st] !== 0 || seen[st]) continue;
      var reg = [st], mask = 0; seen[st] = 1;
      for (var h = 0; h < reg.length; h++) {
        var ns = nb[reg[h]];
        for (var k = 0; k < ns.length; k++) {
          var q = ns[k];
          if (b[q] === 0) { if (!seen[q]) { seen[q] = 1; reg.push(q); } }
          else mask |= b[q];
        }
      }
      if (mask === 1 || mask === 2) {
        terr[mask] += reg.length;
        for (var m = 0; m < reg.length; m++) owner[reg[m]] = mask;
      }
    }
    var black = stones[1] + terr[1], white = stones[2] + terr[2];
    var komi = s.komi;
    var whiteTotal = white + komi;
    return {
      black: black, white: white, komi: komi, blackTotal: black, whiteTotal: whiteTotal,
      diff: black - whiteTotal, winner: black > whiteTotal ? 0 : 1,
      owner: owner, board: b
    };
  }

  // ---------- AI ----------
  function isTrueEye(b, size, idx, color) {
    var nb = getNB(size), ns = nb[idx];
    for (var k = 0; k < ns.length; k++) if (b[ns[k]] !== color) return false;
    var r = (idx / size) | 0, c = idx % size, bad = 0, edge = (ns.length < 4);
    for (var dr = -1; dr <= 1; dr += 2) for (var dc = -1; dc <= 1; dc += 2) {
      var rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) { edge = true; continue; }
      if (b[rr * size + cc] !== color) bad++;
    }
    return edge ? bad === 0 : bad <= 1;
  }

  function emptyRegions(b, size) {
    var n = size * size, nb = getNB(size);
    var id = new Int16Array(n).fill(-1), info = [];
    for (var st = 0; st < n; st++) {
      if (b[st] !== 0 || id[st] >= 0) continue;
      var reg = [st], mask = 0; id[st] = info.length;
      for (var h = 0; h < reg.length; h++) {
        var ns = nb[reg[h]];
        for (var k = 0; k < ns.length; k++) {
          var q = ns[k];
          if (b[q] === 0) { if (id[q] < 0) { id[q] = info.length; reg.push(q); } }
          else mask |= b[q];
        }
      }
      info.push({ size: reg.length, mask: mask });
    }
    return { id: id, info: info };
  }

  function heuristicScores(s) {
    var size = s.size, n = size * size, b = s.board, nb = getNB(size);
    var me = s.turn + 1, opp = 3 - me;
    var stoneList = [];
    for (var i = 0; i < n; i++) if (b[i]) stoneList.push(i);
    var reg = emptyRegions(b, size);
    var early = stoneList.length < n * 0.12;
    var res = [];
    for (var idx = 0; idx < n; idx++) {
      if (b[idx] !== 0) continue;
      var r = tryMove(s, idx);
      if (!r.ok) continue;
      var cap = r.captured.length;
      var rr = (idx / size) | 0, cc = idx % size;
      var sc = 0;
      var ns = nb[idx];
      // nhóm mình đang atari kề đây (trước nước đi)
      var saved = 0, seenG = {};
      var allOwn = true;
      for (var k = 0; k < ns.length; k++) {
        var q = ns[k];
        if (b[q] !== me) allOwn = false;
        if (b[q] === me && !seenG[q]) {
          var g0 = group(b, size, q);
          for (var z = 0; z < g0.stones.length; z++) seenG[g0.stones[z]] = 1;
          if (g0.libs === 1) saved += g0.stones.length;
        }
      }
      // vùng trống
      var rinfo = reg.info[reg.id[idx]];
      var terrOwn = false, terrOpp = false;
      if (rinfo && rinfo.size <= Math.max(6, n * 0.3)) {
        if (rinfo.mask === me) terrOwn = true; else if (rinfo.mask === opp) terrOpp = true;
      }
      if (cap === 0 && saved === 0) {
        if (isTrueEye(b, size, idx, me)) continue;       // không tự lấp mắt
        if (terrOwn) continue;                            // không đi vào đất của mình
      }
      sc += cap * 12;
      var L = r.libs, gs = r.size;
      if (L === 1 && cap === 0) sc -= 8 + 4 * gs;
      else if (L === 1) sc -= 3;
      sc += Math.min(L, 6) * 0.7;
      if (saved) { if (L >= 2) sc += 8 + 2 * saved; }
      // đặt đối thủ vào atari
      var seenO = {};
      for (k = 0; k < ns.length; k++) {
        q = ns[k];
        if (r.board[q] === opp && !seenO[q]) {
          var go = group(r.board, size, q);
          for (z = 0; z < go.stones.length; z++) seenO[go.stones[z]] = 1;
          if (go.libs === 1) sc += 5 + 1.5 * go.stones.length;
          else if (go.libs === 2) sc += 1;
        }
      }
      if (allOwn && cap === 0 && saved === 0) sc -= 6;
      if (terrOpp && cap === 0) sc -= 4;
      // vị trí
      var line = Math.min(rr, cc, size - 1 - rr, size - 1 - cc);
      if (line === 0) sc -= 4; else if (line === 1) sc -= 1.5;
      if (early) {
        if (line === 2 || (line === 3 && size > 9)) sc += 3;
        else if (line === 3) sc += 1.5;
        var hs = size === 9 ? [2, 4, 6] : [3, (size - 1) / 2, size - 4];
        if (hs.indexOf(rr) >= 0 && hs.indexOf(cc) >= 0) sc += 2;
      }
      if (stoneList.length) {
        var dmin = 99;
        for (var t = 0; t < stoneList.length; t++) {
          var sr = (stoneList[t] / size) | 0, sci = stoneList[t] % size;
          var d = Math.max(Math.abs(sr - rr), Math.abs(sci - cc));
          if (d < dmin) dmin = d;
        }
        if (dmin === 1) sc += 1.5; else if (dmin === 2) sc += 2.5; else if (dmin === 3) sc += 1; else sc -= 1;
        for (k = 0; k < ns.length; k++) if (b[ns[k]] === opp) { sc += 1; break; }
      }
      res.push({ idx: idx, score: sc, cap: cap });
    }
    return res;
  }

  function randomPlayout(s0, me, rnd) {
    var s = clone(s0, true), size = s.size, n = size * size, maxMoves = n * 2;
    var passes = 0, mv = 0;
    while (passes < 2 && mv < maxMoves) {
      var color = s.turn + 1, moved = false;
      for (var tries = 0; tries < 24; tries++) {
        var i = (rnd() * n) | 0;
        if (s.board[i] !== 0) continue;
        if (isTrueEye(s.board, size, i, color)) continue;
        var r = play(s, i);
        if (r.ok) { moved = true; break; }
      }
      if (moved) passes = 0; else { s.turn ^= 1; passes++; }
      mv++;
    }
    var sc = score(s, null);
    return (sc.winner === me - 1) ? 1 : 0;
  }

  // Trả chỉ số nước đi hoặc -1 (pass).
  function aiMove(s, level, opts) {
    opts = opts || {};
    level = level || 2;
    var rnd = opts.rnd || Math.random;
    var size = s.size, n = size * size, me = s.turn + 1;
    // Đối thủ vừa pass và mình đang dẫn theo area score → pass
    if (s.passes >= 1 && s.moveCount > 4) {
      var sc0 = score(s, null);
      var meLead = me === 1 ? sc0.diff > 0 : sc0.diff < 0;
      if (meLead) return -1;
    }
    if (s.moveCount > n * 1.6) return -1;
    var cands = heuristicScores(s);
    if (!cands.length) return -1;
    cands.sort(function (a, b) { return b.score - a.score; });
    var noise = level === 1 ? 9 : level === 2 ? 3.5 : 1.2;
    // Level 3 trên 9x9: playout Monte Carlo ngắn cho vài ứng viên đầu
    if (level === 3 && size === 9 && cands[0].score >= 3) {
      var top = cands.slice(0, 6).filter(function (c) { return c.score > cands[0].score - 14; });
      var deadline = Date.now() + (opts.timeMs || 1000);
      var wins = top.map(function () { return 0; }), runs = top.map(function () { return 0; });
      var states = top.map(function (c) { var t = clone(s, true); play(t, c.idx); return t; });
      var round = 0;
      while (Date.now() < deadline && round < 400) {
        for (var i = 0; i < top.length; i++) {
          wins[i] += randomPlayout(states[i], me, rnd); runs[i]++;
        }
        round++;
      }
      for (var j = 0; j < top.length; j++) {
        if (runs[j]) top[j].score += (wins[j] / runs[j] - 0.5) * 16;
      }
    }
    var best = null, bs = -1e9;
    for (var q = 0; q < Math.min(cands.length, 40); q++) {
      var v = cands[q].score + rnd() * noise;
      if (v > bs) { bs = v; best = cands[q]; }
    }
    var late = s.moveCount > n * 0.45;
    var thr = late ? 4.5 : 1.5;
    if (best.score < thr && best.cap === 0) return -1;
    return best.idx;
  }

  var GoEngine = {
    newGame: newGame, clone: clone, komiFor: komiFor, tryMove: tryMove, play: play, pass: pass,
    isOver: isOver, legalMoves: legalMoves, score: score, group: group, aiMove: aiMove,
    neighbors: getNB
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GoEngine; else window.GoEngine = GoEngine;
})();
