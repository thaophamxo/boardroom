/* Cờ tướng – engine thuần (không phụ thuộc DOM).
 * Bàn 9 cột × 10 hàng. Ô = r*9 + c, r=0 là hàng trên cùng (phía Đen), r=9 là hàng dưới cùng (phía Đỏ).
 * Bên 0 = Đỏ (đi trước, ở dưới), bên 1 = Đen.
 * Quân: mã số = loại | (bên << 3). Loại: 1 Tướng, 2 Sĩ, 3 Tượng, 4 Mã, 5 Xe, 6 Pháo, 7 Tốt. 0 = ô trống.
 * Nước đi mã hoá thành số: from | (to << 7).
 */
(function () {
  'use strict';

  var K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;
  var START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
  var LETTERS = { K: K, A: A, B: B, N: N, R: R, C: C, P: P };
  var CHAR_OF = ['', 'K', 'A', 'B', 'N', 'R', 'C', 'P'];
  var ROW = [], COL = [];
  for (var i = 0; i < 90; i++) { ROW.push((i / 9) | 0); COL.push(i % 9); }

  function enc(from, to) { return from | (to << 7); }
  function mFrom(m) { return m & 127; }
  function mTo(m) { return m >> 7; }

  /* ---------- FEN ---------- */
  function parseFEN(fen) {
    var parts = String(fen || START_FEN).trim().split(/\s+/);
    var rows = parts[0].split('/');
    if (rows.length !== 10) throw new Error('FEN không hợp lệ: cần 10 hàng');
    var b = new Int8Array(90), kp = [-1, -1];
    for (var r = 0; r < 10; r++) {
      var c = 0, s = rows[r];
      for (var k = 0; k < s.length; k++) {
        var ch = s[k];
        if (ch >= '0' && ch <= '9') { c += +ch; continue; }
        var up = ch.toUpperCase();
        if (!LETTERS[up] || c > 8) throw new Error('FEN không hợp lệ: ' + ch);
        var col = ch === up ? 0 : 1;
        b[r * 9 + c] = LETTERS[up] | (col << 3);
        if (LETTERS[up] === K) kp[col] = r * 9 + c;
        c++;
      }
      if (c !== 9) throw new Error('FEN không hợp lệ: hàng ' + r + ' không đủ 9 cột');
    }
    var t = (parts[1] || 'w').toLowerCase();
    return { b: b, turn: (t === 'b') ? 1 : 0, kp: kp };
  }
  function toFEN(pos, half, full) {
    var rows = [];
    for (var r = 0; r < 10; r++) {
      var s = '', e = 0;
      for (var c = 0; c < 9; c++) {
        var p = pos.b[r * 9 + c];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        var ch = CHAR_OF[p & 7];
        s += (p >> 3) ? ch.toLowerCase() : ch;
      }
      if (e) s += e;
      rows.push(s);
    }
    return rows.join('/') + ' ' + (pos.turn ? 'b' : 'w') + ' - - ' + (half || 0) + ' ' + (full || 1);
  }
  function clone(pos) { return { b: pos.b.slice(), turn: pos.turn, kp: pos.kp.slice() }; }
  function posKey(pos) {
    var s = '';
    for (var i = 0; i < 90; i++) s += String.fromCharCode(65 + pos.b[i]);
    return s + pos.turn;
  }

  /* ---------- sinh nước đi ---------- */
  var ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var HORSE = [[-1, 0, -2, -1], [-1, 0, -2, 1], [1, 0, 2, -1], [1, 0, 2, 1],
               [0, -1, -1, -2], [0, -1, 1, -2], [0, 1, -1, 2], [0, 1, 1, 2]];

  function inPalace(side, r, c) {
    return c >= 3 && c <= 5 && (side === 0 ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2));
  }

  // pseudo-legal; capsOnly = chỉ nước ăn quân
  function genMoves(pos, capsOnly) {
    var b = pos.b, side = pos.turn, out = [], sq, p, t, r, c, d, nr, nc, to, q, k;
    for (sq = 0; sq < 90; sq++) {
      p = b[sq];
      if (!p || (p >> 3) !== side) continue;
      t = p & 7; r = ROW[sq]; c = COL[sq];
      if (t === K) {
        for (d = 0; d < 4; d++) {
          nr = r + ORTH[d][0]; nc = c + ORTH[d][1];
          if (!inPalace(side, nr, nc)) continue;
          to = nr * 9 + nc; q = b[to];
          if (q ? (q >> 3) !== side : !capsOnly) out.push(sq | (to << 7));
        }
      } else if (t === A) {
        for (d = 0; d < 4; d++) {
          nr = r + DIAG[d][0]; nc = c + DIAG[d][1];
          if (!inPalace(side, nr, nc)) continue;
          to = nr * 9 + nc; q = b[to];
          if (q ? (q >> 3) !== side : !capsOnly) out.push(sq | (to << 7));
        }
      } else if (t === B) {
        for (d = 0; d < 4; d++) {
          nr = r + DIAG[d][0] * 2; nc = c + DIAG[d][1] * 2;
          if (nr < 0 || nr > 9 || nc < 0 || nc > 8) continue;
          if (side === 0 ? nr < 5 : nr > 4) continue;
          if (b[(r + DIAG[d][0]) * 9 + c + DIAG[d][1]]) continue; // cản mắt tượng
          to = nr * 9 + nc; q = b[to];
          if (q ? (q >> 3) !== side : !capsOnly) out.push(sq | (to << 7));
        }
      } else if (t === N) {
        for (d = 0; d < 8; d++) {
          var h = HORSE[d];
          if (r + h[0] < 0 || r + h[0] > 9 || c + h[1] < 0 || c + h[1] > 8) continue;
          if (b[(r + h[0]) * 9 + c + h[1]]) continue; // cản chân mã
          nr = r + h[2]; nc = c + h[3];
          if (nr < 0 || nr > 9 || nc < 0 || nc > 8) continue;
          to = nr * 9 + nc; q = b[to];
          if (q ? (q >> 3) !== side : !capsOnly) out.push(sq | (to << 7));
        }
      } else if (t === R) {
        for (d = 0; d < 4; d++) {
          nr = r + ORTH[d][0]; nc = c + ORTH[d][1];
          while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
            to = nr * 9 + nc; q = b[to];
            if (!q) { if (!capsOnly) out.push(sq | (to << 7)); }
            else { if ((q >> 3) !== side) out.push(sq | (to << 7)); break; }
            nr += ORTH[d][0]; nc += ORTH[d][1];
          }
        }
      } else if (t === C) {
        for (d = 0; d < 4; d++) {
          nr = r + ORTH[d][0]; nc = c + ORTH[d][1];
          var jumped = false;
          while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
            to = nr * 9 + nc; q = b[to];
            if (!jumped) {
              if (!q) { if (!capsOnly) out.push(sq | (to << 7)); }
              else jumped = true;
            } else if (q) {
              if ((q >> 3) !== side) out.push(sq | (to << 7));
              break;
            }
            nr += ORTH[d][0]; nc += ORTH[d][1];
          }
        }
      } else if (t === P) {
        var dr = side === 0 ? -1 : 1, crossed = side === 0 ? r <= 4 : r >= 5;
        nr = r + dr;
        if (nr >= 0 && nr <= 9) {
          to = nr * 9 + c; q = b[to];
          if (q ? (q >> 3) !== side : !capsOnly) out.push(sq | (to << 7));
        }
        if (crossed) {
          for (k = -1; k <= 1; k += 2) {
            nc = c + k;
            if (nc < 0 || nc > 8) continue;
            to = r * 9 + nc; q = b[to];
            if (q ? (q >> 3) !== side : !capsOnly) out.push(sq | (to << 7));
          }
        }
      }
    }
    return out;
  }

  /* ---------- chiếu ---------- */
  // Tướng của `side` có đang bị tấn công không (kể cả đối mặt tướng)
  function inCheck(pos, side) {
    var b = pos.b, ks = pos.kp[side];
    if (ks < 0) return false;
    var kr = ROW[ks], kc = COL[ks], en = side ^ 1;
    var d, nr, nc, q, p1, p2;
    var eR = R | (en << 3), eC = C | (en << 3), eN = N | (en << 3), eP = P | (en << 3), eK = K | (en << 3);
    for (d = 0; d < 4; d++) {
      nr = kr + ORTH[d][0]; nc = kc + ORTH[d][1];
      p1 = 0;
      while (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
        q = b[nr * 9 + nc];
        if (q) {
          if (!p1) {
            p1 = q;
            if (q === eR) return true;
            if (q === eK && ORTH[d][1] === 0) return true; // tướng đối mặt
          } else {
            if (q === eC) return true;
            break;
          }
        }
        nr += ORTH[d][0]; nc += ORTH[d][1];
      }
    }
    // Mã: ngựa tại h, chân l = k - o - p, h = k - 2o - p
    for (d = 0; d < 4; d++) {
      var o = ORTH[d];
      for (var s = -1; s <= 1; s += 2) {
        var pr = o[1] !== 0 ? s : 0, pc = o[0] !== 0 ? s : 0; // vuông góc với o
        var lr = kr - o[0] - pr, lc = kc - o[1] - pc;
        var hr = kr - 2 * o[0] - pr, hc = kc - 2 * o[1] - pc;
        if (hr < 0 || hr > 9 || hc < 0 || hc > 8) continue;
        if (b[hr * 9 + hc] === eN && !b[lr * 9 + lc]) return true;
      }
    }
    // Tốt
    var fr = side === 0 ? kr - 1 : kr + 1; // tốt địch tiến tới tướng: tốt ở hàng "phía địch" của tướng
    // Tốt Đen (en=1) đi xuống (r+1): đứng ở kr-1. Tốt Đỏ (en=0) đi lên: đứng ở kr+1.
    if (fr >= 0 && fr <= 9 && b[fr * 9 + kc] === eP) return true;
    for (var k = -1; k <= 1; k += 2) {
      nc = kc + k;
      if (nc < 0 || nc > 8) continue;
      if (b[kr * 9 + nc] === eP && (en === 1 ? kr >= 5 : kr <= 4)) return true;
    }
    return false;
  }

  function make(pos, m) {
    var from = m & 127, to = m >> 7, p = pos.b[from], cap = pos.b[to];
    pos.b[to] = p; pos.b[from] = 0;
    if ((p & 7) === K) pos.kp[p >> 3] = to;
    pos.turn ^= 1;
    return cap;
  }
  function unmake(pos, m, cap) {
    var from = m & 127, to = m >> 7, p = pos.b[to];
    pos.b[from] = p; pos.b[to] = cap;
    if ((p & 7) === K) pos.kp[p >> 3] = from;
    pos.turn ^= 1;
  }

  function legalMoves(pos) {
    var ps = genMoves(pos, false), out = [], side = pos.turn;
    for (var i = 0; i < ps.length; i++) {
      var cap = make(pos, ps[i]);
      var ok = !inCheck(pos, side);
      unmake(pos, ps[i], cap);
      if (ok) out.push(ps[i]);
    }
    return out;
  }
  function legalMovesFrom(pos, sq) {
    var all = legalMoves(pos), out = [];
    for (var i = 0; i < all.length; i++) if ((all[i] & 127) === sq) out.push(all[i] >> 7);
    return out;
  }

  function perft(pos, depth) {
    if (depth === 0) return 1;
    var ms = legalMoves(pos);
    if (depth === 1) return ms.length;
    var n = 0;
    for (var i = 0; i < ms.length; i++) {
      var cap = make(pos, ms[i]);
      n += perft(pos, depth - 1);
      unmake(pos, ms[i], cap);
    }
    return n;
  }

  /* ---------- ván cờ (lịch sử, hoà, kết quả) ---------- */
  function Game(fen) {
    this.pos = parseFEN(fen || START_FEN);
    this.records = [];
    this.keys = [posKey(this.pos)];
    this.half = 0;
  }
  Game.prototype.legalMoves = function () { return legalMoves(this.pos); };
  Game.prototype.movesFrom = function (sq) { return legalMovesFrom(this.pos, sq); };
  Game.prototype.inCheck = function () { return inCheck(this.pos, this.pos.turn); };
  Game.prototype.fen = function () { return toFEN(this.pos, this.half, 1 + (this.records.length >> 1)); };
  // Đi một nước; trả về record hoặc null nếu không hợp lệ.
  Game.prototype.play = function (from, to) {
    if (!(from >= 0 && from < 90 && to >= 0 && to < 90)) return null;
    var m = enc(from, to);
    if (legalMoves(this.pos).indexOf(m) < 0) return null;
    var p = this.pos.b[from], cap = this.pos.b[to], mover = this.pos.turn;
    make(this.pos, m);
    var rec = { from: from, to: to, piece: p, captured: cap, side: mover, prevHalf: this.half,
                check: inCheck(this.pos, this.pos.turn) };
    this.half = cap ? 0 : this.half + 1;
    this.records.push(rec);
    this.keys.push(posKey(this.pos));
    return rec;
  };
  Game.prototype.undo = function () {
    var rec = this.records.pop();
    if (!rec) return null;
    unmake(this.pos, enc(rec.from, rec.to), rec.captured);
    this.half = rec.prevHalf;
    this.keys.pop();
    return rec;
  };
  // {over, result:'win'|'draw', winner, reason:'checkmate'|'stalemate'|'repetition'|'fifty'}
  Game.prototype.status = function () {
    var side = this.pos.turn;
    if (legalMoves(this.pos).length === 0) {
      return { over: true, result: 'win', winner: side ^ 1,
               reason: inCheck(this.pos, side) ? 'checkmate' : 'stalemate' };
    }
    var last = this.keys[this.keys.length - 1], n = 0;
    for (var i = 0; i < this.keys.length; i++) if (this.keys[i] === last) n++;
    if (n >= 3) return { over: true, result: 'draw', winner: null, reason: 'repetition' };
    if (this.half >= 120) return { over: true, result: 'draw', winner: null, reason: 'fifty' };
    return { over: false };
  };

  /* ---------- đánh giá + AI ---------- */
  var VAL = [0, 0, 200, 200, 400, 900, 450, 100];
  function pieceScore(t, side, r, c) {
    var adv = side === 0 ? 9 - r : r, cen = 4 - Math.abs(c - 4);
    switch (t) {
      case P: return adv < 5 ? 100 : (adv === 9 ? 150 : 180 + (adv - 5) * 10 + cen * 6);
      case N: return 400 + cen * 5 + (adv >= 3 && adv <= 7 ? 10 : 0);
      case C: return 450 + (c === 4 ? 10 : 0) + (adv >= 2 ? 5 : 0);
      case R: return 900 + (adv >= 1 ? 5 : 0);
      case A: return 200;
      case B: return 200;
    }
    return 0;
  }
  var PS = [new Int16Array(8 * 90), new Int16Array(8 * 90)];
  for (var sd = 0; sd < 2; sd++) for (var ty = 1; ty <= 7; ty++) for (var s0 = 0; s0 < 90; s0++) {
    PS[sd][ty * 90 + s0] = pieceScore(ty, sd, ROW[s0], COL[s0]);
  }
  function evaluate(pos) { // theo góc nhìn bên đang đi
    var b = pos.b, sc = 0;
    for (var i = 0; i < 90; i++) {
      var p = b[i];
      if (!p) continue;
      var v = PS[p >> 3][(p & 7) * 90 + i];
      sc += (p >> 3) === 0 ? v : -v;
    }
    return (pos.turn === 0 ? sc : -sc) + 5;
  }

  var MATE = 30000, INF = 32000;

  // pos0: vị trí; level 1-3; opts {timeMs, maxDepth}. Trả {from,to,score,depth} hoặc null.
  function bestMove(pos0, level, opts) {
    opts = opts || {};
    level = level || 2;
    var pos = clone(pos0);
    var timeLimit = opts.timeMs || (level >= 3 ? 1100 : level === 2 ? 700 : 300);
    var maxDepth = opts.maxDepth || (level >= 3 ? 12 : level === 2 ? 3 : 1);
    var t0 = Date.now(), nodes = 0, stop = false;
    var killers = [];
    for (var z = 0; z < 64; z++) killers.push([0, 0]);
    var history = new Int32Array(8192);

    var root = legalMoves(pos);
    if (!root.length) return null;
    shuffle(root);
    if (root.length === 1) return { from: root[0] & 127, to: root[0] >> 7, score: 0, depth: 0 };

    function shuffle(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t;
      }
    }
    function orderScore(m, ply, ttm) {
      if (m === ttm) return 1e7;
      var cap = pos.b[m >> 7];
      if (cap) return 1e6 + VAL[cap & 7] * 10 - (pos.b[m & 127] & 7);
      var k = killers[ply];
      if (k && (m === k[0] || m === k[1])) return 5e5;
      return history[m & 8191];
    }
    function sortMoves(ms, ply, ttm) {
      var sc = new Array(ms.length), i, j;
      for (i = 0; i < ms.length; i++) sc[i] = orderScore(ms[i], ply, ttm);
      // insertion sort (danh sách ngắn, ổn định)
      for (i = 1; i < ms.length; i++) {
        var m = ms[i], s = sc[i];
        for (j = i - 1; j >= 0 && sc[j] < s; j--) { ms[j + 1] = ms[j]; sc[j + 1] = sc[j]; }
        ms[j + 1] = m; sc[j + 1] = s;
      }
    }
    function tick() {
      if ((++nodes & 1023) === 0 && Date.now() - t0 > timeLimit) stop = true;
      return stop;
    }
    function qs(alpha, beta, ply) {
      if (tick()) return 0;
      var stand = evaluate(pos);
      if (stand >= beta) return stand;
      if (ply >= 24) return stand;
      if (stand > alpha) alpha = stand;
      var ms = genMoves(pos, true), side = pos.turn;
      sortMoves(ms, 63, 0);
      for (var i = 0; i < ms.length; i++) {
        var victim = pos.b[ms[i] >> 7] & 7;
        if (stand + VAL[victim] + 150 < alpha) continue;
        var cap = make(pos, ms[i]);
        if (inCheck(pos, side)) { unmake(pos, ms[i], cap); continue; }
        var sc = -qs(-beta, -alpha, ply + 1);
        unmake(pos, ms[i], cap);
        if (stop) return 0;
        if (sc >= beta) return sc;
        if (sc > alpha) alpha = sc;
      }
      return alpha;
    }
    function negamax(depth, alpha, beta, ply) {
      if (tick()) return 0;
      if (depth <= 0) return qs(alpha, beta, ply);
      var ms = genMoves(pos, false), side = pos.turn, legal = 0, best = -INF;
      sortMoves(ms, ply, 0);
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i], cap = make(pos, m);
        if (inCheck(pos, side)) { unmake(pos, m, cap); continue; }
        legal++;
        var ext = (ply < 16 && inCheck(pos, pos.turn)) ? 1 : 0;
        var sc = -negamax(depth - 1 + ext, -beta, -alpha, ply + 1);
        unmake(pos, m, cap);
        if (stop) return 0;
        if (sc > best) best = sc;
        if (sc > alpha) {
          alpha = sc;
          if (alpha >= beta) {
            if (!cap) {
              var k = killers[ply];
              if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
              history[m & 8191] += depth * depth;
            }
            break;
          }
        }
      }
      if (!legal) return -MATE + ply; // hết nước = thua
      return best;
    }

    // Mức 1: nhìn 1 nước + nhiễu ngẫu nhiên
    if (level <= 1) {
      if (Math.random() < 0.2) { var rm = root[(Math.random() * root.length) | 0]; return { from: rm & 127, to: rm >> 7, score: 0, depth: 0 }; }
      var bm = root[0], bs = -1e9;
      for (var i = 0; i < root.length; i++) {
        var cap = make(pos, root[i]);
        var sc = -qs(-INF, INF, 1) + (Math.random() - 0.5) * 140;
        unmake(pos, root[i], cap);
        if (sc > bs) { bs = sc; bm = root[i]; }
      }
      return { from: bm & 127, to: bm >> 7, score: bs, depth: 1 };
    }

    var bestM = root[0], bestS = 0, doneDepth = 0;
    for (var d = 1; d <= maxDepth; d++) {
      var alpha = -INF, curBest = 0, curScore = -INF;
      sortMoves(root, 0, bestM);
      for (var j = 0; j < root.length; j++) {
        var mv = root[j], cp = make(pos, mv);
        var ext = inCheck(pos, pos.turn) ? 1 : 0;
        var s2 = -negamax(d - 1 + ext, -INF, -alpha, 1);
        unmake(pos, mv, cp);
        if (stop) break;
        if (s2 > curScore) { curScore = s2; curBest = mv; }
        if (s2 > alpha) alpha = s2;
      }
      if (stop) break;
      bestM = curBest; bestS = curScore; doneDepth = d;
      if (bestS > MATE - 200 || bestS < -MATE + 200) break;
      if (Date.now() - t0 > timeLimit * 0.5) break;
    }
    return { from: bestM & 127, to: bestM >> 7, score: bestS, depth: doneDepth };
  }

  var XiangqiEngine = {
    START_FEN: START_FEN,
    K: K, A: A, B: B, N: N, R: R, C: C, P: P,
    ROW: ROW, COL: COL,
    enc: enc, mFrom: mFrom, mTo: mTo,
    parseFEN: parseFEN, toFEN: toFEN, clone: clone, posKey: posKey,
    genMoves: genMoves, legalMoves: legalMoves, legalMovesFrom: legalMovesFrom,
    inCheck: inCheck, make: make, unmake: unmake, perft: perft,
    evaluate: evaluate, bestMove: bestMove, Game: Game,
    newGame: function (fen) { return new Game(fen); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = XiangqiEngine; else window.XiangqiEngine = XiangqiEngine;
})();
