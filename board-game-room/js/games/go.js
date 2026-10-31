/* Cờ Vây – UI. Cần GoEngine (js/engines/go-engine.js). */
(function () {
  var E = window.GoEngine;
  var NS = 'http://www.w3.org/2000/svg';
  var NAMES = ['Đen', 'Trắng'];

  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function fmt(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }

  function create(root, ctx) {
    var N = +(ctx.opts && ctx.opts.size) || 9;
    var level = +(ctx.opts && ctx.opts.level) || 2;
    var mode = ctx.mode;
    var S, mySide = null, history = [], phase = 'play', dead = {}, myFinal = false, oppFinal = false;
    var aiTimer = null, gen = 0, destroyed = false, ended = false, thinking = false, unsub = null, hover = -1;

    root.innerHTML = '';
    root.classList.add('g-go');
    var wrap = el('div', 'go-wrap', root);
    var info = el('div', 'go-info', wrap);
    var chipB = el('span', 'chip go-chip', info), chipW = el('span', 'chip go-chip', info);
    var chipKomi = el('span', 'chip muted', info);
    var scoreBox = el('div', 'go-score panel', wrap);
    scoreBox.style.display = 'none';
    var holder = el('div', 'go-board', wrap);
    var board = svg('svg', { 'class': 'go-svg', viewBox: '0 0 ' + N + ' ' + N, role: 'img', 'aria-label': 'Bàn cờ vây' }, holder);
    svg('rect', { x: 0, y: 0, width: N, height: N, fill: '#dcecfa' }, board);
    var gridG = svg('g', { stroke: '#4a6482', 'stroke-width': 0.035, 'stroke-linecap': 'square' }, board);
    for (var i = 0; i < N; i++) {
      svg('line', { x1: 0.5, y1: i + 0.5, x2: N - 0.5, y2: i + 0.5 }, gridG);
      svg('line', { x1: i + 0.5, y1: 0.5, x2: i + 0.5, y2: N - 0.5 }, gridG);
    }
    var hs = N === 9 ? [2, 4, 6] : N === 13 ? [3, 6, 9] : [3, 9, 15];
    hs.forEach(function (r) { hs.forEach(function (c) { svg('circle', { cx: c + 0.5, cy: r + 0.5, r: 0.085, fill: '#3b5373' }, board); }); });
    var terrG = svg('g', { 'pointer-events': 'none' }, board), stoneG = svg('g', {}, board), markG = svg('g', { 'pointer-events': 'none' }, board), prevG = svg('g', { 'pointer-events': 'none' }, board);

    function myTurn() {
      if (ended || phase !== 'play') return false;
      if (mode === 'local') return true;
      return S.turn === mySide && !thinking;
    }
    function deadList() { return Object.keys(dead).map(Number).sort(function (a, b) { return a - b; }); }

    function stone(parent, i, color, op) {
      var r = (i / N) | 0, c = i % N;
      var g = svg('g', { opacity: op == null ? 1 : op }, parent);
      if (color === 1) svg('circle', { cx: c + 0.5, cy: r + 0.5, r: 0.46, fill: '#2b3a4a', stroke: '#1d2936', 'stroke-width': 0.03 }, g);
      else svg('circle', { cx: c + 0.5, cy: r + 0.5, r: 0.46, fill: '#ffffff', stroke: '#9cc2e6', 'stroke-width': 0.06 }, g);
      return g;
    }

    function render() {
      stoneG.innerHTML = ''; markG.innerHTML = ''; terrG.innerHTML = '';
      var sc = null;
      if (phase === 'score') sc = E.score(S, deadList());
      for (var i = 0; i < N * N; i++) {
        var v = S.board[i], r = (i / N) | 0, c = i % N;
        if (v) {
          var isDead = !!dead[i];
          stone(stoneG, i, v, isDead ? 0.35 : 1);
          if (isDead) {
            var d = 0.2, x = c + 0.5, y = r + 0.5;
            svg('path', { d: 'M' + (x - d) + ' ' + (y - d) + 'L' + (x + d) + ' ' + (y + d) + 'M' + (x + d) + ' ' + (y - d) + 'L' + (x - d) + ' ' + (y + d), stroke: '#d9626a', 'stroke-width': 0.1, 'stroke-linecap': 'round' }, markG);
          }
        }
        if (sc && sc.owner[i] && (!v || dead[i])) {
          svg('rect', { x: c + 0.5 - 0.16, y: r + 0.5 - 0.16, width: 0.32, height: 0.32, rx: 0.04,
            fill: sc.owner[i] === 1 ? '#2b3a4a' : '#ffffff', stroke: sc.owner[i] === 1 ? '#1d2936' : '#7fa9d3', 'stroke-width': 0.04, opacity: 0.85 }, terrG);
        }
      }
      if (phase === 'play' && S.last >= 0) {
        var lr = (S.last / N) | 0, lc = S.last % N;
        svg('circle', { cx: lc + 0.5, cy: lr + 0.5, r: 0.14, fill: S.board[S.last] === 1 ? '#ffffff' : '#3d8ad0' }, markG);
      }
      chipB.textContent = 'Đen' + (mySide === 0 ? ' (bạn)' : mode === 'ai' && mySide === 1 ? ' (AI)' : '') + ' · bắt ' + S.caps[0];
      chipW.textContent = 'Trắng' + (mySide === 1 ? ' (bạn)' : mode === 'ai' && mySide === 0 ? ' (AI)' : '') + ' · bắt ' + S.caps[1];
      chipB.classList.toggle('active', phase === 'play' && !ended && S.turn === 0);
      chipW.classList.toggle('active', phase === 'play' && !ended && S.turn === 1);
      chipKomi.textContent = N + '×' + N + ' · Komi ' + fmt(S.komi);
      if (sc) {
        scoreBox.style.display = '';
        var lead = sc.diff > 0 ? 'Đen dẫn ' + fmt(sc.diff) : 'Trắng dẫn ' + fmt(-sc.diff);
        scoreBox.innerHTML = '<div class="go-score-row"><b>Đen</b> ' + sc.black + '</div>' +
          '<div class="go-score-row"><b>Trắng</b> ' + sc.white + ' + ' + fmt(sc.komi) + ' = ' + fmt(sc.whiteTotal) + '</div>' +
          '<div class="go-score-lead">' + lead + '</div>' +
          '<div class="muted go-score-hint">Bấm vào nhóm quân để đánh dấu quân chết / sống lại.</div>';
      } else scoreBox.style.display = 'none';
      drawHover();
    }
    function drawHover() {
      prevG.innerHTML = '';
      if (hover < 0 || !myTurn() || S.board[hover]) return;
      if (!E.tryMove(S, hover).ok) return;
      stone(prevG, hover, S.turn + 1, 0.4);
    }

    function setStatus() {
      if (ended) return;
      if (phase === 'score') {
        var t = 'Chấm điểm: bấm nhóm quân chết, rồi Chốt điểm';
        if (mode === 'online') t = myFinal ? 'Đã chốt – chờ đối thủ…' : oppFinal ? 'Đối thủ đã chốt – hãy kiểm tra và Chốt điểm' : t;
        ctx.ui.status(t, 'warn'); return;
      }
      var who = NAMES[S.turn];
      if (mode === 'local') ctx.ui.status('Lượt của ' + who, 'info');
      else if (mode === 'ai') ctx.ui.status(S.turn === mySide ? 'Lượt của bạn (' + who + ')' : 'AI đang nghĩ…', S.turn === mySide ? 'good' : 'info');
      else ctx.ui.status(S.turn === mySide ? 'Lượt của bạn (' + who + ')' : 'Chờ đối thủ (' + who + ')…', S.turn === mySide ? 'good' : 'info');
    }
    function setToolbar() {
      var items = [];
      if (phase === 'score') {
        items.push({ id: 'final', label: myFinal ? 'Đã chốt' : 'Chốt điểm', primary: true, onClick: doFinal, disabled: ended || myFinal });
        items.push({ id: 'resume', label: 'Tiếp tục đánh', onClick: doResume, disabled: ended });
      } else {
        items.push({ id: 'pass', label: 'Bỏ lượt', onClick: doPass, disabled: !myTurn() });
      }
      if (mode !== 'online') items.push({ id: 'undo', label: 'Đi lại', onClick: undo, disabled: !history.length || (mode === 'ai' && !canUndoAi()) });
      items.push({ id: 'resign', label: 'Đầu hàng', onClick: resign, disabled: ended });
      ctx.ui.toolbar(items);
    }
    function canUndoAi() {
      for (var k = history.length - 1; k >= 0; k--) if (history[k].turn === mySide) return true;
      return false;
    }

    function finish(title, text, tone) {
      ended = true; setToolbar();
      ctx.ui.status(title, tone === 'win' ? 'good' : tone === 'lose' ? 'bad' : 'warn');
      ctx.ui.result({ title: title, text: text, tone: tone });
    }
    function finishScore() {
      var sc = E.score(S, deadList());
      var w = sc.winner, margin = Math.abs(sc.diff);
      var txt = 'Đen ' + sc.black + ' – Trắng ' + sc.white + ' + komi ' + fmt(sc.komi) + ' = ' + fmt(sc.whiteTotal) + ' (hơn ' + fmt(margin) + ' điểm)';
      if (mode === 'local') finish(NAMES[w] + ' thắng!', txt, 'win');
      else if (w === mySide) finish('Bạn thắng!', txt, 'win');
      else finish('Bạn thua', txt, 'lose');
    }

    function enterScore() {
      phase = 'score'; dead = {}; myFinal = false; oppFinal = false; hover = -1;
      thinking = false; clearTimeout(aiTimer); aiTimer = null;
      render(); setStatus(); setToolbar();
      ctx.ui.toast && ctx.ui.toast('Hai bên đã bỏ lượt – chuyển sang chấm điểm');
    }
    function afterAction() {
      render();
      if (E.isOver(S)) { enterScore(); return; }
      setStatus(); setToolbar();
      if (mode === 'ai' && S.turn === 1 - mySide) scheduleAI();
    }

    function snap() { history.push(E.clone(S)); }

    function doMove(idx) {
      var res = E.tryMove(S, idx);
      if (!res.ok) return res;
      snap();
      var r = E.play(S, idx);
      ctx.sound.play(r.captured.length ? 'capture' : 'place');
      return r;
    }
    function doPassState() { snap(); return E.pass(S); }

    function onTap(i) {
      if (phase === 'score') { toggleDead(i); return; }
      if (!myTurn()) return;
      var res = doMove(i);
      if (!res.ok) {
        ctx.sound.play('error');
        var msg = res.reason === 'suicide' ? 'Nước tự sát không được phép' : res.reason === 'ko' ? 'Luật Ko: không được lặp lại thế cờ cũ' : null;
        if (msg && ctx.ui.toast) ctx.ui.toast(msg);
        return;
      }
      if (mode === 'online') ctx.net.send({ t: 'move', r: (i / N) | 0, c: i % N });
      afterAction();
    }

    function doPass() {
      if (!myTurn()) return;
      doPassState(); ctx.sound.play('click');
      if (mode === 'online') ctx.net.send({ t: 'pass' });
      afterAction();
    }

    function toggleDead(i) {
      if (ended || !S.board[i]) return;
      var g = E.group(S.board, N, i), on = !dead[i];
      g.stones.forEach(function (x) { if (on) dead[x] = 1; else delete dead[x]; });
      myFinal = false; oppFinal = false;
      ctx.sound.play('select');
      if (mode === 'online') ctx.net.send({ t: 'dead', list: deadList() });
      render(); setStatus(); setToolbar();
    }
    function doFinal() {
      if (phase !== 'score' || ended || myFinal) return;
      myFinal = true;
      if (mode === 'online') {
        ctx.net.send({ t: 'final', list: deadList() });
        if (oppFinal) { finishScore(); return; }
        setStatus(); setToolbar(); return;
      }
      finishScore();
    }
    function doResume() {
      if (phase !== 'score' || ended) return;
      if (mode === 'online') ctx.net.send({ t: 'resume' });
      applyResume();
    }
    function applyResume() {
      if (phase !== 'score') return;
      phase = 'play'; dead = {}; myFinal = false; oppFinal = false; S.passes = 0;
      render(); setStatus(); setToolbar();
      if (mode === 'ai' && S.turn === 1 - mySide) scheduleAI();
    }

    function scheduleAI() {
      clearTimeout(aiTimer);
      thinking = true; setStatus(); setToolbar();
      var g = gen;
      aiTimer = setTimeout(function () {
        aiTimer = null;
        if (destroyed || g !== gen) return;
        var idx = E.aiMove(S, level, { timeMs: 1000 });
        thinking = false;
        if (idx < 0 || !E.tryMove(S, idx).ok) {
          doPassState();
          ctx.ui.toast && ctx.ui.toast('AI bỏ lượt');
        } else doMove(idx);
        afterAction();
      }, 60);
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
      if (mode === 'online' || !history.length) return;
      clearTimeout(aiTimer); aiTimer = null; thinking = false; gen++;
      ended = false;
      S = history.pop();
      if (mode === 'ai') while (S.turn !== mySide && history.length) S = history.pop();
      phase = 'play'; dead = {}; myFinal = false; oppFinal = false; hover = -1;
      render(); setStatus(); setToolbar();
      if (mode === 'ai' && S.turn === 1 - mySide) scheduleAI();
    }

    function resign() {
      if (ended) return;
      ctx.ui.confirm('Bạn chắc chắn muốn đầu hàng?').then(function (ok) {
        if (!ok || destroyed || ended) return;
        if (mode === 'online') { ctx.net.send({ t: 'resign' }); finish('Bạn đã đầu hàng', 'Đối thủ thắng ván này.', 'lose'); }
        else if (mode === 'ai') { gen++; clearTimeout(aiTimer); thinking = false; finish('Bạn đã đầu hàng', 'AI thắng ván này.', 'lose'); }
        else {
          var loser = phase === 'score' ? S.turn : S.turn;
          finish(NAMES[1 - loser] + ' thắng!', NAMES[loser] + ' đã đầu hàng.', 'win');
        }
      });
    }

    function onNet(m) {
      if (destroyed || ended || !m) return;
      if (m.t === 'resign') { finish('Đối thủ đầu hàng', 'Bạn thắng ván này!', 'win'); return; }
      if (m.t === 'move') {
        if (phase !== 'play' || S.turn === mySide) return;
        if (!Number.isInteger(m.r) || !Number.isInteger(m.c) || m.r < 0 || m.c < 0 || m.r >= N || m.c >= N) return;
        if (!doMove(m.r * N + m.c).ok) return;
        afterAction();
      } else if (m.t === 'pass') {
        if (phase !== 'play' || S.turn === mySide) return;
        doPassState(); ctx.sound.play('click'); afterAction();
      } else if (m.t === 'dead' || m.t === 'final') {
        if (phase !== 'score' || !Array.isArray(m.list)) return;
        var nd = {};
        for (var k = 0; k < m.list.length; k++) {
          var x = m.list[k];
          if (Number.isInteger(x) && x >= 0 && x < N * N && S.board[x]) nd[x] = 1;
        }
        var same = JSON.stringify(Object.keys(nd).map(Number).sort(function (a, b) { return a - b; })) === JSON.stringify(deadList());
        if (!same) { dead = nd; myFinal = false; oppFinal = false; }
        if (m.t === 'final') {
          oppFinal = true;
          if (myFinal) { render(); finishScore(); return; }
        }
        render(); setStatus(); setToolbar();
      } else if (m.t === 'resume') applyResume();
    }
    if (mode === 'online' && ctx.net) unsub = ctx.net.onMessage(onNet);

    function restart() {
      gen++; clearTimeout(aiTimer); aiTimer = null; thinking = false; ended = false; hover = -1;
      mySide = (mode === 'local') ? null : (ctx.mySide == null ? 0 : ctx.mySide);
      S = E.newGame(N); history = []; phase = 'play'; dead = {}; myFinal = false; oppFinal = false;
      render(); setStatus(); setToolbar();
      if (mode === 'ai' && S.turn === 1 - mySide) scheduleAI();
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
    id: 'go', name: 'Cờ vây', tagline: 'Vây đất, bắt quân, chấm điểm', players: 2, sides: ['Đen', 'Trắng'],
    options: [
      { key: 'size', label: 'Cỡ bàn', choices: [{ v: 9, l: '9×9' }, { v: 13, l: '13×13' }, { v: 19, l: '19×19' }], default: 9 },
      { key: 'level', label: 'Độ khó', modes: ['ai'], choices: [{ v: 1, l: 'Dễ' }, { v: 2, l: 'Vừa' }, { v: 3, l: 'Khó' }], default: 2 }
    ],
    create: create
  });
})();
