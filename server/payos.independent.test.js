import {expect,it} from 'vitest'
import {parseWebhook,signData} from './adapters/payos.js'
it('unsigned envelope status cannot assert payment success for a signed payload without status',()=>{
 const data={orderCode:123,amount:1000,reference:'signed-reference'}
 const signature=signData(data,'test-key')
 for(const code of ['00','01'])expect(parseWebhook({data,signature,code},'test-key')).toMatchObject({ok:true,paid:false})
})
