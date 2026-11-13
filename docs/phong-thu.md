# Phòng thư LAMVI — prototype POV

Nhánh `feat/phong-thu`, worktree `LAMVI-phong-thu`. React/Vite + Three.js trực tiếp, giữ Express SSR và cấu hình Vercel. Phiên bản POV theo feedback D-136; không nối dữ liệu người nhận thật và không đổi `/qr/:token`.

## Chạy

```sh
cd /home/linhnp69/MY_PROJECTs/LAMVI-phong-thu
npm install
npm run dev
```

Mở `/phong-thu` ở URL server in ra. Nếu đang có server của nhánh khác, dùng `PORT=5175 npm run dev`. Chọn mẫu ở nút “Lời chúc mẫu”, hoặc `?occasion=birthday`, `anniversary`, `thankYou`, `milestone`, `encouragement`, `longDistance`, `justBecause`. `longDistance` là video; thêm `&kind=video` để thử video ở dịp khác. `&fallback=1` ép cảnh CSS 2D; `&empty=1` thử thiếu dữ liệu bất ngờ/P.S.

## Khung ngang và xoay máy (D-137)

Trải nghiệm cố định **16:9**, letterbox đen. Mở bằng điện thoại dọc chỉ thấy overlay đen `rgba(0,0,0,.8)`, chữ trắng hướng dẫn xoay. Engine Three.js chưa được import/khởi tạo khi màn hình còn dọc. Khi viewport ngang, mới dựng và fade/blur phòng từ nền đen. Trên desktop ngang vào thẳng reveal. Không gọi fullscreen/orientation-lock API.

Quay lại dọc: cảnh bị ẩn/inert, rAF và phase timer được tạm dừng, giữ nguyên bước và thời gian còn lại; trở lại ngang sẽ tiếp tục. Tờ thư và vị trí cuộn không bị unmount. Video được pause, có thể bấm phát tiếp khi quay ngang.

## Luồng hiện tại — thao tác chủ động, mở đầu POV

Khung đầu là **PerspectiveCamera ở tầm mắt nhìn bàn**, không lộ mô hình góc phòng isometric. Giữ nền Việt đã gen. Sáu bố cục: POV phòng → cận công tắc khi chạm bật → trên xuống phong bì → thấp sát khe khi mở → chính diện thư → góc ngược với thiệp bánh giấy. Người nhận tự chạm bì, kéo giấy, mở bất ngờ và tắt nến. Camera đứng khi kéo/đọc/xem video. Không có tiêu đề chương, thanh tiến trình hay trạng thái nổi; pulse neo vật và nhắc ngắn sau khi dừng.

Kéo khóa trục bằng ray/plane, pointer capture, dưới 40% trả về; vượt ngưỡng hoàn tất. Tap mép giấy hoặc Enter cũng mở được; pointercancel trả về. Reducer bỏ sự kiện không hợp lệ và chạm lặp trong chuyển cảnh. Quay dọc pause cả timer/camera/video.

Lời đề tặng duy nhất dùng Itim có tiếng Việt, tên động tĩnh và **nét gạch chân SVG** chạy 1,1 giây; sau đó hiện thân thư. Không khẳng định font là từng stroke viết tay. Thư HTML lớn (86–88% chiều ngang), cuộn đến chữ ký và điểm mở bất ngờ. Video chỉ phát khi bấm, có controls/phụ đề và lối mở bất ngờ bên dưới.

## Mỹ thuật và engine

- Palette hiện hành D-121 / T-93: Cream Ivory `#F4E8CF`, Light Beige `#EAD6B7`, Caramel `#C89A63`, Warm Brown `#8B5E3C`, Deep Brown `#3F200B`. Không dùng bảng son/xanh cũ trong `BRAND_GUIDELINE.md`; đối chiếu bản cập nhật ở `knowledge/design-rules.md`.
- Góc nhìn thứ nhất bằng PerspectiveCamera; bì giữ trên bàn, giấy rút rồi mới nâng về phía người đọc. Quaternion slerp và easing liên tục, không cắt sang một mô hình khác.
- Bàn, chân, khung cửa và vật nhỏ dùng rounded geometry. Đèn/đế dùng lathe với profile bo liên tục. Cốc có thành/rim, rèm là bề mặt gấp mềm liên tục. Các đồ vật đã được đặt sát mặt bàn.
- PMREM tạo phản sáng môi trường; giấy/gỗ có color + normal + roughness maps; chụp giữ lớp sợi procedural riêng. Bóng PCF và occlusion mềm sát đồ vật. Shadow map chỉ cập nhật khi cần; không render liên tục ở cảnh nghỉ, DPR tối đa 1,65.
- Lá thư uốn nhẹ trong lúc rút lên. Reader HTML bắt đầu từ bounding box chiếu của giấy 3D; scale/translate trong 420 ms, không phải homography bốn góc.
- Thiệp gấp và bánh giấy/nến dựng trong Three.js; câu cuối, ảnh và điều khiển đọc bằng DOM.

## Thay nội dung / sản phẩm thật

| Vị trí | Nội dung |
|---|---|
| `src/letter-room/data.js` | Tên, nhiều đoạn thư, `kind`, video/poster/phụ đề, occasionData, P.S.; validation |
| `src/letter-room/OrientationGate.jsx` | Phát hiện hướng viewport, overlay đen 80% chữ trắng, inert cảnh ở portrait |
| `src/letter-room/LetterRoom.jsx` | Trình đọc, chữ viết tay, nhịp cảnh, video và bảy bất ngờ |
| `src/letter-room/scene.js` | Nhóm `lamp`, texture sợi, màu `C`, envelope và ánh sáng |
| `src/letter-room/room.css` | Tín hiệu neo vật, giấy caro, animation chữ, fallback và reduced motion |
| `public/letter-room/textures/` | Maps 512 px cục bộ; nguồn và cách xử lý trong `SOURCES.md` |
| `public/letter-room/message.webm` | Clip demo tự dựng 6 giây có audio Opus; thay bằng lời nhắn thật |
| `public/letter-room/poster.jpg`, `captions.vtt` | Poster và phụ đề demo; cập nhật theo video thật |

