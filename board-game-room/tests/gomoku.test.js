'use strict';
var assert = require('assert');
var G = require('../js/engines/gomoku-engine.js');
var passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok - ' + name); }
function put(s, list) { list.forEach(function (p) { s.board[p[0] * s.size + p[1]] = p[2]; }); }
function mk(rows, turn, block) {
  var s = G.newGame(rows.length, block);
  rows.forEach(function (row, r) { for (var c = 0; c < row.length; c++) { var ch = row[c]; if (ch === 'X') s.board[r * s.size + c] = 1; else if (ch === 'O') s.board[r * s.size + c] = 2; } });
  s.turn = turn;
  return s;
}
function empty(n) { var a = []; for (var i = 0; i < n; i++) a.push(new Array(n + 1).join('.')); return a; }
function setRow(rows, r, c, ch) { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); }

function winTest(name, dr, dc) {
  test('thắng ' + name, function () {
    var s = G.newGame(15, false);
    var r0 = dr < 0 ? 8 : 3, c0 = 3;
    for (var i = 0; i < 4; i++) { s.board[(r0 + dr * i) * 15 + c0 + dc * i] = 1; }
    s.turn = 0;
    var res = G.play(s, r0 + dr * 4, c0 + dc * 4);
    assert(res.win); assert.strictEqual(s.winner, 0); assert.strictEqual(s.line.length, 5); assert(s.over);
  });
}
winTest('ngang', 0, 1); winTest('dọc', 1, 0); winTest('chéo \\', 1, 1); winTest('chéo /', -1, 1);

test('6 liền vẫn thắng khi luật chặn tắt', function () {
  var rows = empty(15); rows[7] = '..XXXXX.O......'.padEnd(15, '.'); 
  var s = mk(rows, 0, false); s.board[7 * 15 + 1] = 0;
  var r = G.play(s, 7, 1); assert(r.win); assert.strictEqual(s.line.length, 6);
});

test('luật chặn: 5 bị chặn 2 đầu không thắng', function () {
  var rows = empty(15); rows[5] = '.OXXXX.O.......'; 
  var s = mk(rows, 0, true);
  var r = G.play(s, 5, 6); assert(!r.win); assert(!s.over);
  var s2 = mk(rows, 0, false); var r2 = G.play(s2, 5, 6); assert(r2.win);
});

test('luật chặn: 5 còn 1 đầu mở vẫn thắng', function () {
  var rows = empty(15); rows[5] = '.OXXXX.........'; 
  var s = mk(rows, 0, true);
  assert(G.play(s, 5, 6).win);
});

test('luật chặn: chặn bằng mép bàn', function () {
  var rows = empty(15); rows[5] = 'XXXX.O.........'; 
  var s = mk(rows, 0, true);
  assert(!G.play(s, 5, 4).win);
});

test('hoà khi đầy bàn', function () {
  var n = 5, s = G.newGame(n, false);
  // tô theo mẫu không tạo 5 liền: dùng bàn 5x5 với mẫu 2x2 khối
  var pat = ['XXOOX', 'OOXXO', 'XXOOX', 'OOXXO', 'XXOO.'];
  pat.forEach(function (row, r) { for (var c = 0; c < n; c++) { var ch = row[c]; if (ch === 'X') s.board[r * n + c] = 1; else if (ch === 'O') s.board[r * n + c] = 2; } });
  s.moves = new Array(24).fill(0); s.turn = 0;
  var res = G.play(s, 4, 4);
  assert(res.draw && s.draw && s.over && s.winner === -1);
});

test('undo khôi phục lượt', function () {
  var s = G.newGame(15, false);
  G.play(s, 7, 7); G.play(s, 7, 8); G.play(s, 8, 8);
  G.undo(s, 2);
  assert.strictEqual(s.moves.length, 1); assert.strictEqual(s.turn, 1); assert.strictEqual(s.board[7 * 15 + 8], 0);
});

[1, 2, 3].forEach(function (lv) {
  if (lv === 1) return;
  test('AI mức ' + lv + ' chặn khi đối thủ có 4 mở', function () {
    var rows = empty(15); rows[7] = '...XXXX........'; rows[8] = '..OO...........';
    var s = mk(rows, 1, false);
    var m = G.aiMove(s, lv); assert(m.r === 7 && (m.c === 2 || m.c === 7), JSON.stringify(m));
  });
  test('AI mức ' + lv + ' tự thắng khi mình có 4', function () {
    var rows = empty(15); rows[7] = '...OOOO........'; rows[9] = '..XXX..........';
    var s = mk(rows, 1, false);
    var m = G.aiMove(s, lv); assert(m.r === 7 && (m.c === 2 || m.c === 7), JSON.stringify(m));
  });
  test('AI mức ' + lv + ' ưu tiên thắng hơn chặn', function () {
    var rows = empty(15); rows[3] = '.XXXX..........'; rows[10] = '..OOOO.........';
    var s = mk(rows, 1, false);
    var m = G.aiMove(s, lv); assert(m.r === 10 && (m.c === 1 || m.c === 6), JSON.stringify(m));
  });
});

test('AI ván đầu đi giữa bàn và chạy ≤1.2s mức 3', function () {
  var s = G.newGame(19, false), m = G.aiMove(s, 3); assert.strictEqual(m.r, 9);
  G.play(s, 9, 9); G.play(s, 9, 10); G.play(s, 8, 8); G.play(s, 10, 10);
  var t = Date.now(); G.aiMove(s, 3); assert(Date.now() - t < 1200);
});

test('AI tự đấu với AI hoàn tất ván hợp lệ', function () {
  var s = G.newGame(15, true), n = 0;
  while (!s.over && n++ < 225) { var m = G.aiMove(s, 2); assert(G.play(s, m.r, m.c).ok); }
  assert(s.over);
});
console.log(passed + ' tests passed');
