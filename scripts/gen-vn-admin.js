// Sinh server/data/vnAdmin.js từ danh mục hành chính 2 cấp hiện hành (34 tỉnh/thành, phường/xã
// trực thuộc — hiệu lực từ 01/07/2025). Nguồn: https://provinces.open-api.vn/api/v2/?depth=2
// Chạy: node scripts/gen-vn-admin.js [đường-dẫn-json-đã-tải]   (không đối số thì tải từ mạng)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const SOURCE = 'https://provinces.open-api.vn/api/v2/?depth=2'

export function buildVnAdminJs(list) {
  const rows = list
    .map((p) => {
      const wards = p.wards.map((w) => [String(w.code), w.name])
      return `  { code: ${JSON.stringify(String(p.code))}, name: ${JSON.stringify(p.name)}, wards: ${JSON.stringify(wards)} },`
    })
    .join('\n')
  return `// Tự sinh bởi scripts/gen-vn-admin.js — không sửa tay. Nguồn: ${SOURCE}\n// Danh mục hành chính 2 cấp (G-46, D-99): tỉnh/thành → phường/xã. Ward: [mã, tên].\nexport const VN_PROVINCES = [\n${rows}\n]\n`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2]
  const list = JSON.parse(arg ? readFileSync(arg, 'utf8') : await (await fetch(SOURCE)).text())
  const out = fileURLToPath(new URL('../server/data/vnAdmin.js', import.meta.url))
  writeFileSync(out, buildVnAdminJs(list))
  console.log(`Đã ghi ${out}: ${list.length} tỉnh/thành, ${list.reduce((n, p) => n + p.wards.length, 0)} phường/xã`)
}
