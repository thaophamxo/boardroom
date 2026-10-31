# 🎲 Phòng Board Game

Web chơi board game đơn giản, giao diện xanh dương nhạt – trắng dịu mắt, có hiệu ứng âm thanh (không nhạc nền).
Thuần HTML/CSS/JS, **không cần build**, chạy thẳng trên GitHub Pages.

## Trò chơi

| Trò | Chế độ |
|---|---|
| Cờ vua | 2 người 1 máy · chơi với máy (3 mức) · online |
| Cờ tướng | 2 người 1 máy · chơi với máy (3 mức) · online |
| Cờ vây (9×9 / 13×13 / 19×19, chấm điểm kiểu Trung Quốc) | 2 người 1 máy · chơi với máy · online |
| Cờ caro (15×15 / 19×19, tuỳ chọn luật chặn 2 đầu) | 2 người 1 máy · chơi với máy · online |
| Sudoku (Dễ / Vừa / Khó, đề luôn có đúng 1 nghiệm) | 1 người |
| Ghép tranh (mảnh jigsaw, 5 tranh vẽ sẵn, 3×3 → 8×6) | 1 người |

## Chạy thử trên máy

```bash
cd board-game-room
python3 -m http.server 8000
# mở http://localhost:8000
```

(Mở trực tiếp file `index.html` cũng chạy được các game offline; riêng chơi online nên dùng http/https.)

## Deploy lên GitHub Pages

1. Tạo repo mới trên GitHub, rồi:
   ```bash
   cd board-game-room
   git init && git add . && git commit -m "Phong Board Game"
   git branch -M main
   git remote add origin https://github.com/<ten-ban>/<ten-repo>.git
   git push -u origin main
   ```
2. Vào **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, thư mục `/ (root)`.
3. Sau ~1 phút web có ở `https://<ten-ban>.github.io/<ten-repo>/`.

## Chơi online

- Một người chọn game → **Online → Tạo phòng**, gửi mã 5 ký tự (hoặc link) cho người kia.
- Người kia bấm **Vào phòng** ở sảnh, nhập mã (hoặc mở link).
- Kết nối trực tiếp giữa 2 trình duyệt (WebRTC) qua [PeerJS](https://peerjs.com), dùng server ghép phòng miễn phí mặc định của PeerJS. Hết ván bấm **Chơi lại** để đổi bên.
- Thư viện PeerJS được nạp từ `js/vendor/peerjs.min.js` nếu có, nếu không sẽ tự nạp từ CDN (unpkg → jsDelivr, pin version 1.5.4).
  Muốn chạy hoàn toàn không phụ thuộc CDN: tải `peerjs.min.js` (v1.5.4, giấy phép MIT) bỏ vào `js/vendor/`.
- Một số mạng công ty chặn WebRTC; khi đó hai máy nên dùng mạng khác (vd 4G) hoặc chơi "2 người 1 máy".

## Cấu trúc

```
index.html
css/style.css        giao diện chung + css/<game>.css
js/registry.js       Games.register
js/sound.js          âm thanh tổng hợp bằng Web Audio (không file âm thanh)
js/net.js            online qua PeerJS
js/app.js            sảnh, thiết lập, màn game, online, chơi lại
js/engines/*.js      logic thuần (chạy được trong Node)
js/games/*.js        giao diện từng game
tests/*.test.js      test Node:  for t in tests/*.test.js; do node $t; done
docs/ARCHITECTURE.md hợp đồng giữa shell và game
```

## Thêm game mới

Xem `docs/ARCHITECTURE.md`: viết engine + `js/games/<id>.js` gọi `Games.register({...})`, thêm thẻ `<script>`/`<link>` vào `index.html`.
