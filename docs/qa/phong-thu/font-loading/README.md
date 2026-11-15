# Font title và chặn layout tạm — 2026-11-14

Production local 5199, Chromium headless 800×450. Chủ động giữ request background `room-modern-v4-*` trước khi tải xong, thay vì chỉ thử mạng nhanh/cache.

- `01-delayed-background.png`: màn chờ đen. Đo được main `aria-busy=true`, stage-wrap `visibility:hidden`, `inert=true`, chưa có `lr-scene-ready` dù Three.js đã khởi tạo và có canvas.
- `02-ready.png`: chỉ mở cảnh sau assets và frame cuối đã render.
- `03-font-writing.png`, `04-font-docked.png`: cùng title font cho mọi tên; đo computed font `Dancing Script`, text `Gửi Linh,`, **0 SVG** trong heading, không lỗi JS.
- `result.json` ghi kết quả thực tế; mask font tạo reveal trái→phải, không tuyên bố font là từng stroke viết thật. Cảnh/title ở v5 trước đó là ảnh lịch sử của bản SVG.

Font được self-host từ @fontsource/dancing-script, có Vietnamese/Latin 400. Giấy phép giữ ở public/letter-room/licenses/dancing-script-OFL.txt.

Kiểm tra cuối: 9 tệp / 145 ca đạt (`npm test -- src/letter-room src/components/Brand.extra.test.jsx --maxWorkers=2`), gồm title/font, transition guard, deferred import/onReady, orientation và branding; lint sạch, build client/SSR đạt. Không gọi số này là toàn bộ suite dự án.
