// @vitest-environment jsdom
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
import CartProvider from './CartProvider.jsx'
import {useCart} from './context.js'
const mocks=vi.hoisted(()=>({authedApi:vi.fn(),user:{id:'u1'}}))
vi.mock('../auth/context.js',()=>({useAuth:()=>({user:mocks.user,authedApi:mocks.authedApi})}))
vi.mock('../api/client.js',()=>({api:vi.fn()}))
vi.mock('../i18n/index.js',()=>({useI18n:()=>({lang:'vi'})}))
function Probe(){const {add,cart}=useCart();return <><button onClick={()=>add('a')}>add</button><output>{cart?.items[0]?.quantity??0}</output></>}
it('two rapid add clicks increment twice after queued confirmation',async()=>{
 localStorage.clear()
 let resolveFirst
 mocks.authedApi.mockImplementation((url,options)=>{
   if(!options)return Promise.resolve({items:[],subtotal:0})
   const quantity=options.body.quantity
   if(quantity===1&&!resolveFirst)return new Promise(resolve=>{resolveFirst=resolve})
   return Promise.resolve({items:[{slug:'a',quantity}],subtotal:quantity*1000})
 })
 render(<CartProvider><Probe/></CartProvider>)
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('0'))
 fireEvent.click(screen.getByText('add'))
 await waitFor(()=>expect(resolveFirst).toBeTypeOf('function'))
 fireEvent.click(screen.getByText('add'))
 await act(async()=>resolveFirst({items:[{slug:'a',quantity:1}],subtotal:1000}))
 await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('2'))
 expect(mocks.authedApi.mock.calls.filter(([,options])=>options).map(([,options])=>options.body.quantity)).toEqual([1,2])
})
