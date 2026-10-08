// Feedback 08/10, 33.4: giao diện admin/IT không hiện mã tài liệu đặc tả (D-xx, Q-xx, §xx, BR-xx)
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('Chuỗi giao diện admin/IT', () => {
  for (const file of ['src/admin/strings.js', 'src/it/strings.js']) {
    it(`${file} không chứa mã đặc tả`, () => {
      const lines = readFileSync(file, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//'))
      const bad = lines.filter((l) => /\b[DIQ]-\d{2}\b|§\d|\bBR-[A-Z]+-\d+/.test(l))
      expect(bad).toEqual([])
    })
  }
})
