/**
 * Nền không khí cho trang nội bộ (`/admin`, `/it`). Dùng lại bộ ảnh CC0 có sẵn
 * (`public/images/scene/CREDITS.md`) nhưng dựng KHÁC hẳn dashboard tài khoản:
 *
 * | | /account (DashSky) | Trang nội bộ (ở đây) |
 * |---|---|---|
 * | Bố cục | Ảnh trời phủ đầu trang, cuộn đi khi kéo xuống | Ảnh **cố định** sau toàn khung nhìn, không trôi theo nội dung |
 * | Ảnh | `dash/mist-mountain` (núi sương) | `scene/halong-mist` (sương vịnh) — cùng bộ CC0, ảnh khác |
 * | Tông | Ấm sepia, sáng lên | **Lạnh**, giảm bão hoà, mờ hơn — để bảng số liệu dày chữ vẫn dễ đọc |
 * | Chuyển động | 3 lớp khói trôi + 8 đèn trời bay lên | **Một** dải khói mực trôi rất chậm; không đèn trời (đây là công cụ, không phải trang hội) |
 *
 * Chỉ trang trí → `aria-hidden`, `alt` rỗng. Chuyển động bằng `transform`, tắt khi giảm chuyển động.
 */
export default function AdminAtmosphere() {
  return (
    <div className="admin-atmo" aria-hidden="true">
      <div className="admin-atmo-photo" />
      <img
        className="admin-atmo-ink"
        src="/images/scene/smoke-ink.webp"
        alt=""
        decoding="async"
        loading="lazy"
      />
    </div>
  );
}
