/* Cờ vua – UI. Cần ChessEngine (js/engines/chess-engine.js). */
(function () {
  var E = window.ChessEngine;
  var NAMES = ['Trắng', 'Đen'];
  var GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  var PVAL = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };
  var PROMO = [['q', 5], ['r', 4], ['b', 3], ['n', 2]];
  var REASON = {
    checkmate: 'Chiếu hết!',
    stalemate: 'Hết nước đi – hoà cờ',
    insufficient: 'Không đủ quân để chiếu hết – hoà cờ',
    fifty: 'Luật 50 nước – hoà cờ',
    repetition: 'Lặp lại thế cờ 3 lần – hoà cờ'
  };

  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function glyph(v) { return GLYPH[v & 7] + '︎'; }

  function create(root, ctx) {
    var mode = ctx.mode;
    var pos, recs, lastMove, sel, targets, over, thinking, promoPending, gen = 0, aiTimer = null, destroyed = false;
    var mySide = 0, level = 2, flipped = false, drag = null, unsub = null;
    var sqEls = [];

    root.innerHTML = '';
    root.classList.add('g-chess');
    var wrap = el('div', 'ch-wrap', root);
    var main = el('div', 'ch-main', wrap);
    var topStrip = el('div', 'ch-strip', main);
    var boardBox = el('div', 'ch-boardbox', main);
    var boardEl = el('div', 'ch-board', boardBox);
    var botStrip = el('div', 'ch-strip', main);
    var side = el('div', 'ch-side panel', wrap);
    var sideTitle = el('div', 'ch-side-title', side); sideTitle.textContent = 'Lịch sử nước đi';
    var histEl = el('div', 'ch-hist', side);
    boardEl.setAttribute('role', 'grid');
    boardEl.style.touchAction = 'none';
    for (var i = 0; i < 64; i++) {
      var d = el('div', 'ch-sq ' + ((((i >> 3) + (i & 7)) & 1) ? 'dk' : 'lt'), boardEl);
      sqEls.push(d);
    }
    var promoEl = null;

    // ---------- trạng thái ----------
    function aiSide() { return mode === 'ai' ? 1 - mySide : -1; }
    function myTurn() {
      if (mode === 'local') return true;
      return pos.turn === mySide;
    }
    function canAct() { return !destroyed && !over && !thinking && !promoPending && myTurn(); }

    function restart() {
      gen++; clearTimeout(aiTimer); aiTimer = null; thinking = false;
      mySide = (mode === 'local') ? 0 : (ctx.mySide === 1 ? 1 : 0);
      level = (ctx.opts && +ctx.opts.level) || 2;
      flipped = mode !== 'local' && mySide === 1;
      pos = E.create(); recs = []; lastMove = null; sel = -1; targets = []; over = false; promoPending = null;
      closePromo(); endDrag();
      render();
      maybeAI();
    }

    // ---------- render ----------
    function sqOfView(vi) {
      var r = vi >> 3, c = vi & 7;
      return flipped ? (7 - r) * 8 + (7 - c) : r * 8 + c;
    }
    function render() {
      var chk = pos.inCheck(), ks = chk ? pos.king[pos.turn] : -1;
      var tmap = {};
      for (var t = 0; t < targets.length; t++) tmap[targets[t].to] = targets[t].cap;
      for (var vi = 0; vi < 64; vi++) {
        var sq = sqOfView(vi), e = sqEls[vi], v = pos.board[sq];
        var cls = 'ch-sq ' + ((((sq >> 3) + (sq & 7)) & 1) ? 'dk' : 'lt');
        if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cls += ' last';
        if (sq === sel) cls += ' sel';
        if (sq === ks) cls += ' chk';
        if (tmap.hasOwnProperty(sq)) cls += tmap[sq] ? ' tgt cap' : ' tgt';
        e.className = cls;
        e.setAttribute('data-sq', sq);
        var h = '';
        if (v) h += '<span class="ch-p ' + ((v >> 3) ? 'b' : 'w') + (drag && drag.moved && drag.from === sq ? ' ghosted' : '') + '">' + glyph(v) + '</span>';
        var vr = vi >> 3, vc = vi & 7;
        if (vc === 0) h += '<i class="ch-rk">' + (8 - (sq >> 3)) + '</i>';
        if (vr === 7) h += '<i class="ch-fl">' + String.fromCharCode(97 + (sq & 7)) + '</i>';
        e.innerHTML = h;
      }
      renderStrips(); renderHist(); updateUI();
    }

    function playerLabel(c) {
      var s = NAMES[c];
      if (mode === 'ai') s += c === mySide ? ' (Bạn)' : ' (Máy)';
      else if (mode === 'online') s += c === mySide ? ' (Bạn)' : ' (Đối thủ)';
      return s;
    }
    function renderStrips() {
      var topC = flipped ? 0 : 1, botC = 1 - topC, mat = [0, 0], lists = [[], []], i;
      for (i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.cap) { lists[r.by].push(r.cap & 7); mat[r.by] += PVAL[r.cap & 7]; }
      }
      function fill(strip, c) {
        lists[c].sort(function (a, b) { return PVAL[b] - PVAL[a]; });
        var h = '<span class="ch-who"><span class="ch-dot ' + (c ? 'b' : 'w') + '"></span>' + playerLabel(c) + '</span><span class="ch-caps">';
        for (var k = 0; k < lists[c].length; k++) h += '<span class="ch-p ' + (c ? 'w' : 'b') + '">' + GLYPH[lists[c][k]] + '︎</span>';
        h += '</span>';
        var adv = mat[c] - mat[1 - c];
        if (adv > 0) h += '<span class="ch-adv">+' + adv + '</span>';
        strip.innerHTML = h;
      }
      fill(topStrip, topC); fill(botStrip, botC);
    }
    function renderHist() {
      var h = '';
      for (var i = 0; i < recs.length; i += 2) {
        h += '<div class="ch-mv"><span class="n">' + (i / 2 + 1) + '.</span><span class="m' + (i === recs.length - 1 ? ' cur' : '') + '">' + recs[i].san + '</span>' +
          (recs[i + 1] ? '<span class="m' + (i + 1 === recs.length - 1 ? ' cur' : '') + '">' + recs[i + 1].san + '</span>' : '<span class="m"></span>') + '</div>';
      }
      histEl.innerHTML = h || '<div class="muted ch-empty">Chưa có nước đi nào</div>';
      histEl.scrollTop = histEl.scrollHeight;
    }
    function updateUI() {
      var text, tone = 'info';
      if (over) { text = over.text; tone = over.tone; }
      else {
        var chk = pos.inCheck();
        if (mode === 'ai') text = thinking ? 'Máy đang suy nghĩ…' : 'Lượt của bạn (' + NAMES[mySide] + ')';
        else if (mode === 'online') text = myTurn() ? 'Lượt của bạn (' + NAMES[mySide] + ')' : 'Chờ đối thủ (' + NAMES[pos.turn] + ')…';
        else text = 'Lượt của ' + NAMES[pos.turn];
        if (chk) { text += ' – Chiếu!'; tone = 'warn'; }
      }
      ctx.ui.status(text, tone);
      var items = [];
      if (mode !== 'online') items.push({ id: 'undo', label: 'Đi lại', icon: '↶', onClick: undo, disabled: thinking || !recs.length || (mode === 'ai' && recs.length < 1) });
      items.push({ id: 'resign', label: 'Đầu hàng', icon: '⚑', onClick: resign, disabled: !!over || thinking });
      ctx.ui.toolbar(items);
    }

    // ---------- nước đi ----------
    function legalFrom(sq) {
      var ms = pos.legalMoves(), out = [], seen = {};
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if ((m & 63) !== sq) continue;
        var to = (m >> 6) & 63;
        if (seen[to]) continue; seen[to] = 1;
        out.push({ to: to, cap: !!((m >> 16) & 3) });
      }
      return out;
    }
    function select(sq) {
      var v = pos.board[sq];
      if (!v || (v >> 3) !== pos.turn) return false;
      var t = legalFrom(sq);
      sel = sq; targets = t;
      ctx.sound.play('select');
      return true;
    }
    function clearSel() { sel = -1; targets = []; }

    function attempt(from, to) {
      var isT = false;
      for (var i = 0; i < targets.length; i++) if (targets[i].to === to) isT = true;
      if (!isT) return false;
      if (pos.needsPromotion(from, to)) { askPromo(from, to); return true; }
      commit(pos.findMove(from, to, null), true);
      return true;
    }

    function commit(m, mine) {
      if (m < 0) return;
      var from = m & 63, to = (m >> 6) & 63, fl = m >> 16, p = pos.board[from], by = pos.turn;
      var cap = (fl & 2) ? (P_(by ^ 1)) : pos.board[to];
      var san = pos.san(m), promo = (m >> 12) & 7;
      pos.make(m);
      recs.push({ m: m, san: san, cap: cap, by: by });
      lastMove = { from: from, to: to };
      clearSel();
      if (mine && mode === 'online') {
        var pc = promo ? 'nbrq'[promo - 2] : undefined;
        var msg = { t: 'move', from: from, to: to }; if (pc) msg.promo = pc;
        ctx.net.send(msg);
      }
      var st = pos.status();
      ctx.sound.play(st.check ? 'check' : cap ? 'capture' : 'move');
      if (st.over) finish(st);
      render();
      if (!st.over) maybeAI();
    }
    function P_(c) { return 1 | (c << 3); }

    function finish(st) {
      var title = REASON[st.reason], text, tone;
      if (st.winner === null || st.winner === undefined) {
        tone = 'draw'; text = 'Ván cờ hoà.';
      } else if (mode === 'local') {
        tone = 'win'; text = NAMES[st.winner] + ' thắng!';
      } else {
        tone = st.winner === mySide ? 'win' : 'lose';
        text = tone === 'win' ? 'Bạn thắng!' : (mode === 'ai' ? 'Máy thắng.' : 'Đối thủ thắng.');
      }
      setOver(title, text, tone);
    }
    function setOver(title, text, tone) {
      over = { text: title + ' ' + text, tone: tone === 'win' ? 'good' : tone === 'lose' ? 'bad' : 'info' };
      clearSel(); closePromo();
      ctx.ui.result({ title: title, text: text, tone: tone });
    }

    // ---------- AI ----------
    function maybeAI() {
      if (mode !== 'ai' || over || pos.turn !== aiSide()) return;
      thinking = true; updateUI();
      var g = gen;
      aiTimer = setTimeout(function () {
        aiTimer = null;
        if (destroyed || g !== gen) return;
        var r = E.search(pos, { level: level });
        if (destroyed || g !== gen) return;
        thinking = false;
        if (r.move >= 0) commit(r.move, false); else render();
      }, 60);
    }

    // ---------- undo / resign ----------
    function undo() {
      if (thinking || !recs.length || mode === 'online') return;
      var n = 1;
      if (mode === 'ai') n = (recs[recs.length - 1].by === mySide) ? 1 : 2;
      if (mode === 'ai' && n > recs.length) n = recs.length;
      while (n-- > 0 && recs.length) { pos.unmake(); recs.pop(); }
      var l = recs[recs.length - 1];
      lastMove = l ? { from: l.m & 63, to: (l.m >> 6) & 63 } : null;
      over = false; clearSel(); closePromo(); gen++;
      render();
      if (mode === 'ai' && pos.turn === aiSide()) maybeAI();
    }
    function resign() {
      if (over || thinking) return;
      var who = mode === 'local' ? pos.turn : mySide;
      var q = mode === 'local' ? NAMES[who] + ' đầu hàng?' : 'Bạn muốn đầu hàng ván này?';
      ctx.ui.confirm(q).then(function (ok) {
        if (!ok || destroyed || over) return;
        if (mode === 'online') ctx.net.send({ t: 'resign' });
        if (mode === 'local') setOver('Đầu hàng', NAMES[who] + ' đầu hàng. ' + NAMES[who ^ 1] + ' thắng!', 'win');
        else setOver('Đầu hàng', 'Bạn đã đầu hàng.', 'lose');
        render();
      });
    }

    // ---------- phong cấp ----------
    function askPromo(from, to) {
      promoPending = { from: from, to: to };
      var col = pos.turn;
      closePromo();
      promoEl = el('div', 'ch-promo', boardBox);
      var box = el('div', 'ch-promo-box', promoEl);
      var t = el('div', 'ch-promo-t', box); t.textContent = 'Phong cấp thành';
      var row = el('div', 'ch-promo-row', box);
      PROMO.forEach(function (pr) {
        var b = el('button', 'ch-promo-btn', row); b.type = 'button'; b.setAttribute('data-p', pr[0]);
        b.innerHTML = '<span class="ch-p ' + (col ? 'b' : 'w') + '">' + GLYPH[pr[1]] + '︎</span>';
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var pp = promoPending; promoPending = null; closePromo();
          if (pp) commit(pos.findMove(pp.from, pp.to, pr[0]), true);
        });
      });
      promoEl.addEventListener('pointerdown', function (ev) {
        if (ev.target === promoEl) { promoPending = null; closePromo(); clearSel(); render(); }
      });
    }
    function closePromo() { if (promoEl && promoEl.parentNode) promoEl.parentNode.removeChild(promoEl); promoEl = null; }

    // ---------- nhập liệu: click + kéo thả ----------
    function sqFromEvent(ev) {
      var t = document.elementFromPoint ? document.elementFromPoint(ev.clientX, ev.clientY) : ev.target;
      while (t && t !== boardEl && !(t.getAttribute && t.getAttribute('data-sq') !== null)) t = t.parentNode;
      if (!t || t === boardEl || !t.getAttribute) return -1;
      return +t.getAttribute('data-sq');
    }
    function onDown(ev) {
      if (ev.button > 0 || promoPending) return;
      var sq = ev.target.closest ? (ev.target.closest('.ch-sq') ? +ev.target.closest('.ch-sq').getAttribute('data-sq') : -1) : sqFromEvent(ev);
      if (sq < 0) return;
      if (!canAct()) { return; }
      if (sel >= 0 && sq !== sel) {
        if (attempt(sel, sq)) return;
      }
      var v = pos.board[sq];
      if (v && (v >> 3) === pos.turn) {
        var was = sel === sq;
        select(sq);
        drag = { from: sq, x: ev.clientX, y: ev.clientY, moved: false, was: was, id: ev.pointerId, ghost: null };
        try { boardEl.setPointerCapture(ev.pointerId); } catch (e) {}
        render();
      } else {
        if (sel >= 0 && v === 0 || (v && sel >= 0)) ctx.sound.play('error');
        clearSel(); render();
      }
    }
    function onMove(ev) {
      if (!drag || (drag.id !== undefined && ev.pointerId !== drag.id)) return;
      if (!drag.moved) {
        if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 8) return;
        drag.moved = true;
        var g = el('span', 'ch-p ch-ghost ' + ((pos.board[drag.from] >> 3) ? 'b' : 'w'), document.body);
        g.textContent = glyph(pos.board[drag.from]);
        var sz = sqEls[0].getBoundingClientRect().width || 48;
        g.style.fontSize = (sz * 0.85) + 'px'; g.style.width = sz + 'px'; g.style.height = sz + 'px';
        drag.ghost = g; drag.sz = sz;
        render();
      }
      drag.ghost.style.left = (ev.clientX - drag.sz / 2) + 'px';
      drag.ghost.style.top = (ev.clientY - drag.sz / 2) + 'px';
    }
    function onUp(ev) {
      if (!drag || (drag.id !== undefined && ev.pointerId !== drag.id)) return;
      var dr = drag; endDrag();
      if (dr.moved) {
        var to = sqFromEvent(ev);
        if (to >= 0 && to !== dr.from && attempt(dr.from, to)) return;
        if (to >= 0 && to !== dr.from) ctx.sound.play('error');
        render();
      } else if (dr.was) { clearSel(); render(); }
    }
    function endDrag() {
      if (drag && drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
      drag = null;
    }
    function onCancel() { if (drag) { endDrag(); render(); } }
    boardEl.addEventListener('pointerdown', onDown);
    boardEl.addEventListener('pointermove', onMove);
    boardEl.addEventListener('pointerup', onUp);
    boardEl.addEventListener('pointercancel', onCancel);

    // ---------- online ----------
    if (mode === 'online' && ctx.net) {
      unsub = ctx.net.onMessage(function (msg) {
        if (destroyed || !msg || over) return;
        if (msg.t === 'move') {
          if (pos.turn === mySide) { return; }
          var from = +msg.from, to = +msg.to;
          if (!(from >= 0 && from < 64 && to >= 0 && to < 64)) return;
          var m = pos.findMove(from, to, msg.promo || null);
          if (m < 0) { ctx.ui.toast('Nhận được nước đi không hợp lệ từ đối thủ'); return; }
          if (drag) endDrag();
          closePromo(); promoPending = null;
          commit(m, false);
        } else if (msg.t === 'resign') {
          setOver('Đối thủ đầu hàng', 'Bạn thắng!', 'win'); render();
        }
      });
    }

    restart();
    return {
      restart: restart,
      destroy: function () {
        destroyed = true; gen++; clearTimeout(aiTimer); aiTimer = null; endDrag(); closePromo();
        if (typeof unsub === 'function') unsub();
        boardEl.removeEventListener('pointerdown', onDown);
        boardEl.removeEventListener('pointermove', onMove);
        boardEl.removeEventListener('pointerup', onUp);
        boardEl.removeEventListener('pointercancel', onCancel);
      },
      onPeerLeft: function () {
        if (!over && mode === 'online') ctx.ui.toast('Đối thủ đã rời phòng');
      }
    };
  }

  Games.register({
    id: 'chess',
    name: 'Cờ vua',
    tagline: 'Trí tuệ cổ điển 8×8',
    players: 2,
    sides: ['Trắng', 'Đen'],
    options: [
      { key: 'level', label: 'Độ khó', modes: ['ai'], choices: [{ v: 1, l: 'Dễ' }, { v: 2, l: 'Vừa' }, { v: 3, l: 'Khó' }], default: 2 }
    ],
    create: create
  });
})();
