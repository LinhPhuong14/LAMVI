import { api } from '../api/client.js'

// D-48, D-51: admin và IT đăng nhập xong vào thẳng khu quản trị, không qua dashboard tài khoản khách.
// Vai trò lấy từ /me (server đọc profiles.role mỗi request); chỉ để chọn trang đích — quyền thật vẫn do
// server kiểm ở mọi API /admin. Mọi lỗi (mạng, 5xx) → về trang mặc định, không chặn đăng nhập.
const STAFF_ROLES = ['admin', 'it']
export const ADMIN_HOME = '/admin'

/**
 * @param {string} accessToken token vừa được cấp
 * @param {string} fallback trang đích mặc định của khách hàng
 * @returns {Promise<string>}
 */
export async function landingPath(accessToken, fallback) {
  try {
    const res = await api('/me', { token: accessToken })
    return STAFF_ROLES.includes(res?.profile?.role) ? ADMIN_HOME : fallback
  } catch {
    return fallback
  }
}
