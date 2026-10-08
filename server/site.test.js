import { expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { publicSite } from './services/site.js'

it('projects only validated public contact data, excluding credentials and arbitrary config fields', async () => {
  const config = { mail: { from: 'sender-private@example.com', resendApiKey: 'secret-provider-key', brand: { legalName: 'Real company', supportEmail: 'support@example.com', phone: '+84 123456789', facebookUrl: 'https://facebook.com/example', instagramUrl: 'javascript:alert(1)', leakedSecret: 'private-brand-value' } }, supabase: { serviceRoleKey: 'private-db-key' } }
  const res = await request(createApp({ repo: createMemoryRepo(), config })).get('/api/site')
  expect(res.status).toBe(200)
  expect(res.body).toMatchObject({ legalName: 'Real company', supportEmail: 'support@example.com', social: [{ label: 'Facebook', url: 'https://facebook.com/example' }] })
  for (const secret of ['secret-provider-key', 'private-brand-value', 'private-db-key', 'sender-private', 'javascript:']) expect(res.text).not.toContain(secret)
  expect(res.headers['cache-control']).toContain('s-maxage=300')
})

it('does not invent company identity, support channels or social URLs', () => {
  expect(publicSite()).toEqual({ name: 'LAMVI', legalName: '', address: '', registration: '', workshopAddress: '', moitUrl: '', zalo: '', contactForm: false, supportEmail: '', phone: '', hours: '', social: [] })
})
