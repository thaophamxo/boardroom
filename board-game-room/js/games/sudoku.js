/* Sudoku – UI. Cần SudokuEngine (js/engines/sudoku-engine.js). */
(function () {
  var E = window.SudokuEngine;
  var LEVEL_NAMES = { 1: 'Dễ', 2: 'Vừa', 3: 'Khó' };
  var LEVEL_KEY = { 1: 'easy', 2: 'medium', 3: 'hard' };
  var MAX_HINTS = 3;

  function fmt(ms) {
    var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s %= 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function create(root, ctx) {
    var levelNum = (ctx.opts && +ctx.opts.level) || 2;
    var levelKey = LEVEL_KEY[levelNum] || 'medium';
    var saveKey = 'bgr:sudoku:save:' + levelKey, bestKey = 'bgr:sudoku:best:' + levelKey;
    var S = null;            // trạng thái ván
    var sel = -1, noteMode = false, undo = [], redo = [], wrong = {}, timer = null, lastTick = 0, destroyed = false;
    var cells = [], padBtns = [], timeEl, hintEl, boardEl, bestEl;

    root.innerHTML = '';
    root.classList.add('g-sudoku');
    var wrap = el('div', 'sd-wrap', root);
    var top = el('div', 'sd-top', wrap);
    timeEl = el('span', 'sd-time chip', top);
    var lvEl = el('span', 'chip', top); lvEl.textContent = 'Độ khó: ' + (LEVEL_NAMES[levelNum] || 'Vừa');
    bestEl = el('span', 'chip muted', top);
    hintEl = el('span', 'chip', top);
    boardEl = el('div', 'sd-board', wrap);
    boardEl.setAttribute('role', 'grid');
    for (var i = 0; i < 81; i++) {
      var c = el('div', 'sd-cell', boardEl);
      if (i % 9 % 3 === 2 && i % 9 !== 8) c.classList.add('br');
      if (((i / 9) | 0) % 3 === 2 && ((i / 9) | 0) !== 8) c.classList.add('bb');
      c.setAttribute('data-i', i);
      cells.push(c);
    }
    var pad = el('div', 'sd-pad', wrap);
    for (var d = 1; d <= 9; d++) {
      var b = el('button', 'sd-key', pad); b.type = 'button'; b.setAttribute('data-d', d);
      b.innerHTML = '<span class="n">' + d + '</span><span class="rem"></span>';
      padBtns.push(b);
    }

    function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
    function snapshot() { return { g: S.grid.slice(), n: S.notes.slice() }; }
    function restore(s) { S.grid = s.g.slice(); S.notes = s.n.slice(); }

    function newGame() {
      var r = E.generate(levelKey);
      S = { puzzle: r.puzzle, solution: r.solution, grid: r.puzzle.slice(), notes: new Array(81).fill(0),
            elapsed: 0, hints: MAX_HINTS, done: false };
      undo = []; redo = []; wrong = {}; sel = -1; noteMode = false;
      lsDel(saveKey);
      begin();
    }
    function tryResume() {
      var raw = lsGet(saveKey);
      if (!raw) return false;
      try {
        var o = JSON.parse(raw);
        if (!o || o.puzzle.length !== 81 || o.grid.length !== 81 || o.solution.length !== 81 || o.notes.length !== 81) return false;
        S = { puzzle: o.puzzle, solution: o.solution, grid: o.grid, notes: o.notes, elapsed: +o.elapsed || 0,
              hints: typeof o.hints === 'number' ? o.hints : MAX_HINTS, done: false };
        undo = []; redo = []; wrong = {}; sel = -1; noteMode = false;
        begin();
        ctx.ui.toast && ctx.ui.toast('Đã khôi phục ván đang dở');
        return true;
      } catch (e) { return false; }
    }
    function begin() {
      var best = +lsGet(bestKey) || 0;
      bestEl.textContent = best ? 'Kỷ lục: ' + fmt(best) : 'Chưa có kỷ lục';
      startTimer();
      render();
    }
    function save() {
      if (!S || S.done) return;
      lsSet(saveKey, JSON.stringify({ puzzle: S.puzzle, solution: S.solution, grid: S.grid, notes: S.notes, elapsed: S.elapsed, hints: S.hints }));
    }

    function startTimer() {
      stopTimer();
      lastTick = Date.now();
      timer = setInterval(tick, 500);
    }
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function tick() {
      var now = Date.now();
      if (document.hidden || !S || S.done) { lastTick = now; return; }
      S.elapsed += now - lastTick; lastTick = now;
      timeEl.textContent = '⏱ ' + fmt(S.elapsed);
    }
    function onVis() { lastTick = Date.now(); if (document.hidden) save(); }
    document.addEventListener('visibilitychange', onVis);

    function isGiven(i) { return !!S.puzzle[i]; }

    function setStatus() {
      var left = 0; for (var i = 0; i < 81; i++) if (!S.grid[i]) left++;
      ctx.ui.status('Còn ' + left + ' ô trống' + (noteMode ? ' · đang ghi chú' : ''), 'info');
    }

    function render() {
      var conf = {}; E.conflicts(S.grid).forEach(function (i) { conf[i] = true; });
      var sv = sel >= 0 ? S.grid[sel] : 0, sr = (sel / 9) | 0, sc = sel % 9, sb = sel >= 0 ? E.boxOf(sel) : -1;
      var counts = new Array(10).fill(0);
      for (var i = 0; i < 81; i++) {
        var v = S.grid[i]; if (v) counts[v]++;
        var c = cells[i], cls = 'sd-cell';
        if (c.classList.contains('br')) cls += ' br';
        if (c.classList.contains('bb')) cls += ' bb';
        if (isGiven(i)) cls += ' given';
        if (sel >= 0) {
          if (i === sel) cls += ' sel';
          else if (((i / 9) | 0) === sr || i % 9 === sc || E.boxOf(i) === sb) cls += ' hl';
          if (sv && v === sv && i !== sel) cls += ' same';
        }
        if (conf[i] && !isGiven(i)) cls += ' err';
        if (wrong[i]) cls += ' wrong';
        c.className = cls;
        if (v) c.innerHTML = '<span class="v">' + v + '</span>';
        else if (S.notes[i]) {
          var h = '<span class="notes">';
          for (var d = 1; d <= 9; d++) h += '<i>' + ((S.notes[i] >> (d - 1)) & 1 ? d : '') + '</i>';
          c.innerHTML = h + '</span>';
        } else c.innerHTML = '';
      }
      padBtns.forEach(function (b, k) {
        var d = k + 1, rem = Math.max(0, 9 - counts[d]);
        b.style.visibility = rem === 0 ? 'hidden' : 'visible';
        b.querySelector('.rem').textContent = rem;
      });
      timeEl.textContent = '⏱ ' + fmt(S.elapsed);
      hintEl.textContent = 'Gợi ý: ' + S.hints + '/' + MAX_HINTS;
      boardEl.classList.toggle('note-mode', noteMode);
      setStatus();
      updateToolbar();
    }

    function updateToolbar() {
      ctx.ui.toolbar([
        { id: 'note', label: 'Ghi chú ' + (noteMode ? 'BẬT' : 'tắt'), icon: '✎', primary: noteMode, onClick: toggleNote },
        { id: 'erase', label: 'Xoá', icon: '⌫', onClick: erase },
        { id: 'undo', label: 'Đi lại', icon: '↶', disabled: !undo.length, onClick: doUndo },
        { id: 'redo', label: 'Làm lại', icon: '↷', disabled: !redo.length, onClick: doRedo },
        { id: 'hint', label: 'Gợi ý (' + S.hints + ')', icon: '💡', disabled: S.hints <= 0 || S.done, onClick: hint },
        { id: 'check', label: 'Kiểm tra', icon: '✓', onClick: check }
      ]);
    }

    function push() { undo.push(snapshot()); if (undo.length > 300) undo.shift(); redo = []; }
    function select(i) {
      sel = i; ctx.sound.play('click'); render();
    }
    function toggleNote() { noteMode = !noteMode; render(); }

    function peers(i, f) {
      var r = (i / 9) | 0, c = i % 9, b = E.boxOf(i);
      for (var k = 0; k < 81; k++) if (k !== i && (((k / 9) | 0) === r || k % 9 === c || E.boxOf(k) === b)) f(k);
    }

    function enter(d) {
      if (S.done || sel < 0 || isGiven(sel)) return;
      wrong = {};
      if (noteMode) {
        if (S.grid[sel]) return;
        push(); S.notes[sel] ^= (1 << (d - 1));
        ctx.sound.play('click'); render(); save(); return;
      }
      if (S.grid[sel] === d) return;
      push();
      S.grid[sel] = d; S.notes[sel] = 0;
      peers(sel, function (k) { S.notes[k] &= ~(1 << (d - 1)); });
      var bad = E.hasConflict(S.grid, sel, d) || S.solution[sel] !== d;
      ctx.sound.play(bad ? 'error' : 'pop');
      render(); save(); checkDone();
    }
    function erase() {
      if (S.done || sel < 0 || isGiven(sel)) return;
      if (!S.grid[sel] && !S.notes[sel]) return;
      wrong = {}; push(); S.grid[sel] = 0; S.notes[sel] = 0; ctx.sound.play('click'); render(); save();
    }
    function doUndo() {
      if (!undo.length || S.done) return;
      redo.push(snapshot()); restore(undo.pop()); wrong = {}; ctx.sound.play('click'); render(); save();
    }
    function doRedo() {
      if (!redo.length || S.done) return;
      undo.push(snapshot()); restore(redo.pop()); wrong = {}; ctx.sound.play('click'); render(); save();
    }
    function hint() {
      if (S.done || S.hints <= 0) return;
      var t = -1;
      if (sel >= 0 && !isGiven(sel) && S.grid[sel] !== S.solution[sel]) t = sel;
      else {
        var cand = [];
        for (var i = 0; i < 81; i++) if (S.grid[i] !== S.solution[i]) cand.push(i);
        if (!cand.length) return;
        t = cand[(Math.random() * cand.length) | 0];
      }
      wrong = {}; push();
      var d = S.solution[t];
      S.grid[t] = d; S.notes[t] = 0;
      peers(t, function (k) { S.notes[k] &= ~(1 << (d - 1)); });
      S.hints--; sel = t;
      ctx.sound.play('hint'); render(); save(); checkDone();
    }
    function check() {
      if (S.done) return;
      wrong = {}; var n = 0;
      for (var i = 0; i < 81; i++) if (S.grid[i] && S.grid[i] !== S.solution[i]) { wrong[i] = true; n++; }
      if (n) { ctx.sound.play('error'); ctx.ui.toast('Có ' + n + ' ô chưa đúng'); }
      else ctx.ui.toast('Tốt lắm, chưa có ô nào sai!');
      render();
    }
    function checkDone() {
      for (var i = 0; i < 81; i++) if (S.grid[i] !== S.solution[i]) return;
      S.done = true; stopTimer(); lsDel(saveKey);
      var best = +lsGet(bestKey) || 0, isNew = !best || S.elapsed < best;
      if (isNew) { lsSet(bestKey, String(S.elapsed)); bestEl.textContent = 'Kỷ lục: ' + fmt(S.elapsed); }
      ctx.sound.play('complete');
      ctx.ui.status('Hoàn thành!', 'good');
      updateToolbar();
      ctx.ui.result({ title: 'Hoàn thành!', text: 'Thời gian ' + fmt(S.elapsed) + (isNew ? ' (kỷ lục mới!)' : ''), tone: 'win' });
    }

    // sự kiện
    boardEl.addEventListener('pointerdown', function (e) {
      var t = e.target.closest ? e.target.closest('.sd-cell') : null;
      if (t && S) select(+t.getAttribute('data-i'));
    });
    pad.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('.sd-key') : null;
      if (t && S) enter(+t.getAttribute('data-d'));
    });
    function onKey(e) {
      if (!S || e.ctrlKey || e.metaKey || e.altKey) {
        if (S && (e.ctrlKey || e.metaKey) && !e.altKey) {
          var k = e.key.toLowerCase();
          if (k === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
          else if (k === 'y') { e.preventDefault(); doRedo(); }
        }
        return;
      }
      var key = e.key;
      if (key >= '1' && key <= '9') { enter(+key); e.preventDefault(); }
      else if (key === 'Backspace' || key === 'Delete' || key === '0') { erase(); e.preventDefault(); }
      else if (key === 'n' || key === 'N') toggleNote();
      else if (key.indexOf('Arrow') === 0) {
        e.preventDefault();
        var i = sel < 0 ? 40 : sel, r = (i / 9) | 0, c = i % 9;
        if (sel >= 0) {
          if (key === 'ArrowUp') r = (r + 8) % 9; else if (key === 'ArrowDown') r = (r + 1) % 9;
          else if (key === 'ArrowLeft') c = (c + 8) % 9; else if (key === 'ArrowRight') c = (c + 1) % 9;
        }
        select(r * 9 + c);
      }
    }
    document.addEventListener('keydown', onKey);

    if (!tryResume()) newGame();

    return {
      restart: function () {
        levelNum = (ctx.opts && +ctx.opts.level) || levelNum;
        levelKey = LEVEL_KEY[levelNum] || 'medium';
        saveKey = 'bgr:sudoku:save:' + levelKey; bestKey = 'bgr:sudoku:best:' + levelKey;
        lvEl.textContent = 'Độ khó: ' + (LEVEL_NAMES[levelNum] || 'Vừa');
        newGame();
      },
      destroy: function () {
        destroyed = true; stopTimer(); save();
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVis);
        root.innerHTML = ''; root.classList.remove('g-sudoku');
      }
    };
  }

  window.Games = window.Games || {};
  Games.register({
    id: 'sudoku', name: 'Sudoku', tagline: 'Điền số 1–9 – thư giãn đầu óc', players: 1,
    options: [{ key: 'level', label: 'Độ khó', choices: [{ v: 1, l: 'Dễ' }, { v: 2, l: 'Vừa' }, { v: 3, l: 'Khó' }], default: 2 }],
    create: create
  });
})();
