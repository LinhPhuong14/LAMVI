import {expect,it,vi} from 'vitest'
import {createMemoryRepo} from './adapters/memory/repo.js'
import {createMessageService} from './messages/service.js'
it('eligible keyset scan reaches expired media after more than 1000 unexpired records in bounded batches',async()=>{
 const now=new Date('2026-10-07T00:00:00Z')
 const orders=Array.from({length:1205},(_,i)=>({id:`o${i}`,status:'delivered',deliveredAt:now.toISOString()}))
 const repo=createMemoryRepo({orders})
 for(let i=0;i<orders.length;i++)await repo.upsertGiftMessage(orders[i].id,{voicePath:`private/${i}.mp3`,voiceType:'audio/mpeg',confirmedAt:new Date(now.getTime()-(i<1000?1:31)*86400000).toISOString()})
 const scan=vi.spyOn(repo,'listGiftMediaCandidates')
 const storage={removeObject:vi.fn(async()=>{})}
 const service=createMessageService({repo,storage,now:()=>now})
 for(let batch=0;batch<20;batch++)expect(await service.purgeExpiredMedia()).toBe(10)
 expect(await service.purgeExpiredMedia()).toBe(5)
 expect(storage.removeObject).toHaveBeenCalledTimes(205)
 for(const call of storage.removeObject.mock.calls)expect(Number(call[0].match(/\d+/)[0])).toBeGreaterThanOrEqual(1000)
 expect(scan.mock.calls.every(([args])=>args.limit===10)).toBe(true)
 expect((await repo.getGiftMessage('o0')).voicePath).toBe('private/0.mp3')
})
it('failed deletion remains eligible and retries after keyset cursor wraps',async()=>{
 const now=new Date('2026-10-07T00:00:00Z')
 const repo=createMemoryRepo({orders:[{id:'o1',status:'delivered',deliveredAt:now.toISOString()}]})
 await repo.upsertGiftMessage('o1',{voicePath:'private/retry.mp3',confirmedAt:new Date(now.getTime()-31*86400000).toISOString()})
 const storage={removeObject:vi.fn().mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValue(undefined)}
 const service=createMessageService({repo,storage,now:()=>now})
 const log=vi.spyOn(console,'error').mockImplementation(()=>{})
 expect(await service.purgeExpiredMedia()).toBe(0)
 expect((await repo.getGiftMessage('o1')).voicePath).toBe('private/retry.mp3')
 expect(await service.purgeExpiredMedia()).toBe(1)
 expect((await repo.getGiftMessage('o1')).voicePath).toBeNull()
 log.mockRestore()
})
