import { VN_PROVINCES } from '../data/vnAdmin.js'

// G-46, D-99: địa chỉ giao hàng chọn từ danh mục hành chính 2 cấp (tỉnh/thành → phường/xã).
// Client chỉ gửi mã; tên do server tra từ danh mục nên không thể gửi tên tự do hay sai cặp.
const PROVINCES = new Map(VN_PROVINCES.map((p) => [p.code, { ...p, wardMap: new Map(p.wards) }]))

export const listProvinces = () => VN_PROVINCES.map(({ code, name }) => ({ code, name }))

export function listWards(provinceCode) {
  const p = PROVINCES.get(String(provinceCode))
  return p ? p.wards.map(([code, name]) => ({ code, name })) : null
}

/** → { province, ward, provinceCode, wardCode } hoặc { errors } */
export function resolveAddress(provinceCode, wardCode) {
  const errors = {}
  const p = typeof provinceCode === 'string' ? PROVINCES.get(provinceCode) : undefined
  if (provinceCode === undefined || provinceCode === null || provinceCode === '') errors.provinceCode = 'REQUIRED'
  else if (!p) errors.provinceCode = 'INVALID'
  let ward
  if (wardCode === undefined || wardCode === null || wardCode === '') errors.wardCode = 'REQUIRED'
  else if (p) {
    ward = typeof wardCode === 'string' ? p.wardMap.get(wardCode) : undefined
    if (!ward) errors.wardCode = 'INVALID'
  }
  if (Object.keys(errors).length) return { errors }
  return { province: p.name, ward, provinceCode: p.code, wardCode }
}
