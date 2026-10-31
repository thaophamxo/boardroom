/* Net: kết nối 2 máy qua WebRTC bằng PeerJS (server môi giới miễn phí mặc định của PeerJS). */
(function () {
  var PEER_VERSION = '1.5.4';
  var PEER_SOURCES = [
    'js/vendor/peerjs.min.js',
    'https://unpkg.com/peerjs@' + PEER_VERSION + '/dist/peerjs.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@' + PEER_VERSION + '/dist/peerjs.min.js'
  ];
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ 0/O/1/I
  var CONNECT_TIMEOUT = 12000, PING_EVERY = 4000, DEAD_AFTER = 13000;

  var peer = null, conn = null, timers = [], connectedOnce = false, closing = false;
  var msgH = [], openH = [], closeH = [];

  function sub(list, fn) {
    list.push(fn);
    return function () { var i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); };
  }
  function emit(list, a) { list.slice().forEach(function (f) { try { f(a); } catch (e) { console.error(e); } }); }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { s.remove(); rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }
  var loading = null;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (loading) return loading;
    loading = PEER_SOURCES.reduce(function (p, src) {
      return p.then(function () { if (!window.Peer) return loadScript(src).catch(function () {}); });
    }, Promise.resolve()).then(function () {
      if (!window.Peer) { loading = null; throw new Error('Không tải được thư viện kết nối (PeerJS). Kiểm tra mạng rồi thử lại.'); }
    });
    return loading;
  }

  function code5() {
    var s = '';
    for (var i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }
  function normCode(c) {
    return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1') === '' ? '' :
      String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function clearTimers() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }

  function teardown() {
    clearTimers();
    var c = conn, p = peer; conn = null; peer = null;
    try { c && c.close(); } catch (e) {}
    try { p && p.destroy(); } catch (e) {}
  }

  function errText(err) {
    var t = err && err.type;
    switch (t) {
      case 'peer-unavailable': return 'Không tìm thấy phòng. Kiểm tra lại mã phòng (chủ phòng phải đang mở và chờ).';
      case 'network': case 'server-error': case 'socket-error': case 'socket-closed':
        return 'Không kết nối được tới máy chủ ghép phòng. Kiểm tra mạng rồi thử lại.';
      case 'browser-incompatible': return 'Trình duyệt này không hỗ trợ kết nối trực tiếp (WebRTC).';
      case 'webrtc': return 'Không thiết lập được kết nối trực tiếp giữa hai máy (có thể do tường lửa/mạng công ty).';
      case 'disconnected': return 'Mất kết nối tới máy chủ ghép phòng.';
      default: return 'Lỗi kết nối' + (t ? ' (' + t + ')' : '') + '. Hãy thử lại.';
    }
  }

  // gắn conn khi đã mở: heartbeat + nhận tin
  function attach(c) {
    conn = c; connectedOnce = true;
    var last = Date.now();
    c.on('data', function (d) {
      last = Date.now();
      if (d && d._ === 'ping') { return; }
      emit(msgH, d);
    });
    function gone() { if (conn !== c) return; conn = null; clearTimers(); emit(closeH); }
    c.on('close', gone);
    c.on('error', gone);
    timers.push(setInterval(function () {
      if (Date.now() - last > DEAD_AFTER) { try { c.close(); } catch (e) {} gone(); return; }
      try { c.send({ _: 'ping' }); } catch (e) {}
    }, PING_EVERY));
    emit(openH);
  }

  var Net = {
    code: null,
    isOpen: function () { return !!(conn && conn.open); },

    host: function () {
      Net.close(); closing = false; connectedOnce = false;
      return loadPeer().then(function () {
        return new Promise(function (resolve, reject) {
          var attempts = 0, done = false, myPeer;
          function fail(msg) { if (done) return; done = true; teardown(); reject(new Error(msg)); }
          function tryOpen() {
            if (++attempts > 6) return fail('Không tạo được phòng. Hãy thử lại sau ít phút.');
            var code = code5();
            try { myPeer = new window.Peer('bgr-' + code); } catch (e) { return fail(errText({ type: 'browser-incompatible' })); }
            peer = myPeer;
            var t = setTimeout(function () { fail('Hết thời gian chờ máy chủ ghép phòng (12 giây). Kiểm tra mạng rồi thử lại.'); }, CONNECT_TIMEOUT);
            timers.push(t);
            myPeer.on('open', function () {
              if (done) return; done = true; clearTimeout(t); Net.code = code;
              resolve({ code: code });
            });
            myPeer.on('connection', function (c) {
              if (conn) { try { c.on('open', function () { c.send({ _: 'busy' }); c.close(); }); } catch (e) {} return; }
              var go = function () { attach(c); };
              if (c.open) go(); else c.on('open', go);
            });
            myPeer.on('error', function (err) {
              if (done) {
                if (err && err.type === 'peer-unavailable') return;
                if (!closing && !conn) emit(closeH);
                return;
              }
              clearTimeout(t);
              if (err && err.type === 'unavailable-id') { try { myPeer.destroy(); } catch (e) {} peer = null; return tryOpen(); }
              fail(errText(err));
            });
            myPeer.on('disconnected', function () {
              // mất server môi giới nhưng kết nối trực tiếp (nếu có) vẫn sống; thử nối lại để còn nhận khách
              if (!conn && !closing) { try { myPeer.reconnect(); } catch (e) {} }
            });
          }
          tryOpen();
        });
      });
    },

    join: function (code) {
      Net.close(); closing = false; connectedOnce = false;
      code = normCode(code);
      if (code.length !== 5) return Promise.reject(new Error('Mã phòng gồm 5 ký tự.'));
      return loadPeer().then(function () {
        return new Promise(function (resolve, reject) {
          var done = false, p;
          function fail(msg) { if (done) return; done = true; teardown(); reject(new Error(msg)); }
          try { p = new window.Peer(); } catch (e) { return fail(errText({ type: 'browser-incompatible' })); }
          peer = p;
          var t = setTimeout(function () { fail('Hết thời gian kết nối (12 giây). Kiểm tra mã phòng và mạng, hoặc nhờ chủ phòng tạo lại phòng.'); }, CONNECT_TIMEOUT);
          timers.push(t);
          p.on('error', function (err) {
            if (done) { if (!closing && !conn) emit(closeH); return; }
            clearTimeout(t); fail(errText(err));
          });
          p.on('open', function () {
            var c = p.connect('bgr-' + code, { reliable: true, serialization: 'json' });
            c.on('open', function () {
              if (done) return; done = true; clearTimeout(t); Net.code = code;
              attach(c); resolve({ code: code });
            });
            c.on('error', function () { clearTimeout(t); fail('Không kết nối được tới phòng. Hãy thử lại.'); });
            c.on('close', function () { if (!done) { clearTimeout(t); fail('Phòng đã đóng hoặc đang có người khác.'); } });
          });
        });
      });
    },

    send: function (obj) {
      if (!conn || !conn.open) return false;
      try { conn.send(obj); return true; } catch (e) { return false; }
    },
    onMessage: function (fn) { return sub(msgH, fn); },
    onOpen: function (fn) { return sub(openH, fn); },
    onClose: function (fn) { return sub(closeH, fn); },
    close: function () { closing = true; teardown(); Net.code = null; }
  };
  window.Net = Net;
})();
