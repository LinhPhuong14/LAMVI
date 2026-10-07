import {expect,it,vi} from 'vitest'
import {createMessageService} from './messages/service.js'
it('recalculates download TTL after a slow playback signing call',async()=>{
 let clock=new Date('2026-10-07T00:00:00Z')
 const message={text:'Greeting',confirmedAt:new Date(clock.getTime()-30*86400000+10000).toISOString(),voicePath:'owner/order/audio.mp3',voiceType:'audio/mpeg'}
 const repo={getOrderByQrToken:async()=>({id:'order',status:'delivered',orderKind:'gift',hasMessage:true}),getGiftMessage:async()=>message}
 const storage={signedUrl:vi.fn(async()=>{clock=new Date(clock.getTime()+2000);return 'signed'}),removeObject:vi.fn()}
 await createMessageService({repo,storage,now:()=>clock}).view('a'.repeat(64))
 expect(storage.signedUrl.mock.calls.map(call=>call[2].expiresIn)).toEqual([10,8])
})
