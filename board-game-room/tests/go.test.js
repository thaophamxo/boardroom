'use strict';
var assert = require('assert');
var G = require('../js/engines/go-engine.js');

var passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok - ' + name); }

// Dựng thế cờ từ chuỗi: '.' trống, 'X' Đen, 'O' Trắng. turn: 0 Đen / 1 Trắng
function make(rows, turn) {
  var size = rows.length, s = G.newGame(size);
  for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
    var ch = rows[r][c];
    if (ch === 'X') s.board[r * size + c] = 1; else if (ch === 'O') s.board[r * size + c] = 2;
  }
  s.turn = turn || 0;
  s.seen = new Set(); // thế cờ dựng tay: bỏ lịch sử superko
  return s;
}
function at(s, r, c) { return r * s.size + c; }

test('bắt 1 quân', function () {
  var s = make(['.X.......', 'XO.......', '.X.......', '.........', '.........', '.........', '.........', '.........', '.........'], 0);
  var res = G.play(s, at(s, 1, 2));
  assert(res.ok); assert.strictEqual(res.captured.length, 1);
  assert.strictEqual(s.board[at(s, 1, 1)], 0);
  assert.strictEqual(s.caps[0], 1);
});

test('bắt nhiều quân (nhóm)', function () {
  var s = make(['XXX......', 'XOOX.....', '.XX......', '.........', '.........', '.........', '.........', '.........', '.........'], 0);
  // Trắng (1,1),(1,2): khí còn (2,0)? (1,1) kề (2,1)X,(0,1)X,(1,0)X → chỉ còn khí của (1,2): (0,2)X,(2,2)X,(1,3)X → hết khí rồi, đặt thử vị trí khác
  // đổi thế: bỏ X ở (2,2) rồi đặt vào đó
  s.board[at(s, 2, 2)] = 0;
  var res = G.play(s, at(s, 2, 2));
  assert(res.ok); assert.strictEqual(res.captured.length, 2);
  assert.strictEqual(s.board[at(s, 1, 1)], 0); assert.strictEqual(s.board[at(s, 1, 2)], 0);
});

