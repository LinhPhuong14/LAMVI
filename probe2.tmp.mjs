import request from 'supertest'
import { createApp } from './server/app.js'
import { createWeb } from './server/ssr.js'
import { createMemoryRepo } from './server/adapters/memory/repo.js'
const repo = createMemoryRepo()
const config = { publicSiteUrl: 'https://lamvi.test', gaMeasurementId: 'G-TEST12345' }
const web = await createWeb({ repo, config, dev: true })
const app = createApp({ repo, config, web, dev: false })
for (const p of ['/admin','/ADMIN','/Admin/products','/it','/IT','/Account','/CART','/Login','/en/ACCOUNT']) {
  const r = await request(app).get(p)
  console.log(p.padEnd(16), r.status, '| cc=', (r.headers['cache-control']||'').padEnd(52), '| xrt=', r.headers['x-robots-tag'], '| ga=', r.text.includes('googletagmanager'), '| noindexMeta=', /name="robots" content="noindex"/.test(r.text))
}
