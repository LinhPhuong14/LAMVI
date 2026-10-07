import { orderMail } from '../mail/templates.js'

// Chờ gửi thư tối đa chừng này rồi đi tiếp: webhook payOS và checkout không được treo vì nhà cung cấp thư chậm
const DEFAULT_WAIT_MS = 3000

/**
 * Thông báo đơn hàng qua email (§20, Q-24 → email, T-56). Gửi cho NGƯỜI MUA theo ngôn ngữ ưa thích của
 * tài khoản (D-41). Là việc phụ: lỗi/thiếu cấu hình chỉ ghi log, KHÔNG làm hỏng thao tác chính và không
 * để lộ nội dung lỗi (có thể chứa khoá API).
 *
 * Mỗi sự kiện chỉ được gọi từ chỗ đã chuyển trạng thái thành công (khoá lạc quan) nên webhook gửi lại
 * không sinh thêm thư.
 *
 * @param {{ repo: object, mailer: object|null, siteUrl: string, brand?: object|null, waitMs?: number }} deps
 */
export function createOrderNotifier({ repo, mailer, siteUrl, brand = null, waitMs = DEFAULT_WAIT_MS, worker = null }) {
  async function send(kind, order) {
    const profile = await repo.getProfile(order.userId)
    // Tài khoản cũ chưa có email ở hồ sơ → chưa gửi được (migration 010 đã điền cho hồ sơ có sẵn)
    if (!profile?.email) {
      console.warn(`[notify] ${kind} ${order.code}: hồ sơ chưa có email, bỏ qua`)
      return false
    }
    const mail = orderMail({ kind, lang: profile.preferredLocale, order, siteUrl, name: profile.fullName, brand })
    await mailer.send({ to: profile.email, ...mail })
    return true
  }

  /** Không bao giờ ném lỗi. Trả true nếu đã gửi. */
  return async function notify(kind, order) {
    if (!order) return false
    if (worker) {
      try { return (await worker({ orderId: order.id, limit: 1 })).sent > 0 }
      catch { console.error(`[notify] ${kind}: durable worker unavailable`); return false }
    }
    if (!mailer) return false
    let timer
    try {
      return await Promise.race([
        send(kind, order),
        new Promise((resolve) => {
          timer = setTimeout(() => {
            console.warn(`[notify] ${kind} ${order.code}: gửi chậm quá ${waitMs}ms, không chờ nữa`)
            resolve(false)
          }, waitMs)
        }),
      ])
    } catch (err) {
      // Chỉ ghi loại lỗi, không ghi message (có thể chứa đoạn khoá/tiêu đề yêu cầu)
      console.error(`[notify] ${kind} ${order.code}: gửi thư lỗi (${err?.name ?? 'Error'})`)
      return false
    } finally {
      clearTimeout(timer)
    }
  }
}
