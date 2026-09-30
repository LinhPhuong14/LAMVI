/**
 * Đầu trang nội bộ: tiêu đề (kèm eyebrow khi cần) và một nét mảnh bên dưới — cùng cách trình bày
 * với đầu vùng nội dung của dashboard tài khoản (design-rules §12).
 *
 * `eyebrow` chỉ dùng khi nó nói thêm điều gì, ví dụ trang chi tiết đơn: eyebrow "Đơn hàng" +
 * tiêu đề là mã đơn. Trang cấp một KHÔNG đặt eyebrow — thanh bên đã cho biết đang ở đâu rồi,
 * lặp lại chỉ là nhiễu.
 *
 * @param {object} p
 * @param {string} p.title
 * @param {string} [p.eyebrow]
 * @param {import('react').ReactNode} [p.children] hành động bên phải (nút, ô lọc)
 */
export default function PageHead({ title, eyebrow, children }) {
  return (
    <header className="admin-head">
      <div>
        {eyebrow && <span className="admin-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  )
}
