/* Cờ Caro – UI. Cần GomokuEngine (js/engines/gomoku-engine.js). */
(function () {
  var E = window.GomokuEngine;
  var NS = 'http://www.w3.org/2000/svg';
  var NAMES = ['X', 'O'];
  var COLORS = ['#2f4f86', '#e57f6a'];

  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }

  function create(root, ctx) {
    var N = +(ctx.opts && ctx.opts.size) || 15;
    var block = !!(ctx.opts && (ctx.opts.block === true || ctx.opts.block === 1 || ctx.opts.block === 'on' || ctx.opts.block === '1'));
    var level = +(ctx.opts && ctx.opts.level) || 2;
    var mode = ctx.mode;
    var S, mySide = null, aiTimer = null, gen = 0, destroyed = false, ended = false, thinking = false, unsub = null;
    var hover = -1;

    root.innerHTML = '';
    root.classList.add('g-gomoku');
    var wrap = el('div', 'gm-wrap', root);
    var info = el('div', 'gm-info', wrap);
    var chipX = el('span', 'chip gm-chip', info), chipO = el('span', 'chip gm-chip', info);
    var chipRule = el('span', 'chip muted', info);
    chipRule.textContent = N + '×' + N + ' · ' + (block ? 'Chặn 2 đầu: Bật' : 'Chặn 2 đầu: Tắt');
    var cnt = el('span', 'chip muted gm-count', info);
    var board = svg('svg', { 'class': 'gm-svg', viewBox: '0 0 ' + N + ' ' + N, role: 'img', 'aria-label': 'Bàn cờ caro' }, el('div', 'gm-board', wrap));
    svg('rect', { x: 0, y: 0, width: N, height: N, fill: '#f8fbff' }, board);
    var gridG = svg('g', { stroke: '#b4cde6', 'stroke-width': 0.04, 'stroke-linecap': 'round' }, board);
    for (var i = 0; i < N; i++) {
      svg('line', { x1: 0.5, y1: i + 0.5, x2: N - 0.5, y2: i + 0.5 }, gridG);
      svg('line', { x1: i + 0.5, y1: 0.5, x2: i + 0.5, y2: N - 0.5 }, gridG);
    }
    var hoshi = N === 19 ? [3, 9, 15] : [3, 7, 11];
    hoshi.forEach(function (r) { hoshi.forEach(function (c) { svg('circle', { cx: c + 0.5, cy: r + 0.5, r: 0.09, fill: '#9dbcdc' }, board); }); });
    var hlG = svg('g', {}, board), stoneG = svg('g', {}, board), winG = svg('g', {}, board), prevG = svg('g', { 'pointer-events': 'none' }, board);

    function sideOf(turn) { return NAMES[turn]; }
    function drawMark(parent, side, r, c, opacity) {
      var g = svg('g', { opacity: opacity || 1 }, parent), x = c + 0.5, y = r + 0.5;
      if (side === 0) {
        var d = 0.27;
        svg('line', { x1: x - d, y1: y - d, x2: x + d, y2: y + d, stroke: COLORS[0], 'stroke-width': 0.13, 'stroke-linecap': 'round' }, g);
        svg('line', { x1: x + d, y1: y - d, x2: x - d, y2: y + d, stroke: COLORS[0], 'stroke-width': 0.13, 'stroke-linecap': 'round' }, g);
      } else {
        svg('circle', { cx: x, cy: y, r: 0.28, fill: 'none', stroke: COLORS[1], 'stroke-width': 0.13 }, g);
      }
      return g;
    }

    function render() {
      stoneG.innerHTML = ''; winG.innerHTML = ''; prevG.innerHTML = ''; hlG.innerHTML = '';
      var winSet = {};
      if (S.line) S.line.forEach(function (i) { winSet[i] = 1; });
      for (var i = 0; i < N * N; i++) {
        var v = S.board[i];
        if (!v) continue;
        var r = (i / N) | 0, c = i % N;
        if (winSet[i]) svg('rect', { x: c + 0.06, y: r + 0.06, width: 0.88, height: 0.88, rx: 0.16, fill: '#fff2b8', stroke: '#f0c75e', 'stroke-width': 0.05 }, winG);
        drawMark(stoneG, v - 1, r, c);
      }
      if (S.last >= 0 && !S.line) {
        var lr = (S.last / N) | 0, lc = S.last % N;
        svg('rect', { x: lc + 0.08, y: lr + 0.08, width: 0.84, height: 0.84, rx: 0.14, fill: 'none', stroke: '#5aa5e8', 'stroke-width': 0.06 }, hlG);
        svg('circle', { cx: lc + 0.82, cy: lr + 0.18, r: 0.08, fill: '#5aa5e8' }, hlG);
      } else if (S.last >= 0) {
        var wr = (S.last / N) | 0, wc = S.last % N;
        svg('circle', { cx: wc + 0.82, cy: wr + 0.18, r: 0.08, fill: '#d9a22d' }, hlG);
      }
      cnt.textContent = 'Nước: ' + S.moves.length;
      chipX.textContent = 'X' + (mySide === 0 ? ' (bạn)' : mode === 'ai' ? ' (AI)' : mode === 'online' ? ' (đối thủ)' : '');
      chipO.textContent = 'O' + (mySide === 1 ? ' (bạn)' : mode === 'ai' ? ' (AI)' : mode === 'online' ? ' (đối thủ)' : '');
      chipX.style.color = COLORS[0]; chipO.style.color = COLORS[1];
      chipX.classList.toggle('active', !S.over && S.turn === 0);
      chipO.classList.toggle('active', !S.over && S.turn === 1);
      drawHover();
    }
    function drawHover() {
      prevG.innerHTML = '';
      if (hover < 0 || ended || S.over || !myTurn() || S.board[hover]) return;
      drawMark(prevG, S.turn, (hover / N) | 0, hover % N, 0.35);
    }

    function myTurn() {
      if (ended || S.over) return false;
      if (mode === 'local') return true;
      return S.turn === mySide && !thinking;
    }
    function aiSide() { return 1 - mySide; }

    function setStatus() {
      if (ended) return;
      if (mode === 'local') ctx.ui.status('Lượt của ' + sideOf(S.turn), 'info');
      else if (mode === 'ai') ctx.ui.status(S.turn === mySide ? 'Lượt của bạn (' + sideOf(mySide) + ')' : 'AI đang nghĩ…', S.turn === mySide ? 'good' : 'info');
      else ctx.ui.status(S.turn === mySide ? 'Lượt của bạn (' + sideOf(mySide) + ')' : 'Chờ đối thủ (' + sideOf(S.turn) + ')…', S.turn === mySide ? 'good' : 'info');
    }
    function setToolbar() {
      var items = [];
      if (mode !== 'online') items.push({ id: 'undo', label: 'Đi lại', onClick: undo, disabled: !S.moves.length || (mode === 'ai' && !canUndoAi()) });
      items.push({ id: 'resign', label: 'Đầu hàng', onClick: resign, disabled: ended || S.over });
      ctx.ui.toolbar(items);
    }
    function canUndoAi() { return S.moves.length > (mySide === 1 ? 1 : 0); }

    function finish(title, text, tone) {
      ended = true;
      setToolbar();
      ctx.ui.status(title, tone === 'win' ? 'good' : tone === 'lose' ? 'bad' : 'warn');
      ctx.ui.result({ title: title, text: text, tone: tone });
    }
    function afterMove() {
      render();
      if (S.over) {
        if (S.draw) { finish('Hoà', 'Bàn cờ đã đầy, hai bên hoà.', 'draw'); return; }
        var w = S.winner;
        if (mode === 'local') finish(sideOf(w) + ' thắng!', 'Dãy 5 quân liền đã hoàn thành.', 'win');
        else if (w === mySide) finish('Bạn thắng!', 'Bạn có dãy ' + S.line.length + ' quân liền.', 'win');
        else finish('Bạn thua', (mode === 'ai' ? 'AI' : 'Đối thủ') + ' có dãy ' + S.line.length + ' quân liền.', 'lose');
        return;
      }
      setStatus(); setToolbar();
      if (mode === 'ai' && S.turn === aiSide()) scheduleAI();
    }

    function scheduleAI() {
      clearTimeout(aiTimer);
      thinking = true; setStatus();
      var g = gen;
      aiTimer = setTimeout(function () {
        aiTimer = null;
        if (destroyed || g !== gen) return;
        var m = E.aiMove(S, level, { timeMs: 900 });
        thinking = false;
        if (!m) return;
        if (E.play(S, m.r, m.c).ok) ctx.sound.play('place');
        afterMove();
      }, 60);
    }

    function place(r, c) {
      var res = E.play(S, r, c);
      if (!res.ok) return false;
      ctx.sound.play('place');
      return true;
    }

    function onTap(i) {
      if (!myTurn()) return;
      if (S.board[i]) { ctx.sound.play('error'); return; }
      var r = (i / N) | 0, c = i % N;
      if (!place(r, c)) return;
      if (mode === 'online') ctx.net.send({ t: 'move', r: r, c: c });
      afterMove();
    }

    function cellFromEvent(ev) {
      var rc = board.getBoundingClientRect();
      var c = Math.floor((ev.clientX - rc.left) / rc.width * N), r = Math.floor((ev.clientY - rc.top) / rc.height * N);
      if (r < 0 || c < 0 || r >= N || c >= N) return -1;
      return r * N + c;
    }
    function onClick(ev) { var i = cellFromEvent(ev); if (i >= 0) onTap(i); }
    function onMove(ev) {
      if (ev.pointerType && ev.pointerType !== 'mouse') return;
      var i = cellFromEvent(ev);
      if (i !== hover) { hover = i; drawHover(); }
    }
    function onLeave() { hover = -1; drawHover(); }
    board.addEventListener('click', onClick);
    board.addEventListener('pointermove', onMove);
    board.addEventListener('pointerleave', onLeave);

    function undo() {
      if (mode === 'online' || !S.moves.length) return;
      clearTimeout(aiTimer); aiTimer = null; thinking = false; gen++;
      var wasEnded = ended; ended = false;
      if (mode === 'local') E.undo(S, 1);
      else {
        // về lượt của người
        E.undo(S, 1);
        while (S.moves.length && S.turn !== mySide) E.undo(S, 1);
      }
      hover = -1;
      render(); setStatus(); setToolbar();
      if (mode === 'ai' && S.turn === aiSide()) scheduleAI();
    }

    function resign() {
      if (ended || S.over) return;
      ctx.ui.confirm('Bạn chắc chắn muốn đầu hàng?').then(function (ok) {
        if (!ok || destroyed || ended) return;
        if (mode === 'online') { ctx.net.send({ t: 'resign' }); finish('Bạn đã đầu hàng', 'Đối thủ thắng ván này.', 'lose'); }
        else if (mode === 'ai') { gen++; clearTimeout(aiTimer); thinking = false; finish('Bạn đã đầu hàng', 'AI thắng ván này.', 'lose'); }
        else finish(sideOf(1 - S.turn) + ' thắng!', sideOf(S.turn) + ' đã đầu hàng.', 'win');
      });
    }

    function onNet(m) {
      if (destroyed || ended || !m) return;
      if (m.t === 'resign') { finish('Đối thủ đầu hàng', 'Bạn thắng ván này!', 'win'); return; }
      if (m.t === 'move') {
        if (S.over || S.turn === mySide) return;
        if (!Number.isInteger(m.r) || !Number.isInteger(m.c) || m.r < 0 || m.c < 0 || m.r >= N || m.c >= N) return;
        if (!place(m.r, m.c)) return;
        afterMove();
      }
    }
    if (mode === 'online' && ctx.net) unsub = ctx.net.onMessage(onNet);

    function restart() {
      gen++; clearTimeout(aiTimer); aiTimer = null; thinking = false; ended = false; hover = -1;
      mySide = (mode === 'local') ? null : (ctx.mySide == null ? 0 : ctx.mySide);
      S = E.newGame(N, block);
      render(); setStatus(); setToolbar();
      if (mode === 'ai' && S.turn === aiSide()) scheduleAI();
    }
    function destroy() {
      destroyed = true; gen++; clearTimeout(aiTimer); aiTimer = null;
      if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
      board.removeEventListener('click', onClick);
      board.removeEventListener('pointermove', onMove);
      board.removeEventListener('pointerleave', onLeave);
    }
    function onPeerLeft() {
      if (ended) return;
      ended = true; setToolbar();
      ctx.ui.status('Đối thủ đã thoát', 'warn');
      ctx.ui.toast && ctx.ui.toast('Đối thủ đã thoát khỏi phòng');
    }

    restart();
    return { restart: restart, destroy: destroy, onPeerLeft: onPeerLeft };
  }

  Games.register({
    id: 'gomoku', name: 'Cờ caro', tagline: 'Nối 5 quân liền nhau', players: 2, sides: ['X', 'O'],
    options: [
      { key: 'size', label: 'Cỡ bàn', choices: [{ v: 15, l: '15×15' }, { v: 19, l: '19×19' }], default: 15 },
      { key: 'block', label: 'Luật chặn 2 đầu', choices: [{ v: false, l: 'Tắt' }, { v: true, l: 'Bật' }], default: false },
      { key: 'level', label: 'Độ khó', modes: ['ai'], choices: [{ v: 1, l: 'Dễ' }, { v: 2, l: 'Vừa' }, { v: 3, l: 'Khó' }], default: 2 }
    ],
    create: create
  });
})();
