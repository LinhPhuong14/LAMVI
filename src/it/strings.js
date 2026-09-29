// D-51: dashboard IT — giao diện chỉ tiếng Việt (như admin, D-48) [ASSUMPTION]
export const S = {
  title: 'Dashboard IT',
  nav: { admin: '← Quản trị nội dung', site: 'Về trang web' },
  loading: 'Đang tải…',
  refresh: 'Làm mới',
  autoRefresh: 'Tự làm mới mỗi 30 giây',
  updatedAt: 'Cập nhật lúc {time}',
  forbiddenTitle: 'Không có quyền truy cập',
  forbiddenText: 'Chỉ tài khoản có vai trò IT mới vào được dashboard này (D-51).',
  health: {
    title: 'Sức khoẻ hệ thống',
    overall: { ok: 'Hoạt động bình thường', degraded: 'Có thành phần gặp sự cố' },
    checks: {
      database: 'Cơ sở dữ liệu',
      auth: 'Xác thực (Auth)',
      storage: 'Lưu trữ video (Storage)',
      payos: 'payOS',
      openai: 'OpenAI (Mây)',
    },
    status: {
      ok: 'Tốt',
      error: 'Lỗi',
      not_integrated: 'Chưa tích hợp',
      not_configured: 'Chưa có khoá',
      disabled: 'Admin đang tắt',
    },
    budget: 'Ngân sách tháng: {cost} / {budget} USD ({pct}%)',
    configured: 'Đã có cấu hình',
    notConfigured: 'Chưa có cấu hình',
    memoryMode: 'Đang chạy dữ liệu bộ nhớ (chưa cấu hình Supabase) — dữ liệu mất khi khởi động lại',
    latency: '{ms} ms',
    system: 'Máy chủ',
    version: 'Phiên bản',
    commit: 'Commit',
    node: 'Node.js',
    env: 'Môi trường',
    uptime: 'Thời gian chạy',
    memory: 'Bộ nhớ (RSS / heap)',
    startedAt: 'Khởi động lúc',
  },
  maintenance: {
    title: 'Chế độ bảo trì',
    on: 'ĐANG BẬT — khách thấy trang bảo trì, API ghi trả 503',
    off: 'Đang tắt',
    turnOn: 'Bật bảo trì',
    turnOff: 'Tắt bảo trì',
    confirmOn: 'Bật chế độ bảo trì? Khách sẽ không dùng được web cho tới khi tắt.',
    confirmOff: 'Tắt chế độ bảo trì?',
    hint: 'Khi bật: trang công khai trả 503; API chỉ cho đọc. Đăng nhập, /admin và /it vẫn dùng được (D-54).',
    changedAt: 'Đổi lần cuối: {time}',
  },
  metrics: {
    title: 'Số liệu API',
    ranges: { '1h': '1 giờ', '24h': '24 giờ', '7d': '7 ngày' },
    total: 'Tổng request',
    errorRate: 'Tỷ lệ lỗi 5xx',
    p95: 'Độ trễ p95',
    avg: 'Độ trễ trung bình',
    empty: 'Chưa có request trong khoảng này.',
    cols: {
      route: 'Endpoint',
      count: 'Request',
      s4xx: '4xx',
      s5xx: '5xx',
      errorRate: 'Lỗi 5xx',
      p50: 'p50',
      p95: 'p95',
      max: 'Max',
    },
    note: 'Độ trễ p50/p95 ước lượng theo mốc 50/100/250/500/1000/2500 ms. Số liệu lưu 30 ngày.',
  },
  errors: {
    title: 'Lỗi 5xx gần đây',
    empty: 'Không có lỗi 5xx trong khoảng này.',
    cols: { at: 'Thời điểm', route: 'Endpoint', path: 'Đường dẫn', status: 'Mã', code: 'Mã lỗi', message: 'Chi tiết' },
  },
}

export const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m)

export function formatDuration(sec) {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return [d && `${d} ngày`, h && `${h} giờ`, `${m} phút`].filter(Boolean).join(' ')
}
