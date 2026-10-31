# Board Game Room – kiến trúc & hợp đồng giữa "shell" và từng game

Web tĩnh (HTML/CSS/JS thuần, không build), deploy GitHub Pages. UI tiếng Việt.
Tông màu: xanh dương nhạt + trắng, dịu mắt cho dân văn phòng.

## Cấu trúc thư mục

```
index.html
css/style.css            (shell + biến màu + component chung)  – do shell quản lý
css/<id>.css             (CSS riêng của từng game)              – do game quản lý
js/sound.js              (Web Audio synth, không nhạc nền)
js/net.js                (online 2 máy qua WebRTC/PeerJS)
js/vendor/peerjs.min.js
js/app.js                (lobby, setup dialog, game screen, rematch…)
js/engines/<name>-engine.js   (logic thuần, chạy được cả trong Node để test)
js/games/<id>.js              (UI + glue của game, đăng ký bằng Games.register)
tests/                        (test node)
```

id game: `chess`, `xiangqi`, `go`, `gomoku`, `sudoku`, `puzzle`.

## Engine (logic thuần)

File `js/engines/<name>-engine.js` là script thường (KHÔNG dùng ES module). Cuối file:

```js
if (typeof module !== 'undefined' && module.exports) module.exports = X; else window.X = X;
```

Mọi thứ không phụ thuộc DOM để test bằng Node (`node tests/xxx.test.js`).

## Đăng ký game

```js
window.Games = window.Games || {};   // shell tạo sẵn Games.register(def)
Games.register({
  id: 'chess',
  name: 'Cờ vua',
  tagline: 'Trí tuệ cổ điển 8×8',
  players: 2,            // 2 = đối kháng (local / ai / online); 1 = chơi một mình (solo)
  sides: ['Trắng', 'Đen'],   // chỉ với players:2. sides[0] LUÔN là bên đi trước.
  options: [             // tuỳ chọn hiển thị trong hộp thoại thiết lập (không bắt buộc)
    { key: 'level', label: 'Độ khó', modes: ['ai'],
      choices: [{ v: 1, l: 'Dễ' }, { v: 2, l: 'Vừa' }, { v: 3, l: 'Khó' }], default: 2 }
  ],                     // `modes` (tuỳ chọn) = chỉ hiện khi mode nằm trong danh sách
  create(root, ctx) { ... return instance; }
});
```

Shell tự lo: chọn mode, chọn bên (đi trước/sau/ngẫu nhiên), phòng online, nút "Ván mới", "Về sảnh",
bật/tắt âm thanh, modal kết quả, rematch online (đổi bên mỗi ván).

### `ctx`

| trường | ý nghĩa |
|---|---|
| `ctx.mode` | `'local'` (2 người 1 máy) \| `'ai'` \| `'online'` \| `'solo'` |
| `ctx.opts` | giá trị các `options` đã chọn, vd `{level: 2}` (với online: do chủ phòng chọn, cả 2 máy nhận giống nhau) |
| `ctx.mySide` | 0/1 = bên của người chơi trên máy này (ai/online). `null` khi local/solo. **Luôn đọc lại `ctx.mySide` mỗi ván** (shell đổi bên khi rematch rồi gọi `restart()`). Với `ai`: AI cầm bên `1 - mySide`. |
| `ctx.sound.play(name)` | `click select move capture check place error win lose draw snap pop tick complete hint` |
| `ctx.net` | chỉ có khi `online`. `ctx.net.send(obj)` (obj là JSON thuần). `ctx.net.onMessage(fn)` đăng ký handler `fn(obj)`, trả về hàm huỷ đăng ký. |
| `ctx.ui.status(text, tone)` | dòng trạng thái trên đầu (vd "Lượt của Trắng"); tone: `'info'\|'good'\|'warn'\|'bad'` |
| `ctx.ui.toolbar(items)` | thanh nút hành động riêng của game: `[{id,label,icon?,onClick,disabled?,primary?}]`; gọi lại để cập nhật (thay toàn bộ). Shell tự thêm "Ván mới", "Về sảnh". |
| `ctx.ui.result({title,text,tone})` | mở modal kết thúc ván; tone `'win'\|'lose'\|'draw'` (shell tự phát âm win/lose/draw – game KHÔNG cần gọi sound.play('win'…) cho ván đối kháng; với solo (sudoku/puzzle) game tự phát `complete`). |
| `ctx.ui.confirm(text)` | `Promise<boolean>` (vd xác nhận đầu hàng) |
| `ctx.ui.toast(text)` | thông báo nhỏ tự tắt |

