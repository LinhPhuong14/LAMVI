// D-130: báo cáo theo kỳ (phễu mua hàng, người dùng theo ngày, kênh vào) từ GA4 `runReport`
import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { GaError, createGaRealtime } from './adapters/gaRealtime.js'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const creds = { propertyId: '123456', clientEmail: 'sa@p.iam.gserviceaccount.com', privateKey }
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })
const row = (dims, ...vals) => ({ dimensionValues: [].concat(dims).map((value) => ({ value })), metricValues: vals.map((v) => ({ value: String(v) })) })

function fakeGoogle({ apiStatus = 200 } = {}) {
  return vi.fn(async (url, init) => {
    if (String(url).includes('oauth2')) return json({ access_token: 'tok', expires_in: 3600 })
    if (apiStatus !== 200) return json({}, apiStatus)
    const body = JSON.parse(init.body)
    const dim = body.dimensions?.[0]?.name
    if (!dim) return json({ rows: [{ metricValues: [{ value: '120' }, { value: '900' }, { value: '300' }] }] })
    if (dim === 'eventName') return json({ rows: [row('add_to_cart', 30, 41), row('view_item', 100, 250), row('purchase', 5, 5)] })
    if (dim === 'date') return json({ rows: [row('20261025', 40), row('20261026', 55)] })
    return json({ rows: [row('Direct', 100), row('Organic Social', 200)] })
  })
}

describe('GA báo cáo theo kỳ', () => {
  it('gọi runReport với đúng khoảng ngày và chỉ lấy 4 sự kiện của phễu', async () => {
    const fetchImpl = fakeGoogle()
    await createGaRealtime({ ...creds, fetchImpl }).period(28)
    const calls = fetchImpl.mock.calls.filter(([u]) => String(u).includes('analyticsdata'))
    expect(calls.length).toBe(4)
    for (const [u, init] of calls) {
      expect(String(u)).toContain(':runReport')
      expect(JSON.parse(init.body).dateRanges).toEqual([{ startDate: '28daysAgo', endDate: 'today' }])
    }
    const ev = calls.map(([, i]) => JSON.parse(i.body)).find((b) => b.dimensions?.[0]?.name === 'eventName')
    expect(ev.dimensionFilter.filter.inListFilter.values).toEqual(['view_item', 'add_to_cart', 'begin_checkout', 'purchase'])
  })

  it('phễu đúng thứ tự bước, bước thiếu dữ liệu là 0; có tổng, ngày và kênh', async () => {
    const out = await createGaRealtime({ ...creds, fetchImpl: fakeGoogle() }).period(7)
    expect(out).toMatchObject({ configured: true, days: 7, users: 120, pageViews: 900, sessions: 300 })
    expect(out.funnel).toEqual([
      { name: 'view_item', users: 100, events: 250 },
      { name: 'add_to_cart', users: 30, events: 41 },
      { name: 'begin_checkout', users: 0, events: 0 },
      { name: 'purchase', users: 5, events: 5 },
    ])
    expect(out.daily).toEqual([{ date: '20261025', users: 40 }, { date: '20261026', users: 55 }])
    expect(out.channels[0]).toEqual({ name: 'Organic Social', value: 200 })
  })

  it('số ngày lạ quy về 7; cache 60 giây theo từng kỳ', async () => {
    let t = 1_000_000
    const fetchImpl = fakeGoogle()
    const ga = createGaRealtime({ ...creds, fetchImpl, now: () => t })
    expect((await ga.period(5)).days).toBe(7)
    await ga.period(7)
    const afterTwo = fetchImpl.mock.calls.filter(([u]) => String(u).includes('analyticsdata')).length
    expect(afterTwo).toBe(4)
    await ga.period(28)
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes('analyticsdata')).length).toBe(8)
    t += 61_000
    await ga.period(7)
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes('analyticsdata')).length).toBe(12)
  })

  it('lỗi hạn mức → GaError QUOTA, không cache lỗi', async () => {
    const ga = createGaRealtime({ ...creds, fetchImpl: fakeGoogle({ apiStatus: 429 }) })
    await expect(ga.period(7)).rejects.toBeInstanceOf(GaError)
    await expect(ga.period(7)).rejects.toMatchObject({ code: 'QUOTA' })
  })
})
