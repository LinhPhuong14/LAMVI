# So sánh cùng camera / ánh sáng

Viewport 800×450, cùng build cuối cổng 5185. `before-*` dùng `?assets=legacy` (bàn tự dựng), `after-*` dùng KayKit. Giữ nguyên palette và lighting; không dùng bộ surfaceMaterials đã bị từ chối.

- `room-lit`: tên tệp được giữ từ driver, thực tế là góc 90° nhìn phong bì trên bàn sau bật đèn, **không phải phòng mở đầu**.
- `slot`: góc thấp sát khe bì, sẵn sàng kéo.
- `reader`: chính diện HTML lá thư.

Kiểm tra độc lập xác nhận camera/cue/phase và reader bounds khớp giữa hai chế độ. Mục đích là đối chiếu thay model bàn, không khẳng định đã áp một pass texture mới cho mọi vật.

Kéo native trên build cuối: kéo ngắn → ready; pointercancel → ready; kéo dài qua ngưỡng → reading. Không lỗi JS/console/HTTP; model KayKit trả HTTP 200. Khe hai vai phong bì đã đóng.