### `instance` mà `create()` trả về

```js
{
  restart(),            // bắt đầu ván mới (đọc lại ctx.mySide / ctx.opts)
  destroy(),            // gỡ listener, clearTimeout/Interval, huỷ AI đang tính
  onPeerLeft?()         // (tuỳ chọn) đối thủ online thoát/mất kết nối
}
```

`root` là `<div class="game-root">` rỗng, game tự dựng layout bên trong (bàn cờ + panel phụ).
Phải responsive: bàn cờ co theo `min(chiều rộng root, 100vh - ~230px)`; dùng `ResizeObserver` hoặc CSS thuần
(vd SVG `viewBox` + `width:min(100%, calc(100vh - 230px))`). Dùng được trên điện thoại (pointer events, không phụ thuộc hover).

### Online (khi `ctx.mode === 'online'`)

* Bên 0 là người đi trước. Chỉ cho phép thao tác khi tới lượt `ctx.mySide`.
* Gửi nước đi: `ctx.net.send({t:'move', ...})`. Nhận: validate nước đi hợp lệ rồi áp dụng (đừng tin dữ liệu đối thủ).
* Các thông điệp game tự định nghĩa (`resign`, `pass`, `draw-offer`…) đều đi qua `ctx.net.send`.
* Không có "đi lại" (undo) khi online. Local/AI có undo (AI: lùi 2 nước để về lượt của người).

### Chế độ AI

* AI phải trả lời trong ≤ ~1.5 s ở mức khó nhất (dùng iterative deepening có giới hạn thời gian hoặc node count).
  Gọi AI qua `setTimeout(...,60)` để UI kịp vẽ nước đi của người trước. Lưu timer để `destroy()`/`restart()`/undo huỷ được.
* 3 mức: `level` 1 (dễ, có chút ngẫu nhiên), 2 (vừa), 3 (khó).

## Giao diện chung (css/style.css – dùng, đừng định nghĩa lại)

Biến CSS (`:root`): `--bg:#eef6fd; --panel:#ffffff; --panel-2:#f5faff; --line:#d3e4f5; --primary:#5aa5e8;
--primary-d:#3d8ad0; --primary-soft:#cfe5fa; --primary-softer:#e3f0fc; --text:#2c4a66; --muted:#7f98b0;
--good:#3fa37a; --warn:#e0a13c; --danger:#d9626a; --shadow:0 6px 20px rgba(60,120,180,.12); --radius:14px`

Class dùng chung: `.panel` (thẻ trắng bo góc), `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.small`, `.chip`, `.muted`, `.row`, `.col`.
Màu quân/bàn của từng game: tự chọn nhưng **hợp tông xanh nhạt – trắng**, tương phản đủ rõ, không chói.
CSS riêng đặt trong `css/<id>.css`, mọi selector phải có tiền tố `.g-<id>` (vd `.g-chess .sq`) để không đụng nhau.

## Quy ước khác

* Mọi chuỗi UI bằng tiếng Việt có dấu.
* localStorage dùng tiền tố `bgr:` (vd `bgr:sudoku:best:easy`).
* Không dùng thư viện ngoài, không gọi CDN/mạng (trừ `net.js`).
* Không sửa file ngoài phạm vi được giao.
