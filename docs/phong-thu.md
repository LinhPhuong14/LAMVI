# Phòng thư lamvi — prototype cục bộ

Nhánh `feat/phong-thu`, React/Vite + Three.js trực tiếp; giữ Express SSR và cấu hình Vercel. Không dùng dữ liệu người nhận thật hay thay luồng `/qr/:token`.

## Khởi động

```sh
npm install
npm run dev
```

Mở http://localhost:5173/phong-thu. Chọn mẫu ở “Khám phá lời chúc mẫu” cuối trang, hoặc dùng `?occasion=birthday`, `anniversary`, `thankYou`, `milestone`, `encouragement`, `longDistance`, `justBecause`. Mặc định `justBecause`; `longDistance` là video. Thêm `&kind=video` để thử video ở dịp khác; `&fallback=1` ép cảnh CSS 2D; `&empty=1` thử thiếu dữ liệu bất ngờ và không P.S.

Bật đèn → mở phong bì → kéo nút “Kéo mép giấy lên” theo trục rút giấy, hoặc chạm/Enter/Space → đọc thư → mở bất ngờ dưới chữ ký. Kéo chưa tới 40% trả về; hủy pointer luôn trả về. Mỗi bước chuyển có khóa trạng thái. Bản 2D dùng cùng reducer, thư và video.

## Vị trí thay nội dung và vật liệu

- `src/letter-room/data.js`: dữ liệu mẫu, tên, nội dung nhiều đoạn, `kind`, video/poster/phụ đề, `occasionData`, `postscript`; `validateLetter` kiểm tra các trường bắt buộc.
- `src/letter-room/scene.js`: phòng, camera, đèn, phong bì, bảng màu `C`; `C.sage` đổi màu bì. `createRoom` sinh texture sợi giấy bằng Canvas; thay `texture` bằng ảnh giấy dó thật. Nhóm `lamp` là model hình trụ dựng bằng geometry, có thể thay bằng glTF nhưng giữ vị trí chân đèn và nguồn sáng. Không có model bên thứ ba.
- `src/letter-room/LetterRoom.jsx`: nội dung DOM, các nét SVG “Gửi bạn,” viết sẵn gồm dấu, trình phát và bảy bất ngờ. Tên động hiển thị tĩnh. Thêm ảnh vào `occasionData.photos` để hiện một/hai ảnh; không ảnh dùng thẻ ghi ngày.
- `src/letter-room/room.css`: giao diện, cảnh 2D, hoạt ảnh quà giấy, reduced motion.
- `public/letter-room/message.webm`: clip minh họa 6 giây tự tạo bằng Canvas + Web Audio, hình đèn và giai điệu sine; có track Opus. Đây không phải lời nhắn thật. `captions.vtt` là chú thích mẫu, cần thay theo video thực.

Font đóng gói qua Fontsource, không gọi Google Fonts lúc chạy. Instrument Sans và Caveat không có bộ Vietnamese riêng trong gói font: các glyph thiếu dùng font dự phòng; Spectral có Vietnamese. Cần duyệt hình thức chữ trên iOS thật trước sản xuất.

## Phạm vi và asset tạm

Toàn bộ phòng, model đèn, thớ giấy, SVG viết tay và vật thể quà là minh họa tự dựng, cần đối chiếu sản phẩm lamvi thật. Không có storyboard hoặc ảnh sản phẩm trong đầu vào. Bất ngờ dùng vật thể giấy DOM/CSS trên tờ thư; cảnh phòng, đèn, camera và phong bì dùng Three.js. Bóng PCF mềm, không dùng bloom/postprocessing nặng. Không sao chép mã từ repo tham khảo; tham khảo API camera orthographic và raycasting Three.js (https://threejs.org/docs/pages/DragControls.html và https://github.com/mrdoob/three.js/blob/dev/examples/webgl_camera.html).

Giới hạn: chưa nối dữ liệu QR/backend; chưa đo GPU trên điện thoại thật. Bản anniversary mặc định dùng thẻ ngày (chưa có ảnh cá nhân). Tên trên bì dùng canvas serif dự phòng. Các trạng thái nghỉ ngừng requestAnimationFrame; DPR tối đa 1.65, shadow map 1024. Phần kéo dùng giao điểm ray/plane mặt bàn, chiếu lên trục z của bì. Điểm nắm DOM là vùng chạm lớn nằm bên dưới thư. HTML reader mở từ bounding box chiếu của tờ giấy 3D lên nền bàn/bì; đây là chuyển tiếp scale/translate, không phải homography bốn góc.

## Kiểm tra thực tế — 2026-11-13

| Hạng mục | Kết quả |
|---|---|
| Chrome headless, 360×800 và 1440×1000 | Bật đèn, tiến gần, mở thư; không tràn ngang |
| Bảy dịp, fallback 2D, giảm chuyển động | Mở đầy đủ nội dung và bất ngờ; sinh nhật tắt nến được |
| Video bấm phát | Thời gian phát tăng, không muted, Opus audio có byte được giải mã, không lỗi media |
| Kéo thực bằng chuột | Kéo ngắn trả về (không mở nhầm do click tổng hợp); kéo dài mở thư |
| Hủy pointer, ngưỡng 40%, chạm lặp, bàn phím, video lỗi | Bộ test độc lập 49/49 đạt |
| Mô phỏng `webglcontextlost` | Hiện cảnh 2D và tiếp tục đọc được thư |
| `?occasion=anniversary&empty=1&fallback=1` | Đọc thư, không hiện điểm mở bất ngờ rỗng |
| Dấu tiếng Việt, thư dài | Đã xem ảnh 360 px; cuộn trong tờ thư, không tràn ngang |
| Lint + build client/SSR | Đạt; scene tải thành chunk riêng (~144 KB gzip) |

Ảnh nghiệm thu lưu trong `docs/qa/phong-thu/` (mobile tắt/bật đèn, đọc thư, desktop). Trình duyệt thử nghiệm dùng Chromium với SwiftShader; chưa tương đương đo hiệu năng GPU trên điện thoại thật. Không có storyboard đính kèm để so khung hình. Không công bố production trong phiên prototype này.

Lưu ý phối hợp: trong lúc triển khai, session khác đã merge một prototype độc lập `src/wishroom` cùng route vào `master` (`e58872e`). Mã trong tài liệu này thuộc `feat/phong-thu`, chạy tại worktree `LAMVI-phong-thu`; cần chọn hoặc phối hợp hai triển khai trước khi merge, không ghi đè tự động.

Bản quyền phụ thuộc phân phối kèm: `public/letter-room/licenses/` giữ MIT của Three.js và OFL của ba font. Toàn bộ hình/texture/model/media demo tự dựng; không sao chép model/ảnh từ các repo tham khảo.

Lượt xác nhận cuối: `npm test -- --maxWorkers=6` — **262/262 tệp đạt, 4008 ca đạt, 2 bỏ qua**, 239,98 giây. `npm run lint` và `npm run build` đạt. Bộ `MobileBars.test.jsx` được sửa để chờ IntersectionObserver gắn đúng target trước khi phát callback; đây là đồng bộ hóa test, không đổi hành vi trang sản phẩm.
