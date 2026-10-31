/* Registry: định nghĩa window.Games trước khi các game script chạy. */
(function () {
  var G = window.Games = window.Games || {};
  G.list = G.list || [];
  G.register = function (def) {
    if (!def || !def.id) { console.warn('Games.register: thiếu id'); return; }
    G.list = G.list.filter(function (d) { return d.id !== def.id; });
    G.list.push(def);
  };
  G.get = function (id) {
    for (var i = 0; i < G.list.length; i++) if (G.list[i].id === id) return G.list[i];
    return null;
  };
})();