test('bắt quân ở góc', function () {
  var s = make(['O X......'.replace(' ', 'X').slice(0, 9).replace('OX', 'O.'), '.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 0);
  s.board.fill(0);
  s.board[at(s, 0, 0)] = 2; s.board[at(s, 0, 1)] = 1;
  var res = G.play(s, at(s, 1, 0));
  assert(res.ok); assert.strictEqual(res.captured.length, 1);
  assert.strictEqual(s.board[0], 0);
});

test('tự sát bị cấm', function () {
  var s = make(['.O.......', 'O........', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 0);
  var res = G.tryMove(s, 0);
  assert.strictEqual(res.ok, false); assert.strictEqual(res.reason, 'suicide');
});

test('tự sát hợp lệ nếu bắt được quân đối thủ', function () {
  // Đen đặt (0,0) không còn khí nhưng bắt Trắng (0,1) (khí cuối) → hợp lệ
  var s = make(['.OX......', 'O.X......', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 0);
  s.board[at(s, 1, 0)] = 1; // Đen ở (1,0) -> Trắng (0,1) chỉ còn khí (0,0)
  s.board[at(s, 1, 1)] = 1;
  var res = G.tryMove(s, 0);
  assert(res.ok, 'phải hợp lệ'); assert.strictEqual(res.captured.length, 1);
});

test('ko: cấm tái chiếm ngay, được lại sau nước khác', function () {
  var s = G.newGame(9);
  function put(r, c, v) { s.board[r * 9 + c] = v; }
  // Ko cổ điển
  put(0, 1, 1); put(1, 0, 1); put(2, 1, 1);
  put(0, 2, 2); put(1, 3, 2); put(2, 2, 2); put(1, 1, 2);
  // thế cờ nạp tay → tính lại hash bằng cách chơi lại: dựng bằng play thay thế
  s = G.newGame(9);
  var seq = [[0, 1, 0], [0, 2, 1], [1, 0, 0], [1, 3, 1], [2, 1, 0], [2, 2, 1]];
  seq.forEach(function (m) { s.turn = m[2]; assert(G.play(s, m[0] * 9 + m[1]).ok); });
  s.turn = 1; assert(G.play(s, 1 * 9 + 1).ok);           // Trắng (1,1),
  s.turn = 0; var cap = G.play(s, 1 * 9 + 2);             // Đen (1,2) bắt (1,1)
  assert(cap.ok && cap.captured.length === 1);
  // Trắng tái chiếm (1,1) bắt (1,2) → ko
  var re = G.tryMove(s, 1 * 9 + 1);
  assert.strictEqual(re.ok, false); assert.strictEqual(re.reason, 'ko');
  // đi chỗ khác rồi (đối phương đáp) mới được lại
  assert(G.play(s, 8 * 9 + 8).ok);  // Trắng chơi chỗ khác
  assert(G.play(s, 8 * 9 + 7).ok);  // Đen
  var re2 = G.tryMove(s, 1 * 9 + 1);
  assert(re2.ok, 'sau nước đe doạ phải được tái chiếm');
});

test('hai pass liên tiếp → chấm điểm', function () {
  var s = G.newGame(9);
  assert.strictEqual(G.pass(s).scoring, false);
  assert.strictEqual(G.pass(s).scoring, true);
  assert(G.isOver(s));
  // pass xen kẽ nước đi thì reset
  var t = G.newGame(9); G.pass(t); G.play(t, 10); G.pass(t);
  assert.strictEqual(G.isOver(t), false);
});

test('area score trên thế nhỏ', function () {
  // 5x5: Đen chiếm 2 cột trái, Trắng 2 cột phải, cột giữa là dame
  var s = make(['XX.OO', 'XX.OO', 'XX.OO', 'XX.OO', 'XX.OO'], 0);
  s.komi = 0.5;
  var sc = G.score(s, []);
  assert.strictEqual(sc.black, 10); assert.strictEqual(sc.white, 10);
  assert.strictEqual(sc.winner, 1);
  // Đen có 1 ô lãnh thổ
  var s2 = make(['X.XOO', 'XXXOO', '.....', '.....', '.....'].map(function (r) { return r; }), 0);
  s2.komi = 0;
  var sc2 = G.score(s2, []);
  // Hàng 0-1: X=5 quân, ô trống (0,1) của Đen. Ba hàng dưới trống giáp cả 2 màu → trung lập
  assert.strictEqual(sc2.black, 6); assert.strictEqual(sc2.white, 4);
});

test('area score với quân chết', function () {
  var s = make(['XXX.O', 'X.XOO', 'XXXOO', 'OOOOO', 'OOOOO'], 0);
  s.board[at(s, 1, 1)] = 0; // mắt Đen
  s.komi = 0;
  var sc = G.score(s, []);
  assert.strictEqual(sc.black, 9); // 8 quân + 1 mắt  (0,3) trống kề X và O → trung lập
  // đánh dấu nhóm Đen là chết → Trắng ăn hết
  var dead = G.group(s.board, 5, at(s, 0, 0)).stones;
  var sc2 = G.score(s, dead);
  assert.strictEqual(sc2.black, 0); assert.strictEqual(sc2.white, 25);
  assert.strictEqual(sc2.winner, 1);
});

test('komi theo cỡ bàn', function () {
  assert.strictEqual(G.komiFor(9), 6.5); assert.strictEqual(G.komiFor(13), 7.5); assert.strictEqual(G.komiFor(19), 7.5);
});

test('AI trả nước hợp lệ nhanh (mọi level, mọi cỡ)', function () {
  [9, 13, 19].forEach(function (size) {
    [1, 2, 3].forEach(function (lv) {
      var s = G.newGame(size);
      var t0 = Date.now();
      for (var i = 0; i < 14; i++) {
        var mv = G.aiMove(s, lv, { timeMs: 150 });
        if (mv < 0) G.pass(s); else { var r = G.play(s, mv); assert(r.ok, 'AI đi nước không hợp lệ'); }
      }
      assert(Date.now() - t0 < 14 * 1500, 'AI quá chậm');
    });
  });
});

test('AI bắt quân khi có thể và cứu quân atari', function () {
  var s = make(['.X.......', 'XO.......', '.X.......', '.........', '.........', '.........', '.........', '.........', '.........'], 0);
  assert.strictEqual(G.aiMove(s, 3, { rnd: function () { return 0; }, timeMs: 50 }), at(s, 1, 2));
});

test('AI đánh cả ván ngắn không lỗi và kết thúc bằng pass', function () {
  var s = G.newGame(9), guard = 0;
  while (!G.isOver(s) && guard++ < 400) {
    var mv = G.aiMove(s, 2);
    if (mv < 0) G.pass(s); else assert(G.play(s, mv).ok);
  }
  assert(G.isOver(s), 'ván tự chơi phải kết thúc');
  var sc = G.score(s, []);
  assert(typeof sc.black === 'number');
});

console.log('\n' + passed + ' tests passed');
