/* Cờ tướng – UI. Cần XiangqiEngine (js/engines/xiangqi-engine.js). */
(function () {
  var E = window.XiangqiEngine;
  var NS = 'http://www.w3.org/2000/svg';
  var CELL = 56, MX = 40, MY = 40, VW = 8 * CELL + 2 * MX, VH = 9 * CELL + 2 * MY;
  var RED = '#c9484f', BLK = '#2f4a66', LINE = '#5b86b3';
  var CH = [['', '帥', '仕', '相', '傌', '俥', '炮', '兵'], ['', '將', '士', '象', '馬', '車', '砲', '卒']];
  var NAMES = ['Đỏ', 'Đen'];
  var FONT = '"Noto Serif CJK SC","Songti SC","SimSun","Microsoft YaHei",serif';

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function create(root, ctx) {
    var level = (ctx.opts && +ctx.opts.level) || 2;
    var G = null, sel = -1, targets = [], over = false, thinking = false, aiTimer = null, destroyed = false;
    var drag = null, ghost = null, peerLeft = false, unsub = null, resultShown = false;
    var svg, histEl, capEls = [], sideTitles = [], undoBusy = false;

    root.innerHTML = '';
    root.classList.add('g-xiangqi');
    var wrap = el('div', 'xq-wrap', root);
    var box = el('div', 'xq-boardbox', wrap);
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
    svg.setAttribute('class', 'xq-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Bàn cờ tướng');
    box.appendChild(svg);
    var side = el('div', 'xq-side', wrap);
    var c1 = el('div', 'xq-card', side);
    var h1 = el('h4', '', c1); h1.textContent = 'Quân bị ăn';
    for (var s = 0; s < 2; s++) {
      var row = el('div', 'row', c1); row.style.cssText = 'gap:6px;align-items:center;margin-top:4px';
      var lb = el('span', 'muted', row); lb.style.cssText = 'font-size:12px;min-width:54px';
      lb.textContent = NAMES[s] + ' ăn:';
      capEls.push(el('div', 'xq-cap', row));
    }
    var c2 = el('div', 'xq-card', side);
    var h2 = el('h4', '', c2); h2.textContent = 'Lịch sử nước đi';
    histEl = el('ol', 'xq-hist', c2);

    function flipped() { return ctx.mode !== 'local' && ctx.mySide === 1; }
    function pt(r, c) { // ô → toạ độ SVG (đã xoay nếu cần)
      if (flipped()) { r = 9 - r; c = 8 - c; }
      return { x: MX + c * CELL, y: MY + r * CELL };
    }
    function mySide() { return ctx.mySide == null ? null : ctx.mySide; }
    function canAct() {
      if (!G || over || thinking || peerLeft) return false;
      if (ctx.mode === 'local') return true;
      return G.pos.turn === mySide();
    }

    /* ---------- vẽ ---------- */
    function line(a, b, w) {
      var p = pt(a[0], a[1]), q = pt(b[0], b[1]);
      return '<line x1="' + p.x + '" y1="' + p.y + '" x2="' + q.x + '" y2="' + q.y + '" stroke="' + LINE + '" stroke-width="' + (w || 1.4) + '" stroke-linecap="round"/>';
    }
    function marks(r, c) { // dấu góc ở vị trí pháo/tốt
      var out = '', p = pt(r, c), d = 5, l = 10;
      var xs = [], k;
      if (c > 0) xs.push(-1);
      if (c < 8) xs.push(1);
      for (k = 0; k < xs.length; k++) for (var v = -1; v <= 1; v += 2) {
        var sx = xs[k], sy = v;
        var fx = flipped() ? -sx : sx, fy = flipped() ? -sy : sy; // đối xứng nên không đổi hình
        out += '<path d="M' + (p.x + fx * (d + l)) + ' ' + (p.y + fy * d) + ' L' + (p.x + fx * d) + ' ' + (p.y + fy * d) +
          ' L' + (p.x + fx * d) + ' ' + (p.y + fy * (d + l)) + '" fill="none" stroke="' + LINE + '" stroke-width="1.2"/>';
      }
      return out;
    }
    function boardSVG() {
      var h = '', r, c, a, b;
      h += '<rect x="6" y="6" width="' + (VW - 12) + '" height="' + (VH - 12) + '" rx="8" fill="none" stroke="#a9c4e0" stroke-width="1"/>';
      for (r = 0; r < 10; r++) h += line([r, 0], [r, 8], (r === 0 || r === 9) ? 2.4 : 1.4);
      for (c = 0; c < 9; c++) {
        if (c === 0 || c === 8) h += line([0, c], [9, c], 2.4);
        else { h += line([0, c], [4, c]); h += line([5, c], [9, c]); }
      }
      h += line([0, 3], [2, 5]) + line([0, 5], [2, 3]) + line([7, 3], [9, 5]) + line([7, 5], [9, 3]);
      var mk = [[2, 1], [2, 7], [7, 1], [7, 7], [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]];
      for (var i = 0; i < mk.length; i++) h += marks(mk[i][0], mk[i][1]);
      var ry = MY + 4.5 * CELL;
      h += '<g class="xq-river" fill="' + LINE + '" font-size="26" text-anchor="middle" dominant-baseline="central" opacity=".85">' +
        '<text x="' + (MX + 2 * CELL) + '" y="' + ry + '" letter-spacing="6">楚河</text>' +
        '<text x="' + (MX + 6 * CELL) + '" y="' + ry + '" letter-spacing="6">漢界</text></g>';
      return h;
    }
    function pieceSVG(p, x, y, sq, cls) {
      var sd = p >> 3, col = sd ? BLK : RED;
      return '<g class="xq-piece' + (cls ? ' ' + cls : '') + '" data-sq="' + sq + '" transform="translate(' + x + ',' + y + ')">' +
        '<circle r="24" cx="0" cy="1.5" fill="rgba(60,100,150,.22)"/>' +
        '<circle r="24" fill="#fbf3dc" stroke="' + col + '" stroke-width="2"/>' +
        '<circle r="19.5" fill="none" stroke="' + col + '" stroke-width="1" opacity=".75"/>' +
        '<text y="1.5" fill="' + col + '" font-size="26" text-anchor="middle" dominant-baseline="central" font-family=\'' + FONT + '\'>' +
        CH[sd][p & 7] + '</text></g>';
    }
    function render() {
      var h = '<rect x="0" y="0" width="' + VW + '" height="' + VH + '" fill="#f1f8ff"/>' + boardSVG();
      var recs = G.records, last = recs.length ? recs[recs.length - 1] : null, p, q, sq;
      if (last) {
        p = pt(E.ROW[last.from], E.COL[last.from]); q = pt(E.ROW[last.to], E.COL[last.to]);
        h += '<rect x="' + (p.x - 25) + '" y="' + (p.y - 25) + '" width="50" height="50" rx="6" fill="rgba(90,165,232,.18)" stroke="#5aa5e8" stroke-width="1.5" stroke-dasharray="4 3"/>';
        h += '<rect x="' + (q.x - 27) + '" y="' + (q.y - 27) + '" width="54" height="54" rx="8" fill="rgba(90,165,232,.22)" stroke="#3d8ad0" stroke-width="2.5"/>';
      }
      var chk = !over && G.inCheck() ? G.pos.kp[G.pos.turn] : (over && G.inCheck() ? G.pos.kp[G.pos.turn] : -1);
      if (chk >= 0) {
        p = pt(E.ROW[chk], E.COL[chk]);
        h += '<circle cx="' + p.x + '" cy="' + p.y + '" r="31" fill="rgba(217,98,106,.35)" stroke="#d9626a" stroke-width="3"/>';
      }
      if (sel >= 0) {
        p = pt(E.ROW[sel], E.COL[sel]);
        h += '<circle cx="' + p.x + '" cy="' + p.y + '" r="30" fill="rgba(90,165,232,.3)" stroke="#3d8ad0" stroke-width="3"/>';
      }
      for (sq = 0; sq < 90; sq++) if (G.pos.b[sq]) {
        p = pt(E.ROW[sq], E.COL[sq]);
        h += pieceSVG(G.pos.b[sq], p.x, p.y, sq, sq === sel ? 'sel' : '');
      }
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i]; p = pt(E.ROW[t], E.COL[t]);
        if (G.pos.b[t]) h += '<circle cx="' + p.x + '" cy="' + p.y + '" r="28" fill="none" stroke="#d9626a" stroke-width="3.5" stroke-dasharray="7 4"/>';
        else h += '<circle cx="' + p.x + '" cy="' + p.y + '" r="8" fill="#3d8ad0" opacity=".65"/>';
      }
      svg.innerHTML = h;
      ghost = null;
      renderPanel();
      renderToolbar();
    }
    function fileOf(sd, c) { return sd ? c + 1 : 9 - c; }
    function describe(rec) {
      var t = rec.piece & 7, sd = rec.side, fr = E.ROW[rec.from], fc = E.COL[rec.from], tr = E.ROW[rec.to], tc = E.COL[rec.to];
      var fwd = sd === 0 ? fr - tr : tr - fr, s = CH[sd][t] + fileOf(sd, fc) + ' ';
      var dir = fwd > 0 ? 'tiến' : fwd < 0 ? 'lùi' : 'ngang';
      var straight = t === E.K || t === E.R || t === E.C || t === E.P;
      var n = (straight && fwd !== 0) ? Math.abs(fwd) : fileOf(sd, tc);
      s += dir + ' ' + n;
      if (rec.captured) s += ' ×';
      if (rec.check) s += ' +';
      return s;
    }
    function renderPanel() {
      var recs = G.records, i, h = '';
      for (i = 0; i < recs.length; i++) {
        h += '<li' + (i === recs.length - 1 ? ' class="last"' : '') + '><span class="n">' + (i + 1) + '.</span><span class="dot ' + (recs[i].side ? 'b' : 'r') + '"></span><span>' + describe(recs[i]) + '</span></li>';
      }
      histEl.innerHTML = h || '<li class="xq-empty">Chưa có nước đi</li>';
      histEl.scrollTop = histEl.scrollHeight;
      var caps = [[], []];
      for (i = 0; i < recs.length; i++) if (recs[i].captured) caps[recs[i].side].push(recs[i].captured);
      for (var s = 0; s < 2; s++) {
        var x = '';
        for (i = 0; i < caps[s].length; i++) x += '<span class="xq-cp ' + ((caps[s][i] >> 3) ? 'b' : 'r') + '">' + CH[caps[s][i] >> 3][caps[s][i] & 7] + '</span>';
        capEls[s].innerHTML = x || '<span class="muted">–</span>';
      }
    }
    function renderToolbar() {
      var items = [];
      if (ctx.mode !== 'online') items.push({ id: 'undo', label: 'Đi lại', onClick: undo, disabled: !canUndo() });
      items.push({ id: 'resign', label: 'Đầu hàng', onClick: resign, disabled: over || peerLeft });
      ctx.ui.toolbar(items);
    }
    function setStatus() {
      var tn = G.pos.turn, chk = G.inCheck(), txt, tone = 'info';
      if (ctx.mode === 'local') txt = 'Lượt của ' + NAMES[tn];
      else if (tn === mySide()) txt = 'Lượt của bạn (' + NAMES[tn] + ')';
      else txt = ctx.mode === 'ai' ? 'Máy đang nghĩ… (' + NAMES[tn] + ')' : 'Chờ đối thủ (' + NAMES[tn] + ')';
      if (chk) { txt += ' – Chiếu tướng!'; tone = 'warn'; }
      ctx.ui.status(txt, tone);
    }

    /* ---------- luật / kết thúc ---------- */
    function finish(winner, title, text) {
      if (resultShown) return;
      over = true; resultShown = true; sel = -1; targets = [];
      var tone;
      if (winner == null) tone = 'draw';
      else if (ctx.mode === 'local') tone = 'win';
      else tone = winner === mySide() ? 'win' : 'lose';
      render();
      ctx.ui.status(title, tone === 'lose' ? 'bad' : tone === 'win' ? 'good' : 'info');
      ctx.ui.result({ title: title, text: text, tone: tone });
    }
    function checkEnd() {
      var st = G.status();
      if (!st.over) return false;
      if (st.result === 'draw') {
        finish(null, 'Hoà cờ', st.reason === 'repetition' ? 'Thế cờ lặp lại 3 lần.' : '60 nước liên tiếp không ăn quân.');
      } else {
        var w = st.winner;
        var title = ctx.mode === 'local' ? NAMES[w] + ' thắng!' : (w === mySide() ? 'Bạn thắng!' : 'Bạn thua');
        finish(w, title, (st.reason === 'checkmate' ? 'Chiếu bí! ' : 'Hết nước đi! ') + NAMES[w ^ 1] + ' không còn nước hợp lệ.');
      }
      return true;
    }
    function afterMove(rec) {
      sel = -1; targets = [];
      ctx.sound.play(rec.check ? 'check' : rec.captured ? 'capture' : 'move');
      var ended = checkEnd();
      if (!ended) { render(); setStatus(); maybeAI(); }
    }
    function doMove(from, to, remote) {
      var rec = G.play(from, to);
      if (!rec) return null;
      if (!remote && ctx.mode === 'online') ctx.net.send({ t: 'move', from: from, to: to });
      afterMove(rec);
      return rec;
    }

    /* ---------- AI ---------- */
    function maybeAI() {
      if (ctx.mode !== 'ai' || over || G.pos.turn === mySide()) return;
      thinking = true;
      renderToolbar();
      aiTimer = setTimeout(function () {
        aiTimer = null;
        if (destroyed || !thinking) return;
        var mv = null;
        try { mv = E.bestMove(G.pos, level); } catch (e) { mv = null; }
        thinking = false;
        if (!mv) { checkEnd(); return; }
        if (!doMove(mv.from, mv.to, true)) { var lm = G.legalMoves(); if (lm.length) doMove(lm[0] & 127, lm[0] >> 7, true); }
      }, 60);
    }
    function cancelAI() {
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
      thinking = false;
    }

    /* ---------- toolbar actions ---------- */
    function canUndo() {
      if (over || ctx.mode === 'online' || !G.records.length) return false;
      if (ctx.mode === 'local') return true;
      for (var i = G.records.length - 1; i >= 0; i--) if (G.records[i].side === mySide()) return true;
      return false;
    }
    function undo() {
      if (!canUndo()) return;
      cancelAI();
      if (ctx.mode === 'local') G.undo();
      else {
        while (G.records.length) { var r = G.undo(); if (r.side === mySide()) break; }
      }
      sel = -1; targets = [];
      ctx.sound.play('click');
      render(); setStatus();
      if (ctx.mode === 'ai') maybeAI();
    }
    function resign() {
      if (over || !G) return;
      Promise.resolve(ctx.ui.confirm('Bạn chắc chắn muốn đầu hàng?')).then(function (ok) {
        if (!ok || destroyed || over) return;
        var loser = ctx.mode === 'local' ? G.pos.turn : mySide();
        if (ctx.mode === 'online') ctx.net.send({ t: 'resign' });
        cancelAI();
        finish(loser ^ 1, ctx.mode === 'local' ? NAMES[loser ^ 1] + ' thắng!' : 'Bạn đã đầu hàng', NAMES[loser] + ' đầu hàng.');
      });
    }

    /* ---------- nhập liệu ---------- */
    function sqAt(e) {
      var rect = svg.getBoundingClientRect();
      if (!rect.width) return { sq: -1 };
      var x = (e.clientX - rect.left) * VW / rect.width, y = (e.clientY - rect.top) * VH / rect.height;
      var c = Math.round((x - MX) / CELL), r = Math.round((y - MY) / CELL);
      if (flipped()) { r = 9 - r; c = 8 - c; }
      var ok = r >= 0 && r <= 9 && c >= 0 && c <= 8;
      return { sq: ok ? r * 9 + c : -1, x: x, y: y };
    }
    function select(sq) {
      sel = sq; targets = G.movesFrom(sq);
      ctx.sound.play('select');
      render();
    }
    function ownPiece(sq) { var p = G.pos.b[sq]; return p && (p >> 3) === G.pos.turn; }
    function onDown(e) {
      if (e.button && e.button !== 0) return;
      if (!canAct()) return;
      var h = sqAt(e), sq = h.sq;
      if (sq < 0) return;
      if (sel >= 0 && targets.indexOf(sq) >= 0) { var f = sel; doMove(f, sq, false); return; }
      if (ownPiece(sq)) {
        var was = sel === sq;
        if (!was) select(sq);
        drag = { sq: sq, x0: e.clientX, y0: e.clientY, was: was, active: false, id: e.pointerId };
        try { if (e.pointerId != null) svg.setPointerCapture(e.pointerId); } catch (x) {}
      } else if (sel >= 0) {
        ctx.sound.play('error'); sel = -1; targets = []; render();
      }
    }
    function onMove(e) {
      if (!drag) return;
      if (!drag.active) {
        if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 7) return;
        var orig = svg.querySelector('.xq-piece[data-sq="' + drag.sq + '"]');
        if (!orig) { drag = null; return; }
        drag.active = true;
        ghost = orig.cloneNode(true);
        ghost.setAttribute('class', 'xq-ghost');
        orig.setAttribute('opacity', '0.35');
        svg.appendChild(ghost);
      }
      var h = sqAt(e);
      if (ghost && h.x != null) ghost.setAttribute('transform', 'translate(' + h.x + ',' + h.y + ') scale(1.12)');
    }
    function onUp(e) {
      if (!drag) return;
      var d = drag; drag = null;
      try { if (e.pointerId != null) svg.releasePointerCapture(e.pointerId); } catch (x) {}
      if (d.active) {
        var sq = sqAt(e).sq;
        if (sq >= 0 && sq !== d.sq && targets.indexOf(sq) >= 0) { doMove(d.sq, sq, false); return; }
        if (sq >= 0 && sq !== d.sq) ctx.sound.play('error');
        render();
      } else if (d.was) { sel = -1; targets = []; render(); }
    }
    function onCancel() { if (drag) { drag = null; render(); } }
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onCancel);

    /* ---------- online ---------- */
    function onNet(m) {
      if (!m || destroyed) return;
      if (m.t === 'move') {
        if (over || G.pos.turn === mySide() || typeof m.from !== 'number' || typeof m.to !== 'number') return;
        if (!doMove(m.from | 0, m.to | 0, true)) ctx.ui.toast('Nhận được nước đi không hợp lệ');
      } else if (m.t === 'resign') {
        if (over) return;
        finish(mySide(), 'Đối thủ đầu hàng', 'Bạn thắng!');
      }
    }
    if (ctx.mode === 'online' && ctx.net) unsub = ctx.net.onMessage(onNet);

    /* ---------- vòng đời ---------- */
    function start() {
      cancelAI();
      G = E.newGame();
      sel = -1; targets = []; over = false; peerLeft = false; resultShown = false; drag = null;
      level = (ctx.opts && +ctx.opts.level) || level;
      render(); setStatus(); maybeAI();
    }
    start();

    return {
      restart: start,
      destroy: function () {
        destroyed = true; cancelAI();
        if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
        svg.removeEventListener('pointerdown', onDown);
        svg.removeEventListener('pointermove', onMove);
        svg.removeEventListener('pointerup', onUp);
        svg.removeEventListener('pointercancel', onCancel);
        root.innerHTML = ''; root.classList.remove('g-xiangqi');
      },
      onPeerLeft: function () {
        if (over) return;
        peerLeft = true; sel = -1; targets = [];
        ctx.ui.status('Đối thủ đã thoát khỏi phòng', 'warn');
        ctx.ui.toast && ctx.ui.toast('Đối thủ đã thoát');
        render();
      }
    };
  }

  window.Games = window.Games || {};
  Games.register({
    id: 'xiangqi', name: 'Cờ tướng', tagline: 'Cờ truyền thống 9×10 với sông Sở – Hán', players: 2,
    sides: ['Đỏ', 'Đen'],
    options: [{ key: 'level', label: 'Độ khó', modes: ['ai'], choices: [{ v: 1, l: 'Dễ' }, { v: 2, l: 'Vừa' }, { v: 3, l: 'Khó' }], default: 2 }],
    create: create
  });
})();
