import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { buildSeedSql } from './gen-seed-sql.js'

it('T-04: supabase/seed.sql khớp server/data/seed.js (chạy npm run db:seed-sql nếu lệch)', () => {
  const onDisk = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8')
  expect(onDisk).toBe(buildSeedSql())
})
