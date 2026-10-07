import {expect,it,vi} from 'vitest'
import {createSupabaseRepo} from './adapters/supabase/repo.js'
it('Supabase cart lookup selects only unique requested IDs and preserves stock and collection mapping',async()=>{
 const catalog=Array.from({length:1200},(_,i)=>({id:`p${i}`,slug:`lamp-${i}`,kind:'single',status:'published',price:1000,name:{vi:`Lamp ${i}`},stock:i===1199?2:null,collection_slug:'sum-vay',piece_order:3}))
 let selected=[]
 const query={select:vi.fn(()=>query),in:vi.fn((field,ids)=>{selected=catalog.filter(row=>ids.includes(row[field]));return query}),then:(resolve,reject)=>Promise.resolve({data:selected,error:null}).then(resolve,reject)}
 const client={from:vi.fn(()=>query)}
 const repo=createSupabaseRepo(client)
 expect(await repo.getProductsByIds([])).toEqual([])
 expect(client.from).not.toHaveBeenCalled()
 const products=await repo.getProductsByIds(['p1199','p1199'])
 expect(query.in).toHaveBeenCalledWith('id',['p1199'])
 expect(products).toHaveLength(1)
 expect(products[0]).toMatchObject({id:'p1199',slug:'lamp-1199',stock:2,collectionSlug:'sum-vay',pieceOrder:3})
})
