import {beforeEach,expect,it} from 'vitest'
import request from 'supertest'
import {createApp} from './app.js'
import {createMemoryRepo} from './adapters/memory/repo.js'
import {createMemoryAuth} from './adapters/memory/auth.js'
import {createMemoryStorage} from './adapters/memory/storage.js'
let app,repo,auth,admin,customer
beforeEach(async()=>{
 repo=createMemoryRepo();auth=createMemoryAuth()
 app=createApp({repo,auth,storage:createMemoryStorage(),config:{publicSiteUrl:'https://lamvi.test',rateLimit:{enabled:false}}})
 const login=async(email,role)=>{const {user}=await auth.signUp({email,password:'Gio-Hoa#Sen2026'});await repo.upsertProfile({id:user.id,role});return `Bearer ${(await auth.signIn({email,password:'Gio-Hoa#Sen2026'})).accessToken}`}
 admin=await login('admin@example.test','admin');customer=await login('customer@example.test','customer')
})
it('admin reward content stays private after publication and product assignment',async()=>{
 const created=await request(app).post('/api/admin/collections').set('Authorization',admin).send({slug:'private-reward',name:{vi:'Bộ mới'},status:'published',storyTitle:{vi:'REWARD-SECRET-TITLE'},story:{vi:'REWARD-SECRET-BODY'}})
 expect(created.status).toBe(201)
 const p=await repo.getProductBySlug('den-nguyet')
 await repo.updateProduct(p.id,{collectionSlug:'private-reward'})
 const publicResponse=await request(app).get('/api/collections/private-reward')
 expect(publicResponse.status).toBe(200)
 expect(JSON.stringify(publicResponse.body)).not.toContain('REWARD-SECRET')
 const audits=await repo.listAuditLog({entity:'collection',entityId:created.body.item.id})
 expect(JSON.stringify(audits)).not.toContain('REWARD-SECRET')
})
it('customer cannot read admin collection reward or write a collection',async()=>{
 expect((await request(app).get('/api/admin/collections').set('Authorization',customer)).status).toBe(403)
 expect((await request(app).post('/api/admin/collections').set('Authorization',customer).send({slug:'bad',name:{vi:'Bad'}})).status).toBe(403)
})
