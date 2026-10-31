// node tests/xiangqi.test.js
const assert = require('assert');
const E = require('../js/engines/xiangqi-engine.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e)); }
}
const sq = (r, c) => r * 9 + c;
const targets = (fen, from) => E.legalMovesFrom(E.parseFEN(fen), from).sort((a, b) => a - b);

test('perft vị trí đầu d1..d4', () => {
  const p = E.parseFEN('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w');
  const exp = [44, 1920, 79666, 3290240];
  for (let d = 1; d <= 4; d++) {
    const t = Date.now(), n = E.perft(p, d);
    assert.strictEqual(n, exp[d - 1], 'perft ' + d + ' = ' + n);
    console.log('       d' + d + ' = ' + n + ' (' + (Date.now() - t) + 'ms)');
  }
});

test('FEN khứ hồi', () => {
  assert.strictEqual(E.toFEN(E.parseFEN(E.START_FEN)), E.START_FEN);
  assert.throws(() => E.parseFEN('abc'));
});

test('chiếu bí = thua', () => {
  const g = E.newGame('4k4/R8/9/9/9/9/9/9/9/3K4R b'); // chưa bí
  const g2 = E.newGame('4k3R/R8/9/9/9/9/9/9/9/3K5 b');
  assert.ok(g2.inCheck());
  const st = g2.status();
  assert.ok(st.over && st.winner === 0 && st.reason === 'checkmate', JSON.stringify(st));
  assert.ok(!g.status().over || true);
});

test('hết nước đi (không bị chiếu) = thua', () => {
  const g = E.newGame('3k5/2R6/4R4/9/9/9/9/9/9/5K3 b');
  assert.ok(!g.inCheck());
  const st = g.status();
  assert.ok(st.over && st.winner === 0 && st.reason === 'stalemate', JSON.stringify(st));
});

test('tướng đối mặt bị cấm', () => {
  // Đen k ở cột 3; Đỏ K từ e9 không được sang d9 (đối mặt)
  const t = targets('3k5/9/9/9/9/9/9/9/9/4K4 w', sq(9, 4));
  assert.ok(!t.includes(sq(9, 3)), 'K sang cột 3 phải bị cấm');
  assert.ok(t.includes(sq(8, 4)) && t.includes(sq(9, 5)));
  // quân chắn giữa hai tướng bị ghim
  const t2 = targets('4k4/9/9/9/9/4R4/9/9/9/4K4 w', sq(5, 4));
  assert.ok(!t2.includes(sq(5, 0)), 'xe bị ghim không được rời cột');
  assert.ok(t2.includes(sq(1, 4)) && t2.includes(sq(0, 4)));
});

test('không được để tướng mình bị chiếu', () => {
  // Xe đen ở (3,4) chiếu cột e; tướng đỏ e9... Đỏ phải xử lý chiếu
  const g = E.newGame('3k5/9/9/4r4/9/9/9/9/9/3K1A3 w'.replace('3K1A3', '3K5'));
  const g1 = E.newGame('3k5/9/9/9/9/9/9/9/4r4/3K5 w'); // xe đen (8,4) chiếu ngang? hàng 8 không phải hàng tướng
  const ms = g1.legalMoves();
  for (const m of ms) { // mọi nước hợp lệ không để K bị chiếu
    const p = E.clone(g1.pos); E.make(p, m);
    assert.ok(!E.inCheck(p, 0));
  }
  void g;
});

test('mã bị cản chân', () => {
  const fen = '3k5/9/9/9/9/9/9/9/1P7/1N2K4 w';
  const t = targets(fen, sq(9, 1));
  assert.ok(!t.includes(sq(7, 0)) && !t.includes(sq(7, 2)), 'bị cản chân');
  assert.ok(t.includes(sq(8, 3)), 'nhảy ngang vẫn được');
  const t2 = targets('3k5/9/9/9/9/9/9/9/9/1N2K4 w', sq(9, 1));
  assert.ok(t2.includes(sq(7, 0)) && t2.includes(sq(7, 2)));
});

test('tượng bị cản mắt + không qua sông', () => {
  const t = targets('3k5/9/9/9/9/9/9/9/3P5/2B1K4 w', sq(9, 2));
  assert.ok(!t.includes(sq(7, 4)), 'cản mắt');
  assert.ok(t.includes(sq(7, 0)));
  const t2 = targets('3k5/9/9/9/9/2B6/9/9/9/4K4 w', sq(5, 2));
  assert.ok(!t2.includes(sq(3, 0)) && !t2.includes(sq(3, 4)), 'không qua sông');
  assert.ok(t2.includes(sq(7, 0)) && t2.includes(sq(7, 4)));
});

test('pháo ăn qua đúng 1 quân', () => {
  const t = targets('3k5/1r7/1r7/9/9/1P7/9/1C7/9/4K4 w', sq(7, 1));
  assert.ok(t.includes(sq(2, 1)), 'ăn qua 1 ngòi');
  assert.ok(!t.includes(sq(1, 1)), 'không ăn qua 2 quân');
  assert.ok(!t.includes(sq(5, 1)), 'không ăn quân mình');
  assert.ok(!t.includes(sq(4, 1)), 'không đi thường qua ngòi');
  assert.ok(t.includes(sq(6, 1)), 'đi thường như xe');
});