Nền Việt là ảnh gen, lưu nguồn và prompt trong `docs/art/room-viet-v3*`. Model đèn, dấu niêm và nội dung là asset tạm; đã đối chiếu ảnh LAMVI về trụ giấy/đế gỗ, chưa dùng artwork phẳng hoặc ảnh sợi giấy dó thật. Paper 001 là giấy chung, không phải ảnh giấy dó thật. Có thể thay nhóm lamp bằng glTF, giữ vị trí chân đèn và nguồn sáng.

Font và texture đều tự host. `public/letter-room/licenses/` giữ MIT Three.js và OFL Itim. Texture ambientCG/Poly Haven có CC0, model bàn KayKit CC0, nguồn và bản dẫn xuất trong `docs/art/model-sources.md`.

## Nguồn đã kiểm tra

| Nguồn | Phần đã tham khảo / trạng thái |
|---|---|
| https://maxime-morel.xyz/ và https://github.com/maxime-mrl/3D-room-portofolio | Cấu trúc scene, ánh sáng ngày/đêm, điều khiển và dừng render lúc modal mở; runtime HTTP 200 sau mở proxy. Browser có tài nguyên/font ngoài bị chậm, xem thêm source `script/utils/init3D.js` |
| https://threejs.org/examples/#webgl_camera và source GitHub | Camera/projection; bản này chủ động chuyển sang Perspective theo feedback POV |
| https://threejs.org/examples/#webgl_shadow_contact và Drei ContactShadows | Bóng tiếp xúc/blur; dùng occlusion mềm cục bộ kết hợp bóng PCF để giảm pass trên điện thoại |
| https://css3dlab.edgarasneverdauskas.com/models/envelope/ | Thứ tự layer, độ lệch bản lề và che giấy trong túi |
| https://threejs.org/docs/pages/DragControls.html | Đã kiểm tra; kéo khóa trục và ngưỡng hoàn tất riêng |
| https://maxwellito.github.io/vivus/ và repo GitHub | Tham khảo nhịp nét; bản hiện tại dùng font tên động và gạch chân SVG tự vẽ, không dùng Vivus |
| https://animated-book-slider-threejs.vercel.app/ và repo GitHub | Bending/easing của giấy; đã đọc `src/components/Book.jsx`; demo HTTP 200, tài nguyên ngoài có thể không hiện đầy đủ trong headless |
| https://ambientcg.com/view?id=Paper001 | Đã tải Color/NormalGL/Roughness qua CDN, CC0 |
| https://polyhaven.com/a/wood_table | Đã tải Diffuse/NormalGL/Rough qua CDN, CC0 |
| https://www.assemblegame.com/ | Tham chiếu hướng game đồ vật thủ công; không lấy asset/mã game |
| Pinterest | Đã thử search pin qua web và runtime: bị proxy 403/tunnel failed; cần `www.pinterest.com`, `i.pinimg.com` để xem trực tiếp. Không khẳng định đã xem được pin |

Không sao chép mã từ repo tham khảo. Three.js addons sử dụng qua package đã có giấy phép MIT.

## Engine và asset dựng sẵn

`CameraRig.js` sử dụng camera-controls (MIT), tween theo mốc hành động. `scene.js` tải bàn KayKit bằng GLTFLoader, áp vật liệu gỗ của LAMVI, dùng RoomEnvironment/PMREM và RoundedBoxGeometry của Three.js. Không nhập cả framework R3F vào stack React/Three hiện có. `?assets=legacy` giữ bàn thủ công để so cùng camera/ánh sáng.

Nền gen được project lên kiến trúc phòng và dùng làm nền xa; không phải phòng photogrammetry hoàn chỉnh. Góc camera đảo có giới hạn parallax/ảnh kéo giãn. Artwork trên chụp đèn vẫn cần thay bằng artwork/ảnh giấy dó thật của LAMVI. Storyboard tên “Six cinematic angles of a Vietnamese lamp.png” không có trong workspace; dùng mô tả sáu khung của yêu cầu.

## Kiểm tra và bàn giao

Xem `docs/qa/phong-thu/README.md` cho lượt kiểm tra hiện tại, ảnh và video. Kết quả cũ của luồng tự mở không dùng làm nghiệm thu luồng kéo mới.

API nhúng: `LetterRoom({ letter, onExit, preview, afterLetter })`. Các props cho phép trang thư thật bọc intro video và nút văn hóa bên ngoài; prototype không tự sửa hợp đồng API/backend.

Kết quả cuối: lint/build đạt; 101 kiểm thử phòng thư độc lập đạt; hồi quy 4052 đạt + một ca routing chập chờn (cả tệp chạy lại 26/26 đạt), 2 skip. Xem QA README để phân biệt lượt chạy toàn bộ và lượt kiểm tra lại.

Kiểm tra xác nhận sau chỉnh geometry cuối: `npm test -- src/letter-room src/components/Brand.extra.test.jsx src/pages/Routing.extra.test.jsx --maxWorkers=2` đạt **6 tệp / 136 ca** (gồm routing và brand).
