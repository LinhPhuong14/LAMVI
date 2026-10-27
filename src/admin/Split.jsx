// Bố cục chung của các trang quản trị dạng danh sách + biểu mẫu: danh sách ở trái, biểu mẫu mở ở ngăn bên phải
// (docs/knowledge/dashboard-ux.md). Dưới 1100 px ngăn bên phải hiện dưới danh sách; dưới 960 px chỉ hiện ngăn khi đang mở.
export default function Split({ aside, label, children }) {
  return (
    <div className={`admin-split${aside ? ' has-aside' : ''}`}>
      <div className="split-main">{children}</div>
      {aside && (
        <aside className="split-aside" aria-label={label}>
          {aside}
        </aside>
      )}
    </div>
  )
}
