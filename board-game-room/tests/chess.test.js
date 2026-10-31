// node tests/chess.test.js
var E = require('../js/engines/chess-engine.js');
var fails = 0, total = 0;
function eq(a, b, msg) { total++; if (a !== b) { fails++; console.log('FAIL', msg, 'got', a, 'expected', b); } else console.log('ok  ', msg); }
function perftCase(name, fen, exp) {
  exp.forEach(function (n, i) { eq(E.fromFEN(fen).perft(i + 1), n, name + ' d' + (i + 1)); });
}
perftCase('start', E.START_FEN, [20, 400, 8902, 197281]);
perftCase('kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -', [48, 2039, 97862]);
perftCase('pos3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -', [14, 191, 2812, 43238]);

function play(p, from, to, promo) {
  var m = p.findMove(E.sqFromName(from), E.sqFromName(to), promo);
  if (m < 0) throw new Error('illegal ' + from + to);
  p.make(m); return m;
}
// fool's mate
var p = E.create();
['f2f3', 'e7e5', 'g2g4', 'd8h4'].forEach(function (s) { play(p, s.slice(0, 2), s.slice(2)); });
var st = p.status();
eq(st.reason + '/' + st.winner, 'checkmate/1', "fool's mate");
// stalemate
p = E.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
eq(p.status().reason, 'stalemate', 'stalemate');
// insufficient
eq(E.fromFEN('8/8/4k3/8/8/3K4/8/6B1 w - - 0 1').status().reason, 'insufficient', 'K+B vs K');
// fifty
eq(E.fromFEN('8/8/4k3/8/8/3K4/8/6R1 w - - 100 80').status().reason, 'fifty', 'fifty');
// repetition
p = E.create();
['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'].forEach(function (s) { play(p, s.slice(0, 2), s.slice(2)); });
eq(p.status().reason, 'repetition', 'threefold');
// en passant
p = E.fromFEN('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3');
play(p, 'd4', 'e3');
eq(p.board[E.sqFromName('e4')], 0, 'en passant removes pawn');
eq(p.fen().split(' ')[0], 'rnbqkbnr/ppp1pppp/8/8/8/4p3/PPPP1PPP/RNBQKBNR', 'ep fen');
// castling
p = E.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
play(p, 'e1', 'g1');
eq(p.fen().split(' ')[0], 'r3k2r/8/8/8/8/8/8/R4RK1', 'O-O');
play(p, 'e8', 'c8');
eq(p.fen().split(' ')[0], '2kr3r/8/8/8/8/8/8/R4RK1', 'O-O-O');
p = E.fromFEN('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1');
eq(p.findMove(E.sqFromName('e1'), E.sqFromName('g1')), -1, 'no castle through attacked square');
p = E.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
eq(p.san(p.findMove(60, 62)), 'O-O', 'SAN O-O');
// promotion
p = E.fromFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1');
eq(p.needsPromotion(E.sqFromName('a7'), E.sqFromName('a8')), true, 'needsPromotion');
play(p, 'a7', 'a8', 'n');
eq(p.fen().split(' ')[0], 'N7/7k/8/8/8/8/8/K7', 'promote to knight');
// fen roundtrip
var f = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
eq(E.fromFEN(f).fen(), f, 'FEN roundtrip');
// AI
[1, 2, 3].forEach(function (lv) {
  var pos = E.fromFEN(f), t = Date.now(), r = E.search(pos, { level: lv }), dt = Date.now() - t;
  eq(pos.legalMoves().indexOf(r.move) >= 0, true, 'AI legal level ' + lv + ' (' + dt + 'ms, d' + r.depth + ')');
  if (lv === 3) eq(dt <= 1500, true, 'AI level 3 time');
});
// mate in 1
var mp = E.fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
var mr = E.search(mp, { level: 3 });
eq(mp.san(mr.move), 'Ra8#', 'AI finds mate in 1');
console.log(fails ? fails + ' FAILED' : 'ALL ' + total + ' PASSED');
process.exit(fails ? 1 : 0);
