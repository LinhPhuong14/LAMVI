// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LetterRoom from './LetterRoom'
import LetterReader from './LetterReader'
import { validateLetter } from './data'
import { withNameFallbacks } from '../letters/names.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { letterUrl, presentLetterForRecipient, validateLetterContent } from '../../server/domain/letter.js'

const base={recipientName:'Ngọc Ánh',senderName:'Minh',occasion:'anniversary',kind:'text',message:['Một lời nhắn sau merge.'],occasionData:{photos:[]}}
const media=reduce=>vi.fn(q=>({matches:reduce&&q.includes('reduce'),media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}))
const advance=async ms=>{for(let remaining=ms;remaining>0;remaining-=80)await act(async()=>{await vi.advanceTimersByTimeAsync(Math.min(80,remaining))})}
beforeEach(()=>{
  Object.defineProperty(window,'innerWidth',{configurable:true,value:960})
  Object.defineProperty(window,'innerHeight',{configurable:true,value:540})
  vi.stubGlobal('matchMedia',media(true))
})
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();window.location.hash=''})

describe('independent merged reader contracts',()=>{
  it('D147 empty names render accessible room fallbacks and afterLetter immediately with reduced motion', () => {
    const supplied={...base,recipientName:'',senderName:''}
    const letter=validateLetter(withNameFallbacks(supplied))
    const {container}=render(<LetterReader letter={letter} afterLetter={<button>Xem lại cách làm đèn</button>}/>)
    expect(screen.getByRole('heading',{level:2,name:'Gửi bạn,'})).toBeVisible()
    expect(screen.getByText('Một người thương bạn',{selector:'.lr-signature strong'})).toBeVisible()
    expect(container.querySelector('.lr-letter-content')).not.toHaveAttribute('inert')
    expect(screen.getByRole('button',{name:'Xem lại cách làm đèn'})).toBeEnabled()
    expect(supplied.recipientName).toBe('')
    expect(supplied.senderName).toBe('')
  })
  it('font title for Vietnamese names has no SVG and gates body until actual docking completes',async()=>{
    vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now());vi.stubGlobal('matchMedia',media(false))
    const {container}=render(<LetterReader letter={validateLetter(base)}/>)
    const title=screen.getByRole('heading',{name:'Gửi Ngọc Ánh,'})
    expect(title.querySelector('svg')).toBeNull()
    expect(title.querySelector('.lr-title-dynamic')).toHaveTextContent('Gửi Ngọc Ánh,')
    expect(title.querySelector('.lr-title-dynamic')).toHaveAttribute('aria-hidden','true')
    class CSSTransition {constructor(){this.playState='running'}}
    const transition=new CSSTransition();title.getAnimations=()=>[transition]
    const body=container.querySelector('.lr-letter-content')
    await advance(5600)
    expect(title).toHaveClass('is-docked');expect(body).toHaveAttribute('inert')
    transition.playState='finished';fireEvent.transitionEnd(title,{propertyName:'transform'})
    expect(body).not.toHaveAttribute('inert');expect(body).toHaveAttribute('aria-hidden','false')
    fireEvent.transitionEnd(title,{propertyName:'top'})
    expect(screen.getAllByRole('heading',{name:'Gửi Ngọc Ánh,'})).toHaveLength(1)
  })
  it('empty photos alone does not create an empty surprise; extras remain below the signature',()=>{
    const {container}=render(<LetterReader letter={validateLetter(base)} afterLetter={<button>Chi tiết chiếc đèn</button>}/>)
    expect(container.querySelector('.lr-surprise-trigger')).toBeNull()
    const extras=screen.getByRole('button',{name:'Chi tiết chiếc đèn'})
    expect(container.querySelector('.lr-signature').compareDocumentPosition(extras)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading',{name:'Một lời chúc từ LAMVI'})).toBeInTheDocument()
  })
  it.each([{}, {message:'Một kỷ niệm riêng.'}])('keeps postscript in reader and final note alongside surprise data %j',async occasionData=>{
    vi.useFakeTimers()
    const letter=validateLetter({...base,occasionData,postscript:'P.S. Nhớ dành một buổi tối cho mình.'})
    const {container}=render(<MemoryRouter initialEntries={['/phong-thu/3d?fallback=1']}><LetterRoom letter={letter} afterLetter={<button>Quay lại chuyện chiếc đèn</button>}/></MemoryRouter>)
    fireEvent.click(screen.getByRole('button',{name:'Chạm để bật đèn'}))
    await advance(25);await advance(25)
    fireEvent.click(screen.getByRole('button',{name:'Chạm vào phong bì để mở thư'}));await advance(25)
    fireEvent.click(screen.getByRole('button',{name:'Kéo mép giấy lên'}),{detail:0});await advance(25);await advance(25)
    const article=screen.getByRole('article')
    expect(within(article).getByText(letter.postscript)).toBeVisible()
    expect(within(article).getByRole('button',{name:'Quay lại chuyện chiếc đèn'})).toBeEnabled()
    fireEvent.click(within(article).getByRole('button',{name:'Mở kỷ niệm của chúng mình'}));await advance(25)
    fireEvent.click(screen.getByRole('button',{name:'Mở điều nhỏ dành cho bạn'}));await advance(25)
    const final=container.querySelector('.lr-final-note')
    expect(within(final).getByText(letter.postscript)).toBeVisible()
    if(occasionData.message)expect(within(final).getByText(occasionData.message)).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})

describe('independent merged route and QR defaults',()=>{
  it.each(['/phong-thu','/phong-thu/web'])('%s stays on the main web experience',async path=>{
    mockApi({});const {container}=renderAt(path)
    await waitFor(()=>expect(container.querySelector('.lw-page')).toBeInTheDocument())
    expect(container.querySelector('.lr-page')).toBeNull()
  })
  it('/phong-thu/3d keeps the room and its fallback independently accessible',async()=>{
    mockApi({});const {container}=renderAt('/phong-thu/3d?fallback=1')
    expect(await screen.findByRole('button',{name:'Chạm để bật đèn'})).toBeEnabled()
    expect(container.querySelector('.lr-page')).toBeInTheDocument();expect(container.querySelector('.lw-page')).toBeNull()
  })
  it.each([undefined,'web','room'])('new standalone data and QR representation retain template %s semantics',template=>{
    const input={...base,...(template?{template}:{})}
    const {value,errors}=validateLetterContent(input)
    expect(errors).toEqual({});expect(value.template).toBe(template||'web')
    const content=presentLetterForRecipient({id:'standalone-qa',orderId:null,label:'Thư lẻ',content:value})
    expect(content.template).toBe(template||'web');expect(content.recipientName).toBe(base.recipientName)
    const token='B'.repeat(43)
    expect(letterUrl({publicSiteUrl:'https://lamvi.test'},'abcdefghij',token)).toBe(`https://lamvi.test/thu/abcdefghij#${token}`)
    expect(content).not.toHaveProperty('orderId');expect(content).not.toHaveProperty('label')
  })
})
