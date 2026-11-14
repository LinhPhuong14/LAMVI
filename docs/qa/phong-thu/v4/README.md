# Iteration 2026-11-14

Build production local 5187, Chromium SwiftShader, 800×450. Luồng sinh nhật đạt `celebrated`, không tràn ngang, không JS/console error (stub Vercel analytics trên local). Video quay từ POV sát bàn, đèn bật giữ camera, chạm bì đưa vật lên chính diện, kéo/mở giấy, handwriting thân thư và mở bánh giấy/tắt nến.

`v4-2-switch.png` giữ tên của driver cũ nhưng **không còn góc cận công tắc**. `v4-3-envelope.png` là trạng thái chờ chạm, bì vẫn nằm trên bàn. `v4-4-slot.png` là bì đã lơ lửng chính diện, không phải góc camera thấp cũ. Ảnh thư chụp trong thời gian reveal; có nút hiện toàn bộ.

Bản nền modern-v4 và đôi gà tự vẽ trên chụp đèn là asset minh họa; chưa thay bằng artwork hoặc texture dó thật. Chi tiết prompt: docs/art/room-modern-v4.prompt.md. Các QA thư mục current/comparison là iteration 2026-11-13, không dùng thay ảnh mới.

Kết quả cuối: 100/100 tests phòng thư đạt (gồm Reader reveal, fallback Intl, reduced-motion), lint sạch, build client/SSR đạt. Kiểm tra độc lập: bấm ngoài bì vào vùng cảnh → ready, camera vẫn room; Enter mở giấy, nút hiện toàn bộ hoạt động. Lượt reduced-motion production 5188 đạt celebrated, không tràn ngang, không JS error; video reduced-mobile.webm. Server preview mới phải khởi động sau build để tránh HTML hash cũ.