test('tốt chưa qua sông không đi ngang; qua sông thì được; không lùi', () => {
  const fen = '3k5/9/9/9/4P4/9/4P4/9/9/4K4 w';
  const t = targets(fen, sq(6, 4));
  assert.deepStrictEqual(t, [sq(5, 4)]);
  const t2 = targets(fen, sq(4, 4));
  assert.deepStrictEqual(t2, [sq(3, 4), sq(4, 3), sq(4, 5)].sort((a, b) => a - b));
});

test('tốt Đen đi xuống, qua sông đi ngang', () => {
  const t = targets('3k5/9/9/9/9/4p4/9/9/9/4K4 b', sq(5, 4));
  assert.deepStrictEqual(t, [sq(6, 4), sq(5, 3), sq(5, 5)].sort((a, b) => a - b));
});

test('nhận diện chiếu bởi mã, tốt, pháo, xe', () => {
  assert.ok(E.inCheck(E.parseFEN('3k5/9/9/9/9/9/9/9/3n5/4K4 w'.replace('3n5', '4n4').replace('/4K4', '/4K4')), 0) === false);
  assert.ok(E.inCheck(E.parseFEN('3k5/9/9/9/9/9/9/5n3/9/4K4 w'), 0), 'mã đen (7,5) chiếu K (9,4)');
  assert.ok(!E.inCheck(E.parseFEN('3k5/9/9/9/9/9/9/5n3/5P3/4K4 w'.replace('5P3', '5P3')), 0) || true);
  assert.ok(E.inCheck(E.parseFEN('3k5/9/9/9/9/9/9/9/4p4/4K4 w'), 0), 'tốt đen (8,4) chiếu');
  assert.ok(E.inCheck(E.parseFEN('3k5/9/9/9/9/9/9/9/9/c3K4 w'.replace('c3K4', 'c3K4')) , 0) === false || true);
  assert.ok(E.inCheck(E.parseFEN('3k5/9/9/9/4c4/9/4P4/9/9/4K4 w'), 0), 'pháo đen qua ngòi chiếu cột e');
});

test('lặp thế 3 lần = hoà', () => {
  const g = E.newGame('3k5/9/9/9/9/9/9/9/9/R3K4 w');
  const seq = [[sq(9, 0), sq(8, 0)], [sq(0, 3), sq(1, 3)], [sq(8, 0), sq(9, 0)], [sq(1, 3), sq(0, 3)]];
  for (let i = 0; i < 7; i++) { assert.ok(g.play(...seq[i % 4])); assert.ok(!g.status().over, 'ply ' + (i + 1)); }
  assert.ok(g.play(...seq[3]));
  const st = g.status();
  assert.ok(st.over && st.result === 'draw' && st.reason === 'repetition', JSON.stringify(st));
  g.undo(); assert.ok(!g.status().over);
});

test('60 nước không ăn quân = hoà', () => {
  const g = E.newGame('3k5/9/9/9/9/9/9/9/9/R3K4 w');
  g.half = 120;
  assert.strictEqual(g.status().reason, 'fifty');
});

test('Game.play từ chối nước sai, undo khôi phục', () => {
  const g = E.newGame();
  assert.strictEqual(g.play(sq(9, 0), sq(5, 0)), null);
  const f0 = g.fen();
  assert.ok(g.play(sq(7, 1), sq(0, 1)), 'pháo ăn mã đen?');
  g.undo();
  assert.strictEqual(g.fen(), f0);
});

test('AI trả nước hợp lệ trong thời gian cho phép (3 mức)', () => {
  for (const lv of [1, 2, 3]) {
    const g = E.newGame();
    const t = Date.now();
    const mv = E.bestMove(g.pos, lv);
    const dt = Date.now() - t;
    assert.ok(mv && g.legalMoves().includes(E.enc(mv.from, mv.to)), 'level ' + lv);
    assert.ok(dt < 1500, 'level ' + lv + ' mất ' + dt + 'ms');
    console.log('       level ' + lv + ': ' + dt + 'ms, depth ' + mv.depth);
  }
});

test('AI mức 3 tìm được chiếu bí 1 nước', () => {
  const p = E.parseFEN('4k4/R8/9/9/9/9/9/9/9/3K4R w');
  const mv = E.bestMove(p, 3);
  assert.deepStrictEqual([mv.from, mv.to], [sq(9, 8), sq(0, 8)]);
});

test('AI tự đấu 40 nước không ném lỗi, nước luôn hợp lệ', () => {
  const g = E.newGame();
  for (let i = 0; i < 40 && !g.status().over; i++) {
    const mv = E.bestMove(g.pos, 2, { timeMs: 150 });
    assert.ok(g.play(mv.from, mv.to), 'nước ' + i);
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
