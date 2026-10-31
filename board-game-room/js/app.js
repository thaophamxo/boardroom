/* Shell: sảnh, hộp thoại thiết lập, màn game, online, rematch. Xem docs/ARCHITECTURE.md */
(function () {
  'use strict';
  var Games = window.Games, Sound = window.Sound, Net = window.Net;
  var $app = document.getElementById('app');
  var $toasts = document.getElementById('toasts');
  var ORDER = ['chess', 'xiangqi', 'go', 'gomoku', 'sudoku', 'puzzle'];

  var ICONS = {
    chess: '♞',
    xiangqi: '將',
    go: '<svg viewBox="0 0 40 40"><circle cx="14" cy="14" r="9" fill="#2b3a4a"/><circle cx="26" cy="26" r="9" fill="#fff" stroke="#5aa5e8" stroke-width="2"/></svg>',
    gomoku: '<svg viewBox="0 0 40 40" fill="none" stroke-width="4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" stroke="#3d8ad0"/><circle cx="29" cy="29" r="8" stroke="#e57f6a"/></svg>',
    sudoku: '<svg viewBox="0 0 40 40"><rect x="3" y="3" width="34" height="34" rx="4" fill="#fff" stroke="#3d8ad0" stroke-width="2.5"/><path d="M14.5 3v34M25.5 3v34M3 14.5h34M3 25.5h34" stroke="#9cc6ee" stroke-width="1.5"/><text x="20" y="26" font-size="15" font-weight="700" text-anchor="middle" fill="#3d8ad0" font-family="sans-serif">9</text></svg>',
    puzzle: '<svg viewBox="0 0 40 40"><path d="M6 10h9a4 4 0 1 1 8 0h9v9a4 4 0 1 0 0 8v9H6z" fill="#5aa5e8" opacity=".9"/><path d="M6 10h9a4 4 0 1 1 8 0h9v9" fill="none" stroke="#fff" stroke-width="1.5" opacity=".6"/></svg>'
  };

  var cur = null;         // game đang chạy
  var modalStack = [];    // overlay đang mở
  var routeSeq = 0;

  /* ---------------- tiện ích ---------------- */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem('bgr:' + k); localStorage.setItem('bgr:' + k, v); } catch (e) { return null; }
  }
  function toast(text) {
    var t = h('div', { class: 'toast', text: text });
    $toasts.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, 2600);
  }
  function play(n) { try { Sound.play(n); } catch (e) {} }

  /* ---------------- modal ---------------- */
  function openModal(cls, kids, opts) {
    opts = opts || {};
    var ov = h('div', { class: 'overlay' });
    var m = h('div', { class: 'modal ' + (cls || ''), role: 'dialog', 'aria-modal': 'true' }, kids);
    ov.appendChild(m);
    var api = {
      el: m, overlay: ov,
      close: function () {
        if (!ov.parentNode) return;
        ov.remove();
        var i = modalStack.indexOf(api); if (i >= 0) modalStack.splice(i, 1);
        if (api.onClose) api.onClose();
      }
    };
    if (opts.dismiss !== false) ov.addEventListener('mousedown', function (e) { if (e.target === ov) api.close(); });
    document.body.appendChild(ov);
    modalStack.push(api);
    var f = m.querySelector('.btn.primary, input, .btn');
    if (f && !opts.noFocus) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
    return api;
  }
  function closeAllModals() { modalStack.slice().forEach(function (m) { m.close(); }); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalStack.length) {
      var top = modalStack[modalStack.length - 1];
      if (!top.noEsc) top.close();
    }
  });
  function confirmBox(text, okLabel) {
    return new Promise(function (resolve) {
      var done = false, m;
      function fin(v) { if (done) return; done = true; m.close(); resolve(v); }
      m = openModal('', [
        h('h2', { text: 'Xác nhận' }),
        h('p', { text: text, style: 'margin:8px 0 0' }),
        h('div', { class: 'actions' }, [
          h('button', { class: 'btn', text: 'Huỷ', onclick: function () { fin(false); } }),
          h('button', { class: 'btn primary', text: okLabel || 'Đồng ý', onclick: function () { fin(true); } })
        ])
      ]);
      m.onClose = function () { if (!done) { done = true; resolve(false); } };
    });
  }
  function segment(items, selected, onChange) {
    var wrap = h('div', { class: 'seg', role: 'group' });
    var btns = items.map(function (it, i) {
      var b = h('button', { type: 'button', text: it.l, class: i === selected ? 'on' : '' });
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on');
        play('click'); onChange(i);
      });
      wrap.appendChild(b); return b;
    });
    return wrap;
  }

  /* ---------------- sảnh ---------------- */
  function sortedGames() {
    var l = Games.list.slice();
    l.sort(function (a, b) {
      var ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return l;
  }
  function logo() {
    var d = h('div');
    d.innerHTML = '<svg class="logo" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#5aa5e8"/><circle cx="11" cy="11" r="4.5" fill="#fff"/><circle cx="21" cy="21" r="4.5" fill="#cfe5fa"/><rect x="17" y="6" width="9" height="9" rx="2" fill="none" stroke="#fff" stroke-width="2"/></svg>';
    return d.firstChild;
  }
  function soundButton() {
    var b = h('button', { class: 'btn ghost small', 'aria-label': 'Bật/tắt âm thanh' });
    function upd() { b.textContent = Sound.isMuted() ? '🔇 Tắt tiếng' : '🔊 Âm thanh'; }
    b.addEventListener('click', function () { Sound.setMuted(!Sound.isMuted()); upd(); if (!Sound.isMuted()) play('click'); });
    upd(); return b;
  }

  function renderLobby() {
    $app.innerHTML = '';
    var top = h('div', { class: 'topbar' }, [
      h('div', { class: 'brand' }, [logo(), h('span', { class: 'name', text: 'Phòng Board Game' })]),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn small', text: '🔗 Vào phòng', onclick: function () { openJoinDialog(); } }),
      soundButton()
    ]);
    var grid = h('div', { class: 'grid' });
    sortedGames().forEach(function (def) {
      var chips = def.players === 2
        ? ['2 người', 'Chơi với máy', 'Online']
        : ['1 người'];
      var ico = h('div', { class: 'ico', 'aria-hidden': 'true' });
      ico.innerHTML = ICONS[def.id] || '🎲';
      var card = h('button', { class: 'card', type: 'button', onclick: function () { play('click'); openSetup(def); } }, [
        ico,
        h('h3', { text: def.name }),
        h('div', { class: 'tag', text: def.tagline || '' }),
        h('div', { class: 'chips' }, chips.map(function (c) { return h('span', { class: 'chip', text: c }); }))
      ]);
      grid.appendChild(card);
    });
    $app.appendChild(top);
    $app.appendChild(h('div', { class: 'page' }, [
      h('div', { class: 'hero' }, [
        h('h1', { text: 'Chọn một trò chơi' }),
        h('p', { text: 'Giải trí nhẹ nhàng giữa giờ làm việc – chơi một mình, chơi với máy hoặc rủ đồng nghiệp chơi online.' })
      ]),
      grid,
      h('div', { class: 'foot', text: 'Âm thanh hiệu ứng có thể tắt ở góc trên bên phải.' })
    ]));
    document.title = 'Phòng Board Game';
  }

  /* ---------------- hộp thoại thiết lập ---------------- */
  function openSetup(def) {
    var two = def.players === 2;
    var st = {
      mode: two ? (store('mode:' + def.id) || 'ai') : 'solo',
      online: 'host',            // host | join
      side: 0, sideChoice: 'first',
      opts: {}, code: ''
    };
    if (['local', 'ai', 'online'].indexOf(st.mode) < 0 && two) st.mode = 'ai';
    (def.options || []).forEach(function (o) {
      var saved = store('opt:' + def.id + ':' + o.key), idx = -1;
      o.choices.forEach(function (c, i) { if (String(c.v) === saved) idx = i; });
      if (idx < 0) o.choices.forEach(function (c, i) { if (c.v === o.default) idx = i; });
      st.opts[o.key] = o.choices[Math.max(0, idx)].v;
    });
    var body = h('div'), m;
    var modeLabels = [{ k: 'local', l: '2 người 1 máy' }, { k: 'ai', l: 'Chơi với máy' }, { k: 'online', l: 'Online' }];

    function build() {
      body.innerHTML = '';
      var joinOnly = st.mode === 'online' && st.online === 'join';
      if (two) {
        body.appendChild(h('div', { class: 'field' }, [h('div', { class: 'lbl', text: 'Chế độ chơi' }),
          segment(modeLabels, modeLabels.map(function (x) { return x.k; }).indexOf(st.mode), function (i) { st.mode = modeLabels[i].k; build(); })]));
        if (st.mode === 'online') {
          body.appendChild(h('div', { class: 'field' }, [h('div', { class: 'lbl', text: 'Phòng' }),
            segment([{ l: 'Tạo phòng' }, { l: 'Vào phòng' }], st.online === 'host' ? 0 : 1, function (i) { st.online = i ? 'join' : 'host'; build(); })]));
        }
      }
      if (joinOnly) {
        var inp = h('input', { class: 'text', maxlength: '8', placeholder: 'MÃ PHÒNG', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: st.code });
        inp.addEventListener('input', function () { st.code = inp.value; });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
        body.appendChild(h('div', { class: 'field' }, [h('div', { class: 'lbl', text: 'Mã phòng do chủ phòng gửi' }), inp]));
        body.appendChild(h('p', { class: 'muted', style: 'font-size:13px;margin:10px 0 0', text: 'Luật chơi và bên cầm quân do chủ phòng chọn.' }));
        setTimeout(function () { try { inp.focus(); } catch (e) {} }, 30);
        return;
      }
      if (two && st.mode !== 'local') {
        var s0 = def.sides[0], s1 = def.sides[1];
        var ch = [{ k: 'first', l: s0 + ' (đi trước)' }, { k: 'second', l: s1 + ' (đi sau)' }, { k: 'random', l: 'Ngẫu nhiên' }];
        body.appendChild(h('div', { class: 'field' }, [h('div', { class: 'lbl', text: 'Bạn cầm' }),
          segment(ch, ch.map(function (x) { return x.k; }).indexOf(st.sideChoice), function (i) { st.sideChoice = ch[i].k; })]));
      }
      (def.options || []).forEach(function (o) {
        if (o.modes && o.modes.indexOf(st.mode) < 0) return;
        var sel = 0; o.choices.forEach(function (c, i) { if (c.v === st.opts[o.key]) sel = i; });
        body.appendChild(h('div', { class: 'field' }, [h('div', { class: 'lbl', text: o.label }),
          segment(o.choices, sel, function (i) { st.opts[o.key] = o.choices[i].v; store('opt:' + def.id + ':' + o.key, String(o.choices[i].v)); })]));
      });
    }
    function startLabel() {
      if (st.mode === 'online') return st.online === 'host' ? 'Tạo phòng' : 'Vào phòng';
      return 'Bắt đầu';
    }
    var goBtn = h('button', { class: 'btn primary', onclick: function () { go(); } });
    var labelObs = setInterval(function () { goBtn.textContent = startLabel(); }, 120);
    function go() {
      if (two) store('mode:' + def.id, st.mode);
      if (st.mode === 'online') {
        if (st.online === 'join') {
          var code = String(st.code || '').trim();
          if (code.replace(/[^A-Za-z0-9]/g, '').length !== 5) { toast('Mã phòng gồm 5 ký tự'); return; }
          clearInterval(labelObs); m.close(); joinRoom(code); return;
        }
        clearInterval(labelObs); m.close(); hostRoom(def, st); return;
      }
      var side = null;
      if (two && st.mode === 'ai') side = pickSide(st.sideChoice);
      clearInterval(labelObs); m.close();
      startGame(def, { mode: st.mode, opts: st.opts, mySide: side, sideChoiceRandom: two && st.mode === 'ai' && st.sideChoice === 'random' });
    }
    m = openModal('', [
      h('h2', { text: def.name }),
      h('div', { class: 'sub', text: def.tagline || '' }),
      body,
      h('div', { class: 'actions' }, [h('button', { class: 'btn', text: 'Huỷ', onclick: function () { m.close(); } }), goBtn])
    ]);
    m.onClose = function () { clearInterval(labelObs); };
    build(); goBtn.textContent = startLabel();
  }
  function pickSide(choice) { return choice === 'first' ? 0 : choice === 'second' ? 1 : (Math.random() < 0.5 ? 0 : 1); }

  /* ---------------- online: tạo / vào phòng ---------------- */
  function netErrorModal(msg) {
    var m = openModal('', [h('h2', { text: 'Không kết nối được' }), h('p', { text: msg }),
      h('div', { class: 'actions' }, [h('button', { class: 'btn primary', text: 'Đóng', onclick: function () { m.close(); } })])]);
  }
  function hostRoom(def, st) {
    var hostSide = pickSide(st.sideChoice);
    var seq = ++routeSeq, cancelled = false;
    var codeBox = h('div', { class: 'codebox', html: '<span class="spinner"></span> Đang tạo phòng…' });
    var m = openModal('', [
      h('h2', { text: 'Phòng online – ' + def.name }),
      h('div', { class: 'sub', text: 'Gửi mã (hoặc đường link) cho đối thủ để họ vào phòng.' }),
      codeBox,
      h('div', { class: 'actions' }, [h('button', { class: 'btn', text: 'Huỷ phòng', onclick: function () { m.close(); } })])
    ], { dismiss: false });
    var offOpen = null;
    m.onClose = function () {
      if (!cancelled && !started) { cancelled = true; if (offOpen) offOpen(); Net.close(); }
    };
    var started = false;
    Net.host().then(function (r) {
      if (cancelled) return;
      var link = location.origin + location.pathname + '#/join/' + r.code;
      codeBox.innerHTML = '';
      codeBox.appendChild(h('div', { class: 'code', text: r.code }));
      codeBox.appendChild(h('div', { class: 'link', text: link }));
      var cp = h('button', { class: 'btn small', style: 'margin-top:10px', text: '📋 Sao chép link', onclick: function () {
        var done = function () { toast('Đã sao chép link phòng'); };
        try { navigator.clipboard.writeText(link).then(done, function () { toast('Hãy tự sao chép mã: ' + r.code); }); } catch (e) { toast('Hãy tự sao chép mã: ' + r.code); }
      } });
      codeBox.appendChild(cp);
      codeBox.appendChild(h('div', { class: 'muted', style: 'margin-top:10px;font-size:13px', html: '<span class="spinner"></span> Đang chờ đối thủ…' }));
      offOpen = Net.onOpen(function () {
        if (seq !== routeSeq || cancelled) return;
        started = true; offOpen(); m.close();
        Net.send({ _: 'hello', game: def.id, opts: st.opts, hostSide: hostSide });
        startGame(def, { mode: 'online', opts: st.opts, mySide: hostSide, host: true, hostSide: hostSide });
      });
    }, function (err) {
      if (cancelled) return;
      cancelled = true; m.close(); netErrorModal(err.message || String(err));
    });
  }
  function openJoinDialog(prefill) {
    var inp = h('input', { class: 'text', maxlength: '8', placeholder: 'MÃ PHÒNG', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: prefill || '' });
    var m;
    function go() {
      var c = inp.value.trim();
      if (c.replace(/[^A-Za-z0-9]/g, '').length !== 5) { toast('Mã phòng gồm 5 ký tự'); return; }
      m.close(); joinRoom(c);
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    m = openModal('', [
      h('h2', { text: 'Vào phòng online' }),
      h('div', { class: 'sub', text: 'Nhập mã phòng 5 ký tự do chủ phòng gửi.' }),
      h('div', { class: 'field' }, [inp]),
      h('div', { class: 'actions' }, [h('button', { class: 'btn', text: 'Huỷ', onclick: function () { m.close(); } }), h('button', { class: 'btn primary', text: 'Vào phòng', onclick: go })])
    ]);
  }
  function joinRoom(code) {
    var seq = ++routeSeq, cancelled = false;
    var m = openModal('', [
      h('h2', { text: 'Đang vào phòng ' + String(code).toUpperCase() }),
      h('p', { html: '<span class="spinner"></span> Đang kết nối…' }),
      h('div', { class: 'actions' }, [h('button', { class: 'btn', text: 'Huỷ', onclick: function () { m.close(); } })])
    ], { dismiss: false });
    var gotHello = false, offMsg = null, offClose = null, timer = null;
    function cleanup() { if (offMsg) offMsg(); if (offClose) offClose(); clearTimeout(timer); }
    m.onClose = function () { if (!gotHello) { cancelled = true; cleanup(); Net.close(); } };
    Net.join(code).then(function () {
      if (cancelled) return;
      offMsg = Net.onMessage(function (d) {
        if (!d || d._ !== 'hello' || gotHello) return;
        var def = Games.get(d.game);
        if (!def) { cancelled = true; cleanup(); m.close(); Net.close(); netErrorModal('Trò chơi của phòng này không có trong phiên bản của bạn.'); return; }
        gotHello = true; cleanup(); m.close();
        startGame(def, { mode: 'online', opts: d.opts || {}, mySide: 1 - d.hostSide, host: false, hostSide: d.hostSide });
      });
      offClose = Net.onClose(function () {
        if (gotHello || cancelled) return;
        cancelled = true; cleanup(); m.close(); netErrorModal('Chủ phòng đã đóng phòng.');
      });
      timer = setTimeout(function () {
        if (gotHello || cancelled) return;
        cancelled = true; cleanup(); m.close(); Net.close(); netErrorModal('Chủ phòng chưa phản hồi. Hãy nhờ họ tạo lại phòng.');
      }, 10000);
    }, function (err) {
      if (cancelled || seq !== routeSeq) return;
      cancelled = true; m.close(); netErrorModal(err.message || String(err));
    });
  }

  /* ---------------- màn game ---------------- */
  function leaveGame(skipRoute) {
    if (!cur) return;
    var c = cur; cur = null;
    try { if (c.online) Net.send({ _: 'leave' }); } catch (e) {}
    c.unsubs.forEach(function (f) { try { f(); } catch (e) {} });
    try { c.inst && c.inst.destroy && c.inst.destroy(); } catch (e) { console.error(e); }
    if (c.online) Net.close();
    closeAllModals();
    if (!skipRoute && location.hash.indexOf('#/play') === 0) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
    renderLobby();
  }

  function startGame(def, cfg) {
    leaveGame(true);
    closeAllModals();
    var online = cfg.mode === 'online';
    var g = cur = {
      def: def, mode: cfg.mode, online: online, host: !!cfg.host, hostSide: cfg.hostSide,
      unsubs: [], inst: null, toolbarItems: [], wantMe: false, wantPeer: false, peerGone: false, resultModal: null
    };
    try { history.pushState(null, '', '#/play/' + def.id); } catch (e) {}

    // --- dựng khung
    $app.innerHTML = '';
    var $title = h('h2', { text: def.name });
    var netBadge = online ? h('span', { class: 'chip net-badge', text: '● Online' }) : null;
    var $status = h('div', { class: 'statusbar', text: '' });
    var $tbar = h('div', { class: 'toolbar' });
    var $root = h('div', { class: 'game-root' });
    $app.appendChild(h('div', { class: 'topbar' }, [
      h('button', { class: 'btn ghost small', text: '← Sảnh', onclick: function () { askLeave(); } }),
      $title, netBadge, h('div', { class: 'grow' }), soundButton()
    ]));
    $app.appendChild(h('div', { class: 'page' }, [$status, $tbar, $root]));
    document.title = def.name + ' – Phòng Board Game';

    function askLeave() {
      confirmBox('Rời ván đang chơi và về sảnh?', 'Về sảnh').then(function (ok) { if (ok && cur === g) leaveGame(); });
    }

    function renderToolbar() {
      $tbar.innerHTML = '';
      (g.toolbarItems || []).forEach(function (it) {
        $tbar.appendChild(h('button', {
          class: 'btn small' + (it.primary ? ' primary' : ''), disabled: !!it.disabled, id: it.id ? 'tb-' + it.id : null,
          text: (it.icon ? it.icon + ' ' : '') + it.label,
          onclick: function () { if (!it.disabled && it.onClick) it.onClick(); }
        }));
      });
      $tbar.appendChild(h('span', { class: 'sep' }));
      $tbar.appendChild(h('button', { class: 'btn small', text: online ? '↻ Chơi lại' : '↻ Ván mới', onclick: function () { newGame(); } }));
      $tbar.appendChild(h('button', { class: 'btn small ghost', text: 'Về sảnh', onclick: function () { askLeave(); } }));
    }

    // --- ctx
    var ctx = {
      mode: cfg.mode, opts: cfg.opts || {}, mySide: cfg.mySide == null ? null : cfg.mySide,
      sound: { play: play },
      ui: {
        status: function (text, tone) { $status.textContent = text || ''; $status.className = 'statusbar' + (tone && tone !== 'info' ? ' ' + tone : ''); },
        toolbar: function (items) { g.toolbarItems = items || []; renderToolbar(); },
        result: function (r) { showResult(r || {}); },
        confirm: function (t) { return confirmBox(t); },
        toast: toast
      }
    };
    if (online) {
      ctx.net = {
        send: function (obj) { return Net.send(obj); },
        onMessage: function (fn) {
          var off = Net.onMessage(function (d) { if (d && d._) return; fn(d); });
          g.unsubs.push(off); return off;
        }
      };
      g.unsubs.push(Net.onMessage(onShellMsg));
      g.unsubs.push(Net.onClose(onPeerLeft));
    }
    g.ctx = ctx;

    // --- kết quả / rematch
    function showResult(r) {
      if (g.resultModal) g.resultModal.close();
      var tone = r.tone || 'draw';
      if (g.mode !== 'solo') play(tone === 'win' ? 'win' : tone === 'lose' ? 'lose' : 'draw');
      var big = { win: '🏆', lose: '💪', draw: '🤝' }[tone] || '🎉';
      if (g.mode === 'solo') big = '🎉';
      var statusP = h('p', { class: 'muted', style: 'min-height:20px;font-size:13px' });
      g.setRematchNote = function (t) { statusP.textContent = t || ''; };
      var again = h('button', { class: 'btn primary', text: online ? 'Chơi lại' : 'Ván mới', onclick: function () {
        if (online) { requestRematch(); again.disabled = true; again.textContent = 'Đang chờ đối thủ…'; }
        else { m.close(); newGame(); }
      } });
      var m = openModal('result ' + tone, [
        h('div', { class: 'big', text: big }), h('h2', { text: r.title || 'Kết thúc' }),
        r.text ? h('p', { text: r.text }) : null, statusP,
        h('div', { class: 'actions' }, [again,
          h('button', { class: 'btn', text: 'Xem bàn cờ', onclick: function () { m.close(); } }),
          h('button', { class: 'btn ghost', text: 'Về sảnh', onclick: function () { m.close(); if (cur === g) leaveGame(); } })])
      ]);
      g.resultModal = m;
      m.onClose = function () { if (g.resultModal === m) g.resultModal = null; g.setRematchNote = null; };
      if (online && g.wantPeer) statusP.textContent = 'Đối thủ muốn chơi lại.';
      if (g.peerGone) { again.disabled = true; statusP.textContent = 'Đối thủ đã rời phòng.'; }
    }
    function requestRematch() {
      if (g.peerGone) { toast('Đối thủ đã rời phòng'); return; }
      g.wantMe = true; Net.send({ _: 'rematch' }); maybeRematch();
      toast('Đã gửi lời mời chơi lại');
    }
    function maybeRematch() {
      if (!g.wantMe || !g.wantPeer || !g.host) return;
      var hs = 1 - g.hostSide;
      Net.send({ _: 'restart', hostSide: hs });
      applyRestart(hs);
    }
    function applyRestart(hostSide) {
      g.hostSide = hostSide; g.wantMe = g.wantPeer = false;
      ctx.mySide = g.host ? hostSide : 1 - hostSide;
      if (g.resultModal) g.resultModal.close();
      toast('Ván mới – bạn cầm ' + def.sides[ctx.mySide]);
      g.inst.restart();
    }
    function onShellMsg(d) {
      if (!d || !d._) return;
      if (d._ === 'rematch') {
        g.wantPeer = true;
        if (g.setRematchNote) g.setRematchNote('Đối thủ muốn chơi lại.'); else toast('Đối thủ muốn chơi lại');
        maybeRematch();
      } else if (d._ === 'restart' && !g.host) applyRestart(d.hostSide);
      else if (d._ === 'leave') onPeerLeft();
    }
    function onPeerLeft() {
      if (g.peerGone || cur !== g) return;
      g.peerGone = true; play('error');
      try { g.inst && g.inst.onPeerLeft && g.inst.onPeerLeft(); } catch (e) { console.error(e); }
      ctx.ui.status('Đối thủ đã rời phòng', 'warn');
      var m = openModal('', [h('h2', { text: 'Đối thủ đã rời phòng' }), h('p', { text: 'Kết nối đã bị ngắt. Bạn có thể xem lại bàn cờ hoặc về sảnh.' }),
        h('div', { class: 'actions' }, [h('button', { class: 'btn', text: 'Xem bàn cờ', onclick: function () { m.close(); } }),
          h('button', { class: 'btn primary', text: 'Về sảnh', onclick: function () { m.close(); if (cur === g) leaveGame(); } })])]);
    }
    function newGame() {
      if (online) {
        if (g.peerGone) { toast('Đối thủ đã rời phòng'); return; }
        if (g.wantMe) { toast('Đang chờ đối thủ đồng ý…'); return; }
        confirmBox('Mời đối thủ chơi ván mới? (hai bên sẽ đổi bên)', 'Gửi lời mời').then(function (ok) { if (ok && cur === g) requestRematch(); });
        return;
      }
      if (g.resultModal) g.resultModal.close();
      if (g.mode === 'ai' && cfg.sideChoiceRandom) ctx.mySide = Math.random() < 0.5 ? 0 : 1;
      g.inst.restart();
    }

    // --- khởi tạo game
    renderToolbar();
    try {
      g.inst = def.create($root, ctx);
    } catch (e) {
      console.error(e);
      $root.appendChild(h('div', { class: 'panel', text: 'Không khởi tạo được trò chơi: ' + e.message }));
    }
    if (online) toast('Bạn cầm ' + def.sides[ctx.mySide] + (ctx.mySide === 0 ? ' – đi trước' : ' – đi sau'));
    window.scrollTo(0, 0);
  }

  /* ---------------- route ---------------- */
  function route() {
    var hash = location.hash || '';
    var m = hash.match(/^#\/join\/([A-Za-z0-9]{3,8})/);
    if (m) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      if (cur) leaveGame(true);
      renderLobby();
      joinRoom(m[1]);
      return;
    }
    if (cur && hash.indexOf('#/play') !== 0) leaveGame(true);   // nút Back của trình duyệt
    else if (!cur) renderLobby();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', function () { if (cur && location.hash.indexOf('#/play') !== 0) leaveGame(true); });

  // mở khoá âm thanh ở lần chạm đầu tiên
  ['pointerdown', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function () { try { Sound.unlock && Sound.unlock(); } catch (e) {} }, { once: true, passive: true });
  });

  // vào thẳng #/play/xxx khi tải lại trang → về sảnh
  if (location.hash.indexOf('#/play') === 0) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  route();

  window.BGR = { startGame: startGame, openSetup: openSetup, leave: leaveGame }; // phục vụ test
})();
