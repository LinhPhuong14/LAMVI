import { Router } from 'express'
import { notFound } from '../errors.js'
import { listProvinces, listWards } from '../domain/address.js'

// G-46, D-99: danh mục hành chính cho form địa chỉ. Dữ liệu tĩnh nên cho CDN/trình duyệt cache dài.
export function geoRouter() {
  const r = Router()
  const cache = (res) => res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  r.get('/geo/provinces', (req, res) => {
    cache(res)
    res.json({ items: listProvinces() })
  })
  r.get('/geo/provinces/:code/wards', (req, res) => {
    const items = listWards(req.params.code)
    if (!items) throw notFound()
    cache(res)
    res.json({ items })
  })
  return r
}
