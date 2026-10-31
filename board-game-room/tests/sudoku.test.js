const assert = require('assert');
const S = require('../js/engines/sudoku-engine.js');
const parse = s => s.split('').map(Number);
// Đề mẫu nổi tiếng
const P = parse('530070000600195000098000060800060003400803001700020006060000280000419005000080079');
const SOL = parse('534678912672195348198342567859761423426853791713924856961537284287419635345286179');
assert.deepStrictEqual(S.solve(P), SOL);
assert.strictEqual(S.countSolutions(P, 2), 1);
const empty = new Array(81).fill(0);
assert.strictEqual(S.countSolutions(empty, 2), 2);
const bad = P.slice(); bad[2] = 5; // trùng 5 ở hàng 0
assert.strictEqual(S.solve(bad), null);
assert.ok(S.conflicts(bad).length >= 2);
assert.strictEqual(S.conflicts(SOL).length, 0);
assert.ok(S.isComplete(SOL));
assert.ok(S.hasConflict(P, 2, 5) && !S.hasConflict(P, 2, 4));

const ranges = { easy: [40, 44], medium: [32, 36], hard: [26, 31] };
for (const lv of Object.keys(ranges)) {
  let max = 0, tot = 0;
  for (let n = 0; n < 20; n++) {
    const t = Date.now(); const r = S.generate(lv); const dt = Date.now() - t; tot += dt; max = Math.max(max, dt);
    const given = r.puzzle.filter(Boolean).length;
    assert.strictEqual(given, r.clues);
    assert.ok(given >= ranges[lv][0] && given <= ranges[lv][1], lv + ' clues ' + given);
    assert.strictEqual(S.countSolutions(r.puzzle, 2), 1, 'unique');
    assert.deepStrictEqual(S.solve(r.puzzle), r.solution);
    assert.ok(S.isComplete(r.solution));
    r.puzzle.forEach((v, i) => v && assert.strictEqual(v, r.solution[i]));
  }
  console.log(lv, 'avg', (tot / 20) | 0, 'ms, max', max, 'ms');
  assert.ok(max < 1500, 'quá chậm');
}
console.log('sudoku tests OK');
