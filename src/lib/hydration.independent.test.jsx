// @vitest-environment jsdom
import {useId} from 'react'
import {renderToString} from 'react-dom/server'
import {hydrateRoot,createRoot} from 'react-dom/client'
import {act,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {MotionConfig} from 'framer-motion'
import {useHydratedReducedMotion} from './hydration.js'
import AuthProvider from '../auth/AuthProvider.jsx'
import {useAuth} from '../auth/context.js'
const session={accessToken:'existing-local-access-token',expiresAt:Date.now()+3600000,user:{id:'persisted-user',email:'saved@example.test'}}
function Probe(){const {user}=useAuth();const reduced=useHydratedReducedMotion();const id=useId();return <><header>{user?'Account':'Login'}</header>{!reduced&&<aside>Motion ornament</aside>}<label htmlFor={id}>Name</label><input id={id}/></>}
const app=<MotionConfig reducedMotion="user"><AuthProvider><Probe/></AuthProvider></MotionConfig>
afterEach(()=>{localStorage.clear();vi.restoreAllMocks()})
it('hydrates server anonymous markup with reduced motion and persisted session without mismatches or broken IDs',async()=>{
 vi.spyOn(window,'matchMedia').mockImplementation((query)=>({matches:query==='(prefers-reduced-motion)',media:query,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}))
 localStorage.setItem('moc.session',JSON.stringify(session))
 const serverHTML=renderToString(app)
 expect(serverHTML).toContain('Login')
 expect(serverHTML).toContain('Motion ornament')
 const container=document.createElement('div');container.innerHTML=serverHTML;document.body.append(container)
 const idBefore=container.querySelector('input').id
 const recoverable=vi.fn();const error=vi.spyOn(console,'error').mockImplementation(()=>{})
 let root
 await act(async()=>{root=hydrateRoot(container,app,{onRecoverableError:recoverable})})
 await waitFor(()=>expect(container.querySelector('header')).toHaveTextContent('Account'))
 expect(container.textContent).not.toContain('Motion ornament')
 expect(container.querySelector('input').id).toBe(idBefore)
 expect(container.querySelector('label').htmlFor).toBe(idBefore)
 expect(recoverable).not.toHaveBeenCalled()
 expect(error.mock.calls.filter(args=>/hydrat|mismatch|didn't match|did not match/i.test(args.join(' ')))).toEqual([])
 await act(async()=>root.unmount());container.remove()
})
it('private CSR starts with existing session on its first rendered commit',async()=>{
 localStorage.setItem('moc.session',JSON.stringify(session))
 const container=document.createElement('div');document.body.append(container)
 const renders=[]
 function SessionProbe(){const {user}=useAuth();renders.push(user?.id??null);return null}
 const root=createRoot(container)
 await act(async()=>root.render(<AuthProvider><SessionProbe/></AuthProvider>))
 expect(renders[0]).toBe(session.user.id)
 await act(async()=>root.unmount());container.remove()
})
