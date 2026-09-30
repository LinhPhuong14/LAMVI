// Sinh supabase/seed.sql từ server/data/seed.js (T-04: hai nguồn phải khớp).
// Chạy: npm run db:seed-sql
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { products, faqEntries } from '../server/data/seed.js'

const lit = (v) => {
  if (v == null) return 'null'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'object') return `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`
  return `'${String(v).replaceAll("'", "''")}'`
}

export function buildSeedSql() {
  const lines = ['-- Tự sinh bởi scripts/gen-seed-sql.js — không sửa tay.', '']
  for (const p of products) {
    lines.push(
      `insert into public.products (id, slug, kind, status, price, tone, sort_order, name, description, badge) values (${[
        p.id, p.slug, p.kind, p.status, p.price, p.tone, p.sortOrder, p.name, p.description, p.badge,
      ].map(lit).join(', ')}) on conflict (id) do nothing;`,
    )
  }
  lines.push('')
  for (const f of faqEntries) {
    lines.push(
      `insert into public.faq_entries (id, sort_order, is_published, question, answer) values (${[
        f.id, f.sortOrder, f.isPublished, f.question, f.answer,
      ].map(lit).join(', ')}) on conflict (id) do nothing;`,
    )
  }
  return lines.join('\n') + '\n'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = fileURLToPath(new URL('../supabase/seed.sql', import.meta.url))
  writeFileSync(out, buildSeedSql())
  console.log(`Đã ghi ${out}`)
}
