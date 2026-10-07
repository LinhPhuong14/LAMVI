// @vitest-environment jsdom
import {lazy} from 'react'
import {render,screen,fireEvent} from '@testing-library/react'
import {MemoryRouter,Link,useLocation} from 'react-router-dom'
import {expect,it,vi} from 'vitest'
import RouteLoader from './RouteLoader.jsx'
import {LocaleContext} from '../i18n/index.js'
function Failed(){throw new Error('chunk load failed')}
function App(){const {pathname}=useLocation();return <><Link to="/account">account</Link><RouteLoader>{pathname==='/checkout'?<Failed/>:<p>Healthy account</p>}</RouteLoader></>}
it('chunk failure does not trap subsequent navigation to a healthy route',()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{})
 render(<MemoryRouter initialEntries={['/checkout']}><App/></MemoryRouter>)
 expect(screen.getByRole('alert')).toBeInTheDocument()
 fireEvent.click(screen.getByText('account'))
 expect(screen.getByText('Healthy account')).toBeInTheDocument()
 log.mockRestore()
})
it('suspended private page announces loading without rendering error',()=>{
 const Pending=lazy(()=>new Promise(()=>{}))
 render(<MemoryRouter><LocaleContext.Provider value="en"><RouteLoader><Pending/></RouteLoader></LocaleContext.Provider></MemoryRouter>)
 expect(screen.getByRole('status')).toHaveAttribute('aria-busy','true')
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('failed private chunk presents localized reload action',()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{})
 render(<MemoryRouter><LocaleContext.Provider value="zh"><RouteLoader><Failed/></RouteLoader></LocaleContext.Provider></MemoryRouter>)
 expect(screen.getByRole('button',{name:'重新加载'})).toBeInTheDocument()
 log.mockRestore()
})
