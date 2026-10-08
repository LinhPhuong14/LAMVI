import { describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler } from './errors.js'

function appThrowing(err) {
  const app = express()
  app.get('/x', (_req, _res, next) => next(err))
  app.use(errorHandler)
  return app
}

describe('errorHandler — lỗi thiếu schema', () => {
  it.each(['PGRST202', 'PGRST205', '42P01', '42703', '42883'])('mã %s → 503 SCHEMA_OUTDATED', async (code) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(appThrowing(Object.assign(new Error('missing'), { code }))).get('/x')
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('SCHEMA_OUTDATED')
  })

  it('lỗi lạ vẫn là 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(appThrowing(new Error('boom'))).get('/x')
    expect(res.status).toBe(500)
  })
})
