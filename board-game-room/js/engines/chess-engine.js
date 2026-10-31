/* Cờ vua – engine thuần (không phụ thuộc DOM). Global: ChessEngine
 * Ô: index 0..63, 0 = a8, 7 = h8, 56 = a1, 63 = h1 (hàng 0 là hạng 8).
 * Quân: kiểu 1..6 = P N B R Q K, | (màu<<3): trắng 1..6, đen 9..14.
 * Nước đi: số nguyên  from | to<<6 | promo<<12 | flags<<16
 *   flags: 1 ăn quân, 2 bắt tốt qua đường, 4 nhập thành, 8 tốt đi 2 ô.  promo: 2=N 3=B 4=R 5=Q
 */
(function () {
  'use strict';
  var P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var PCHARS = ' pnbrqk';

  // ---------- bảng tiền tính ----------
  var KN = [], KG = [], RAYS = [];
  var DR = [-1, 1, 0, 0, -1, -1, 1, 1], DF = [0, 0, -1, 1, -1, 1, -1, 1];
  (function () {
    var NJ = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (var s = 0; s < 64; s++) {
      var r = s >> 3, f = s & 7, i, a = [], k = [];
      for (i = 0; i < 8; i++) {
        var rr = r + NJ[i][0], ff = f + NJ[i][1];
        if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) a.push(rr * 8 + ff);
        rr = r + DR[i]; ff = f + DF[i];
        if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) k.push(rr * 8 + ff);
      }
      KN.push(a); KG.push(k);
      var rays = [];
      for (var d = 0; d < 8; d++) {
        var ray = [], r2 = r + DR[d], f2 = f + DF[d];
        while (r2 >= 0 && r2 < 8 && f2 >= 0 && f2 < 8) { ray.push(r2 * 8 + f2); r2 += DR[d]; f2 += DF[d]; }
        rays.push(ray);
      }
      RAYS.push(rays);
    }
  })();

  var CM = new Int32Array(64).fill(15);
  CM[60] &= ~3; CM[63] &= ~1; CM[56] &= ~2; CM[4] &= ~12; CM[7] &= ~4; CM[0] &= ~8;

  // Zobrist (PRNG xorshift cố định)
  var seed = 0x2545F491;
  function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; }
  var Z1 = new Int32Array(16 * 64), Z2 = new Int32Array(16 * 64), ZC1 = new Int32Array(16), ZC2 = new Int32Array(16),
    ZE1 = new Int32Array(8), ZE2 = new Int32Array(8), ZS1, ZS2, i0;
  for (i0 = 0; i0 < 1024; i0++) { Z1[i0] = rnd(); Z2[i0] = rnd(); }
  for (i0 = 0; i0 < 16; i0++) { ZC1[i0] = rnd(); ZC2[i0] = rnd(); }
  for (i0 = 0; i0 < 8; i0++) { ZE1[i0] = rnd(); ZE2[i0] = rnd(); }
  ZS1 = rnd(); ZS2 = rnd();

  // ---------- Position ----------
  function Position() {
    this.board = new Int8Array(64);
    this.turn = 0; this.castle = 0; this.ep = -1; this.half = 0; this.full = 1;
    this.king = [60, 4];
    this.h1 = 0; this.h2 = 0;
    this.stk = []; this.hist = [];
  }
  var PP = Position.prototype;

  PP.key = function () { return (this.h2 & 0x1fffff) * 4294967296 + (this.h1 >>> 0); };

  PP.epFile = function () {
    var ep = this.ep; if (ep < 0) return -1;
    var b = this.board, f = ep & 7, t = this.turn, base = t === 0 ? ep + 8 : ep - 8, pc = P | (t << 3);
    if (f > 0 && b[base - 1] === pc) return f;
    if (f < 7 && b[base + 1] === pc) return f;
    return -1;
  };

  PP.computeHash = function () {
    var h1 = 0, h2 = 0, b = this.board;
    for (var s = 0; s < 64; s++) if (b[s]) { h1 ^= Z1[b[s] * 64 + s]; h2 ^= Z2[b[s] * 64 + s]; }
    if (this.turn) { h1 ^= ZS1; h2 ^= ZS2; }
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    var e = this.epFile(); if (e >= 0) { h1 ^= ZE1[e]; h2 ^= ZE2[e]; }
    this.h1 = h1; this.h2 = h2;
    this.hist = [this.key()]; this.stk = [];
  };

  PP.clone = function () {
    var p = new Position();
    p.board.set(this.board); p.turn = this.turn; p.castle = this.castle; p.ep = this.ep;
    p.half = this.half; p.full = this.full; p.king = this.king.slice();
    p.h1 = this.h1; p.h2 = this.h2; p.hist = this.hist.slice();
    return p;
  };

  function fromFEN(fen) {
    var p = new Position(), parts = String(fen || START_FEN).trim().split(/\s+/);
    if (parts.length < 2) throw new Error('FEN không hợp lệ');
    var rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('FEN không hợp lệ');
    var kings = [0, 0];
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var c of rows[r]) {
        if (c >= '1' && c <= '8') f += +c;
        else {
          var lo = c.toLowerCase(), t = PCHARS.indexOf(lo);
          if (t < 1 || f > 7) throw new Error('FEN không hợp lệ');
          var col = c === lo ? 1 : 0;
          p.board[r * 8 + f] = t | (col << 3);
          if (t === K) { p.king[col] = r * 8 + f; kings[col]++; }
          f++;
        }
      }
      if (f !== 8) throw new Error('FEN không hợp lệ');
    }
    if (kings[0] !== 1 || kings[1] !== 1) throw new Error('FEN thiếu vua');
    p.turn = parts[1] === 'b' ? 1 : 0;
    var cs = parts[2] || '-';
    p.castle = (cs.indexOf('K') >= 0 ? 1 : 0) | (cs.indexOf('Q') >= 0 ? 2 : 0) | (cs.indexOf('k') >= 0 ? 4 : 0) | (cs.indexOf('q') >= 0 ? 8 : 0);
    var ep = parts[3] || '-';
    p.ep = (ep !== '-' && /^[a-h][36]$/.test(ep)) ? (8 - +ep[1]) * 8 + (ep.charCodeAt(0) - 97) : -1;
    p.half = parseInt(parts[4], 10) || 0;
    p.full = parseInt(parts[5], 10) || 1;
    p.computeHash();
    return p;
  }

  PP.fen = function () {
    var out = [], b = this.board;
    for (var r = 0; r < 8; r++) {
      var s = '', e = 0;
      for (var f = 0; f < 8; f++) {
        var v = b[r * 8 + f];
        if (!v) { e++; continue; }
        if (e) { s += e; e = 0; }
        var ch = PCHARS[v & 7]; s += (v >> 3) ? ch : ch.toUpperCase();
      }
      if (e) s += e;
      out.push(s);
    }
    var cs = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
    return out.join('/') + ' ' + (this.turn ? 'b' : 'w') + ' ' + (cs || '-') + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
  };

  function sqName(s) { return String.fromCharCode(97 + (s & 7)) + (8 - (s >> 3)); }

  PP.isAttacked = function (sq, by) {
    var b = this.board, r = sq >> 3, f = sq & 7, i, a, d, ray, j, v;
    if (by === 0) {
      if (r < 7) { if (f > 0 && b[sq + 7] === 1) return true; if (f < 7 && b[sq + 9] === 1) return true; }
    } else if (r > 0) { if (f > 0 && b[sq - 9] === 9) return true; if (f < 7 && b[sq - 7] === 9) return true; }
    var cb = by << 3;
    a = KN[sq]; for (i = 0; i < a.length; i++) if (b[a[i]] === (N | cb)) return true;
    a = KG[sq]; for (i = 0; i < a.length; i++) if (b[a[i]] === (K | cb)) return true;
    var rays = RAYS[sq];
    for (d = 0; d < 8; d++) {
      ray = rays[d];
      for (j = 0; j < ray.length; j++) {
        v = b[ray[j]];
        if (v) {
          if ((v >> 3) === by) { var t = v & 7; if (t === Q || (d < 4 ? t === R : t === B)) return true; }
          break;
        }
      }
    }
    return false;
  };

  PP.inCheck = function () { return this.isAttacked(this.king[this.turn], this.turn ^ 1); };

  // sinh nước giả-hợp-lệ. caps=true: chỉ ăn quân + phong hậu
  PP.pseudo = function (caps) {
    var out = [], b = this.board, us = this.turn, them = us ^ 1, sq, p, t, i, a, to, tv, ray, d, j;
    for (sq = 0; sq < 64; sq++) {
      p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      t = p & 7;
      if (t === P) {
        var dir = us === 0 ? -8 : 8, r = sq >> 3, f = sq & 7, startRow = us === 0 ? 6 : 1, promoRow = us === 0 ? 0 : 7, one = sq + dir, pr = (one >> 3) === promoRow;
        if (b[one] === 0) {
          if (pr) { out.push(sq | one << 6 | 5 << 12); if (!caps) out.push(sq | one << 6 | 4 << 12, sq | one << 6 | 3 << 12, sq | one << 6 | 2 << 12); }
          else if (!caps) {
            out.push(sq | one << 6);
            if (r === startRow && b[one + dir] === 0) out.push(sq | (one + dir) << 6 | 8 << 16);
          }
        }
        for (var df = -1; df <= 1; df += 2) {
          var nf = f + df; if (nf < 0 || nf > 7) continue;
          to = one + df; tv = b[to];
          if (tv && (tv >> 3) === them) {
            if (pr) out.push(sq | to << 6 | 5 << 12 | 1 << 16, sq | to << 6 | 4 << 12 | 1 << 16, sq | to << 6 | 3 << 12 | 1 << 16, sq | to << 6 | 2 << 12 | 1 << 16);
            else out.push(sq | to << 6 | 1 << 16);
          } else if (to === this.ep && !tv) out.push(sq | to << 6 | 3 << 16);
        }
      } else if (t === N || t === K) {
        a = t === N ? KN[sq] : KG[sq];
        for (i = 0; i < a.length; i++) {
          to = a[i]; tv = b[to];
          if (!tv) { if (!caps) out.push(sq | to << 6); }
          else if ((tv >> 3) === them) out.push(sq | to << 6 | 1 << 16);
        }
      } else {
        var d0 = t === B ? 4 : 0, d1 = t === R ? 4 : 8, rays = RAYS[sq];
        for (d = d0; d < d1; d++) {
          ray = rays[d];
          for (j = 0; j < ray.length; j++) {
            to = ray[j]; tv = b[to];
            if (!tv) { if (!caps) out.push(sq | to << 6); }
            else { if ((tv >> 3) === them) out.push(sq | to << 6 | 1 << 16); break; }
          }
        }
      }
    }
    if (!caps && this.castle) {
      if (us === 0) {
        if ((this.castle & 1) && !b[61] && !b[62] && b[63] === 4 && !this.isAttacked(60, 1) && !this.isAttacked(61, 1) && !this.isAttacked(62, 1)) out.push(60 | 62 << 6 | 4 << 16);
        if ((this.castle & 2) && !b[59] && !b[58] && !b[57] && b[56] === 4 && !this.isAttacked(60, 1) && !this.isAttacked(59, 1) && !this.isAttacked(58, 1)) out.push(60 | 58 << 6 | 4 << 16);
      } else {
        if ((this.castle & 4) && !b[5] && !b[6] && b[7] === 12 && !this.isAttacked(4, 0) && !this.isAttacked(5, 0) && !this.isAttacked(6, 0)) out.push(4 | 6 << 6 | 4 << 16);
        if ((this.castle & 8) && !b[3] && !b[2] && !b[1] && b[0] === 12 && !this.isAttacked(4, 0) && !this.isAttacked(3, 0) && !this.isAttacked(2, 0)) out.push(4 | 2 << 6 | 4 << 16);
      }
    }
    return out;
  };

  PP.make = function (m) {
    var b = this.board, from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, fl = m >> 16, us = this.turn, p = b[from];
    var capSq = to, cap = b[to];
    if (fl & 2) { capSq = us === 0 ? to + 8 : to - 8; cap = b[capSq]; }
    this.stk.push(m, cap, this.castle, this.ep, this.half, this.h1, this.h2);
    var h1 = this.h1, h2 = this.h2, oe = this.epFile();
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    if (oe >= 0) { h1 ^= ZE1[oe]; h2 ^= ZE2[oe]; }
    h1 ^= Z1[p * 64 + from]; h2 ^= Z2[p * 64 + from];
    if (cap) { h1 ^= Z1[cap * 64 + capSq]; h2 ^= Z2[cap * 64 + capSq]; b[capSq] = 0; }
    var np = promo ? (promo | (us << 3)) : p;
    b[from] = 0; b[to] = np;
    h1 ^= Z1[np * 64 + to]; h2 ^= Z2[np * 64 + to];
    if (fl & 4) {
      var rf, rt, rk = R | (us << 3);
      if (to === 62) { rf = 63; rt = 61; } else if (to === 58) { rf = 56; rt = 59; } else if (to === 6) { rf = 7; rt = 5; } else { rf = 0; rt = 3; }
      b[rf] = 0; b[rt] = rk;
      h1 ^= Z1[rk * 64 + rf] ^ Z1[rk * 64 + rt]; h2 ^= Z2[rk * 64 + rf] ^ Z2[rk * 64 + rt];
    }
    if ((p & 7) === K) this.king[us] = to;
    this.castle &= CM[from] & CM[to];
    this.ep = (fl & 8) ? (from + to) >> 1 : -1;
    this.half = ((p & 7) === P || cap) ? 0 : this.half + 1;
    if (us === 1) this.full++;
    this.turn = us ^ 1;
    h1 ^= ZS1; h2 ^= ZS2;
    h1 ^= ZC1[this.castle]; h2 ^= ZC2[this.castle];
    var ne = this.epFile();
    if (ne >= 0) { h1 ^= ZE1[ne]; h2 ^= ZE2[ne]; }
    this.h1 = h1; this.h2 = h2;
    this.hist.push(this.key());
  };

  PP.unmake = function () {
    var S = this.stk, b = this.board;
    this.h2 = S.pop(); this.h1 = S.pop(); this.half = S.pop(); this.ep = S.pop(); this.castle = S.pop();
    var cap = S.pop(), m = S.pop();
    this.hist.pop();
    var from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, fl = m >> 16;
    this.turn ^= 1;
    var us = this.turn, p = promo ? (P | (us << 3)) : b[to];
    b[from] = p; b[to] = 0;
    if (cap) b[(fl & 2) ? (us === 0 ? to + 8 : to - 8) : to] = cap;
    if (fl & 4) {
      var rf, rt, rk = R | (us << 3);
      if (to === 62) { rf = 63; rt = 61; } else if (to === 58) { rf = 56; rt = 59; } else if (to === 6) { rf = 7; rt = 5; } else { rf = 0; rt = 3; }
      b[rt] = 0; b[rf] = rk;
    }
    if ((p & 7) === K) this.king[us] = from;
    if (us === 1) this.full--;
  };

  PP.legalMoves = function () {
    var ms = this.pseudo(false), out = [], us = this.turn;
    for (var i = 0; i < ms.length; i++) {
      this.make(ms[i]);
      if (!this.isAttacked(this.king[us], us ^ 1)) out.push(ms[i]);
      this.unmake();
    }
    return out;
  };

  PP.perft = function (d) {
    if (d === 0) return 1;
    var ms = this.pseudo(false), n = 0, us = this.turn;
    for (var i = 0; i < ms.length; i++) {
      this.make(ms[i]);
      if (!this.isAttacked(this.king[us], us ^ 1)) n += d === 1 ? 1 : this.perft(d - 1);
      this.unmake();
    }
    return n;
  };

  var PROMO_CH = { 2: 'n', 3: 'b', 4: 'r', 5: 'q' };
  var CH_PROMO = { n: 2, b: 3, r: 4, q: 5 };

  function decode(m) { return { from: m & 63, to: (m >> 6) & 63, promo: PROMO_CH[(m >> 12) & 7] || null, flags: m >> 16, capture: !!((m >> 16) & 1), ep: !!((m >> 16) & 2), castle: !!((m >> 16) & 4) }; }

  // tìm nước hợp lệ theo from,to,promo ('q','r','b','n' hoặc null). Trả -1 nếu không có.
  PP.findMove = function (from, to, promo) {
    var ms = this.legalMoves(), pc = promo ? (CH_PROMO[String(promo).toLowerCase()] || 0) : 0;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if ((m & 63) === from && ((m >> 6) & 63) === to) {
        var mp = (m >> 12) & 7;
        if (!mp) return m;
        if (mp === (pc || 5)) return m;
      }
    }
    return -1;
  };
  PP.needsPromotion = function (from, to) {
    var p = this.board[from];
    if (!p || (p & 7) !== P) return false;
    var tr = to >> 3;
    if (tr !== 0 && tr !== 7) return false;
    return this.findMove(from, to, 'q') >= 0;
  };

  // ký hiệu SAN (gọi TRƯỚC khi make)
  PP.san = function (m) {
    var d = decode(m), b = this.board, p = b[d.from], t = p & 7, s;
    if (d.castle) s = d.to > d.from ? 'O-O' : 'O-O-O';
    else {
      s = '';
      if (t === P) {
        if (d.capture) s += String.fromCharCode(97 + (d.from & 7)) + 'x';
        s += sqName(d.to);
        if (d.promo) s += '=' + d.promo.toUpperCase();
      } else {
        s += 'NBRQK'[t - 2];
        if (t !== K) {
          var ms = this.legalMoves(), sameF = false, sameR = false, other = false;
          for (var i = 0; i < ms.length; i++) {
            var o = ms[i];
            if (o === m || ((o >> 6) & 63) !== d.to || (o & 63) === d.from || b[o & 63] !== p) continue;
            other = true;
            if (((o & 63) & 7) === (d.from & 7)) sameF = true;
            if (((o & 63) >> 3) === (d.from >> 3)) sameR = true;
          }
          if (other) {
            if (!sameF) s += String.fromCharCode(97 + (d.from & 7));
            else if (!sameR) s += (8 - (d.from >> 3));
            else s += sqName(d.from);
          }
        }
        if (d.capture) s += 'x';
        s += sqName(d.to);
      }
    }
    this.make(m);
    if (this.inCheck()) s += this.legalMoves().length ? '+' : '#';
    this.unmake();
    return s;
  };

  PP.insufficient = function () {
    var b = this.board, minors = 0, bc = [0, 0], knights = 0;
    for (var s = 0; s < 64; s++) {
      var v = b[s]; if (!v) continue;
      var t = v & 7;
      if (t === P || t === R || t === Q) return false;
      if (t === N) { minors++; knights++; }
      if (t === B) { minors++; bc[(((s >> 3) + (s & 7)) & 1)]++; }
    }
    if (minors <= 1) return true;
    if (knights === 0 && (bc[0] === 0 || bc[1] === 0)) return true;
    return false;
  };

  PP.repCount = function () {
    var h = this.hist, n = h.length - 1, k = h[n], c = 1;
    for (var i = n - 2; i >= 0 && i >= n - this.half; i -= 2) if (h[i] === k) c++;
    return c;
  };

  // {over, reason, winner}  reason: checkmate|stalemate|insufficient|fifty|repetition
  PP.status = function () {
    var ms = this.legalMoves(), chk = this.inCheck();
    if (!ms.length) return chk ? { over: true, reason: 'checkmate', winner: this.turn ^ 1, check: true } : { over: true, reason: 'stalemate', winner: null, check: false };
    if (this.insufficient()) return { over: true, reason: 'insufficient', winner: null, check: chk };
    if (this.half >= 100) return { over: true, reason: 'fifty', winner: null, check: chk };
    if (this.repCount() >= 3) return { over: true, reason: 'repetition', winner: null, check: chk };
    return { over: false, reason: null, winner: null, check: chk };
  };

  // ---------- Đánh giá ----------
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  var PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    null];
  var KMG = [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20];
  var KEG = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

  // điểm theo góc nhìn bên đang đi
  function evaluate(pos) {
    var b = pos.board, sc = [0, 0], bishops = [0, 0], npm = 0, s, v, t, c;
    for (s = 0; s < 64; s++) {
      v = b[s]; if (!v) continue;
      t = v & 7; c = v >> 3;
      if (t === K) continue;
      sc[c] += VAL[t] + PST[t][c ? s ^ 56 : s];
      if (t === B) bishops[c]++;
      if (t !== P) npm += VAL[t];
    }
    var kt = npm <= 2600 ? KEG : KMG;
    sc[0] += kt[pos.king[0]]; sc[1] += kt[pos.king[1] ^ 56];
    if (bishops[0] > 1) sc[0] += 30;
    if (bishops[1] > 1) sc[1] += 30;
    var d = sc[0] - sc[1];
    return (pos.turn === 0 ? d : -d) + 8;
  }

  // ---------- Tìm kiếm ----------
  var INF = 32000, MATE = 30000, TT_BITS = 18, TT_SIZE = 1 << TT_BITS;
  var tt = { key: new Float64Array(TT_SIZE), score: new Int16Array(TT_SIZE), depth: new Int8Array(TT_SIZE), flag: new Int8Array(TT_SIZE), move: new Int32Array(TT_SIZE) };

  function moveScore(pos, m, ttMove, killers, hist) {
    if (m === ttMove) return 1e7;
    var fl = m >> 16, b = pos.board, from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, sc = 0;
    if (fl & 1) { var vic = (fl & 2) ? P : (b[to] & 7); sc = 1e6 + VAL[vic] * 10 - (b[from] & 7); }
    else if (promo) sc = 9e5 + promo;
    else if (killers && (m === killers[0] || m === killers[1])) sc = 8e5;
    else sc = hist[(b[from] & 15) * 64 + to];
    if (promo && (fl & 1)) sc += 1000;
    return sc;
  }

  function search(rootPos, opts) {
    opts = opts || {};
    var level = opts.level || 2;
    var pos = rootPos.clone();
    var timeMs = opts.timeMs || (level >= 3 ? 1100 : level === 2 ? 500 : 200);
    var maxDepth = opts.maxDepth || (level >= 3 ? 14 : level === 2 ? 3 : 1);
    var deadline = Date.now() + timeMs, stop = false, nodes = 0;
    var killers = [], hist = new Int32Array(16 * 64), us = pos.turn;
    for (var q0 = 0; q0 < 80; q0++) killers.push([0, 0]);
    var ttAge = 0;

    function quiesce(alpha, beta, ply) {
      if (((++nodes) & 2047) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      var stand = evaluate(pos);
      if (ply >= 60) return stand;
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      var ms = pos.pseudo(true), n = ms.length, sc = new Array(n), i, j, us = pos.turn;
      for (i = 0; i < n; i++) sc[i] = moveScore(pos, ms[i], 0, null, hist);
      for (i = 0; i < n; i++) {
        var bi = i;
        for (j = i + 1; j < n; j++) if (sc[j] > sc[bi]) bi = j;
        var m = ms[bi]; ms[bi] = ms[i]; ms[i] = m; var t = sc[bi]; sc[bi] = sc[i]; sc[i] = t;
        pos.make(m);
        if (pos.isAttacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
        var s = -quiesce(-beta, -alpha, ply + 1);
        pos.unmake();
        if (stop) return 0;
        if (s >= beta) return s;
        if (s > alpha) alpha = s;
      }
      return alpha;
    }

    function negamax(d, alpha, beta, ply) {
      if (stop) return 0;
      if (ply > 0 && (pos.half >= 100 || pos.repCount() >= 2)) return 0;
      var inChk = pos.inCheck();
      if (inChk && ply < 40) d++;
      if (d <= 0) return quiesce(alpha, beta, ply);
      if (((++nodes) & 2047) === 0 && Date.now() > deadline) { stop = true; return 0; }
      var key = pos.key(), idx = pos.h1 & (TT_SIZE - 1), ttMove = 0, origAlpha = alpha;
      if (tt.key[idx] === key) {
        ttMove = tt.move[idx];
        if (tt.depth[idx] >= d && ply > 0) {
          var ts = tt.score[idx], fl = tt.flag[idx];
          if (ts > MATE - 100) ts -= ply; else if (ts < -MATE + 100) ts += ply;
          if (fl === 0) return ts;
          if (fl === 1 && ts >= beta) return ts;
          if (fl === 2 && ts <= alpha) return ts;
        }
      }
      var ms = pos.pseudo(false), n = ms.length, sc = new Array(n), i, j, k = killers[ply], us = pos.turn;
      for (i = 0; i < n; i++) sc[i] = moveScore(pos, ms[i], ttMove, k, hist);
      var best = -INF, bm = 0, legal = 0;
      for (i = 0; i < n; i++) {
        var bi = i;
        for (j = i + 1; j < n; j++) if (sc[j] > sc[bi]) bi = j;
        var m = ms[bi]; ms[bi] = ms[i]; ms[i] = m; var t = sc[bi]; sc[bi] = sc[i]; sc[i] = t;
        pos.make(m);
        if (pos.isAttacked(pos.king[us], us ^ 1)) { pos.unmake(); continue; }
        legal++;
        var s = -negamax(d - 1, -beta, -alpha, ply + 1);
        pos.unmake();
        if (stop) return 0;
        if (s > best) {
          best = s; bm = m;
          if (s > alpha) {
            alpha = s;
            if (alpha >= beta) {
              if (!(m >> 16 & 1) && !((m >> 12) & 7)) {
                if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
                hist[(pos.board[m & 63] & 15) * 64 + ((m >> 6) & 63)] += d * d;
              }
              break;
            }
          }
        }
      }
      if (!legal) return inChk ? -MATE + ply : 0;
      var flag = best >= beta ? 1 : (best > origAlpha ? 0 : 2), st = best;
      if (st > MATE - 100) st += ply; else if (st < -MATE + 100) st -= ply;
      tt.key[idx] = key; tt.score[idx] = st; tt.depth[idx] = d; tt.flag[idx] = flag; tt.move[idx] = bm;
      return best;
    }

    var root = pos.legalMoves();
    if (!root.length) return { move: -1, score: 0, depth: 0, nodes: 0 };
    if (root.length === 1) return { move: root[0], score: 0, depth: 0, nodes: 0 };
    // xáo trộn để đa dạng
    for (var a = root.length - 1; a > 0; a--) { var r = Math.floor(Math.random() * (a + 1)), tmp = root[a]; root[a] = root[r]; root[r] = tmp; }

    if (level <= 1) {
      // độ sâu 1 + nhiễu lớn
      var bestM = root[0], bestS = -Infinity;
      for (var x = 0; x < root.length; x++) {
        pos.make(root[x]);
        var sc1 = -quiesce(-INF, INF, 1) + (Math.random() - 0.5) * 360;
        pos.unmake();
        if (sc1 > bestS) { bestS = sc1; bestM = root[x]; }
      }
      return { move: bestM, score: bestS, depth: 1, nodes: nodes };
    }

    tt.key.fill(0);
    var bestMove = root[0], bestScore = 0, doneDepth = 0;
    for (var depth = 1; depth <= maxDepth; depth++) {
      var alpha = -INF, beta = INF, curBest = 0, curScore = -INF;
      for (var ri = 0; ri < root.length; ri++) {
        var mv = root[ri];
        pos.make(mv);
        var s2 = -negamax(depth - 1, -beta, -alpha, 1);
        pos.unmake();
        if (stop) break;
        if (s2 > curScore) { curScore = s2; curBest = mv; if (s2 > alpha) alpha = s2; }
      }
      if (stop) break;
      bestMove = curBest; bestScore = curScore; doneDepth = depth;
      var bi2 = root.indexOf(curBest); root.splice(bi2, 1); root.unshift(curBest);
      if (Math.abs(curScore) > MATE - 100) break;
      if (Date.now() > deadline) break;
    }
    return { move: bestMove, score: bestScore, depth: doneDepth, nodes: nodes };
  }

  var ChessEngine = {
    START_FEN: START_FEN, Position: Position,
    fromFEN: fromFEN, create: function () { return fromFEN(START_FEN); },
    search: search, evaluate: evaluate, decode: decode, sqName: sqName,
    sqFromName: function (n) { return (8 - +n[1]) * 8 + (n.charCodeAt(0) - 97); },
    PAWN: P, KNIGHT: N, BISHOP: B, ROOK: R, QUEEN: Q, KING: K
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ChessEngine; else window.ChessEngine = ChessEngine;
})();
