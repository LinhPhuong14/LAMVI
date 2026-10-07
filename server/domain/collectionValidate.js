import { parseI18n, TONES } from './admin.js'

// D-96/D-97: reward is edited by admin, never included in public projections.
export function validateCollection(body, { partial = false } = {}) {
  const values = {}, errors = {}
  const put = (key, check) => {
    if (partial && body[key] === undefined) return
    const result = check(body[key])
    if (result.error) errors[key] = result.error
    else values[key] = result.value
  }
  put('slug', (v) => typeof v === 'string' && v.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? { value: v } : { error: 'INVALID_SLUG' })
  put('status', (v) => v === undefined ? { value: 'draft' } : ['draft', 'published', 'hidden'].includes(v) ? { value: v } : { error: 'INVALID' })
  put('tone', (v) => v == null || v === '' ? { value: null } : TONES.includes(v) ? { value: v } : { error: 'INVALID' })
  put('sortOrder', (v) => v === undefined ? { value: 0 } : Number.isInteger(v) && Math.abs(v) <= 100000 ? { value: v } : { error: 'INVALID' })
  for (const [key, max] of [['name', 120], ['description', 1000], ['storyTitle', 120], ['story', 10000]]) put(key, (v) => parseI18n(v, { max, required: key === 'name' }))
  return { values, errors }
}
