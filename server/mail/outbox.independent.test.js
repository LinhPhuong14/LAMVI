import { expect, it, vi } from 'vitest'
import { createNotificationWorker } from './outbox.js'

it('does not deliver a persisted retry whose attempt budget is already exhausted', async () => {
  const date = new Date('2026-10-07T10:00:00Z')
  const job = { id:'job1',order_id:'o1',event:'confirmed',attempts:7,created_at:date.toISOString(),lease_token:'lease',snapshot:{code:'LV1',total:1000},delivery_payload:{to:'owner@example.test',subject:'Frozen',idempotencyKey:'lamvi-order-job1'} }
  const outbox = { claim:vi.fn(async()=>[job]),settle:vi.fn(async()=>[{id:job.id}]) }
  const repo = { getOrderById:async()=>({userId:'u1',items:[]}),getProfile:async()=>({email:'owner@example.test'}) }
  const mailer = {send:vi.fn(async()=>({id:'provider'}))}
  await createNotificationWorker({outbox,repo,mailer,siteUrl:'https://lamvi.test',now:()=>date})()
  expect(mailer.send).not.toHaveBeenCalled()
  expect(outbox.settle).toHaveBeenCalledWith(job,expect.objectContaining({status:'dead',last_error:'RETRY_EXHAUSTED'}))
})
