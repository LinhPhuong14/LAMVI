// Biểu tượng điều hướng trang nội bộ: nét 1,2px, cùng lối với biểu tượng tab ở dashboard tài khoản
// (design-rules §12). Chỉ trang trí — nhãn chữ bên cạnh mới là nội dung cho trình đọc màn hình.
const base = {
  className: 'admin-nav-icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
}

/** Đơn hàng: phiếu giao có dòng kẻ */
export const OrdersIcon = () => (
  <svg {...base}>
    <path d="M6 3h9l3 3v15H6z" />
    <path d="M15 3v3h3M9 11h6M9 15h6" />
  </svg>
)

/** Sản phẩm: chiếc đèn giấy */
export const ProductsIcon = () => (
  <svg {...base}>
    <path d="M12 3v2M12 19v2" />
    <path d="M8 6h8l1.5 6L16 18H8l-1.5-6z" />
    <path d="M6.5 12h11" />
  </svg>
)

/** Hỏi đáp: bong bóng thoại có dấu hỏi */
export const FaqIcon = () => (
  <svg {...base}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M10 8.5a2 2 0 1 1 2.6 1.9c-.5.2-.6.6-.6 1.1" />
    <path d="M12 13.6v.01" />
  </svg>
)

/** Lô đèn: cuộn phim */
export const BatchesIcon = () => (
  <svg {...base}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <path d="M3 10h18M3 14h18M8 6v12M16 6v12" />
  </svg>
)

/** Mã giảm giá: phiếu có răng cưa và dấu chéo */
export const CouponsIcon = () => (
  <svg {...base}>
    <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5z" />
    <path d="M14 9.5l-4 5" />
  </svg>
)

/** Mây: đám mây */
export const MayIcon = () => (
  <svg {...base}>
    <path d="M7.5 18h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A3.9 3.9 0 0 0 7.5 18z" />
  </svg>
)

/** Dashboard IT: nhịp tim trên màn hình */
export const ItIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="13" rx="1.5" />
    <path d="M6 11h3l1.5-3 2 6 1.5-3h3M9 21h6" />
  </svg>
)

/** Về trang web: mũi tên quay lại */
export const SiteIcon = () => (
  <svg {...base}>
    <path d="M10 6l-6 6 6 6M4 12h11a5 5 0 0 1 0 0" />
    <path d="M4 12h12" />
  </svg>
)

/** Truy cập: cột biểu đồ */
export const AnalyticsIcon = () => (
  <svg {...base}>
    <path d="M4 20h16" />
    <path d="M7 20v-7M12 20V6M17 20v-10" />
  </svg>
)
