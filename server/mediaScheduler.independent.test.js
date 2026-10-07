import express from 'express'
import request from 'supertest'
import {describe,expect,it,vi} from 'vitest'
import {ordersRouter} from './routes/orders.js'
import {errorHandler} from './errors.js'
function fixture({secret='scheduler-secret',messages=true}={}){
 const worker={purgeExpiredMedia:vi.fn(async()=>3)}
 const orders={expirePendingOrders:vi.fn()}
 const notifications=vi.fn(),metrics={cleanup:vi.fn()}
 const app=express()
 app.use('/api',ordersRouter({repo:{},auth:{},orders,config:{cronSecret:secret,rateLimit:{enabled:false}},messages:messages?worker:null,notifications,metrics}))
 app.use(errorHandler)
 return {app,worker,orders,notifications,metrics}
}
describe('isolated media cleanup scheduler',()=>{
 it.each(['get','post'])('%s runs only cleanup after cron authentication',async method=>{
  const f=fixture()
  const response=await request(f.app)[method]('/api/internal/media-cleanup').set('Authorization','Bearer scheduler-secret')
  expect(response.status).toBe(200);expect(response.body).toEqual({mediaPurged:3})
  expect(f.worker.purgeExpiredMedia).toHaveBeenCalledTimes(1)
  expect(f.orders.expirePendingOrders).not.toHaveBeenCalled();expect(f.notifications).not.toHaveBeenCalled();expect(f.metrics.cleanup).not.toHaveBeenCalled()
 })
 it.each([undefined,'Bearer wrong','scheduler-secret'])('rejects invalid scheduler credentials',async credential=>{
  const f=fixture();const call=request(f.app).post('/api/internal/media-cleanup')
  if(credential)call.set('Authorization',credential)
  expect((await call).status).toBe(401);expect(f.worker.purgeExpiredMedia).not.toHaveBeenCalled()
 })
 it.each([{secret:null},{messages:false}])('missing runtime bindings disable endpoint',async options=>{
  const f=fixture(options)
  expect((await request(f.app).get('/api/internal/media-cleanup').set('Authorization','Bearer scheduler-secret')).status).toBe(404)
  expect(f.worker.purgeExpiredMedia).not.toHaveBeenCalled()
 })
 it('unsupported methods cannot invoke cleanup',async()=>{
  const f=fixture()
  expect((await request(f.app).delete('/api/internal/media-cleanup').set('Authorization','Bearer scheduler-secret')).status).toBe(405)
  expect(f.worker.purgeExpiredMedia).not.toHaveBeenCalled()
 })
 it('worker failure propagates instead of reporting successful cleanup',async()=>{
  const f=fixture();f.worker.purgeExpiredMedia.mockRejectedValue(new Error('database unavailable'))
  const log=vi.spyOn(console,'error').mockImplementation(()=>{})
  const response=await request(f.app).post('/api/internal/media-cleanup').set('Authorization','Bearer scheduler-secret')
  expect(response.status).toBe(500);expect(response.body).not.toHaveProperty('mediaPurged')
  log.mockRestore()
 })
})
