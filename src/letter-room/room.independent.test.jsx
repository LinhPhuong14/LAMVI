// @vitest-environment jsdom
// T-11: independent contract tests; no WebGL renderer is required for the fallback.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LetterRoom from './LetterRoom'
import { demos, initialState, occasions, roomReducer, validateLetter, PHASE_TIMINGS, shotForPhase } from './data'

const ready = { phase: 'ready', progress: 0 }
const step = (state, type, extra = {}) => roomReducer(state, { type, ...extra })

describe('independent room reducer contracts', () => {
  it('completes the ordered flow without mutating the initial state', () => {
    let state = Object.freeze({ ...initialState })
    for (const [action, phase] of [['LIGHT', 'lighting'], ['LIT', 'lit'], ['FOCUS_ENVELOPE', 'envelope'], ['APPROACH', 'approaching'], ['READY', 'ready'], ['OPEN', 'extracting'], ['EXTRACTED', 'lifting'], ['READ', 'reading'], ['SURPRISE', 'surpriseEntering'], ['SURPRISE_READY', 'surprise'], ['BLOW', 'celebrating'], ['CELEBRATED', 'celebrated']]) {
      state = step(state, action)
      expect(state.phase).toBe(phase)
    }
    expect(state.progress).toBe(1)
    expect(initialState).toEqual({ phase: 'dark', progress: 0 })
  })

  const validPhase = { LIGHT: 'dark', LIT: 'lighting', FOCUS_ENVELOPE: 'lit', APPROACH: 'envelope', READY: 'approaching', DRAG: 'ready', RELEASE: 'ready', RETURNED: 'returning', OPEN: 'ready', EXTRACTED: 'extracting', READ: 'lifting', SURPRISE: 'reading', SURPRISE_READY: 'surpriseEntering', BLOW: 'surprise', REVEAL: 'surprise', CELEBRATED: 'celebrating' }
  for (const phase of ['dark', 'lighting', 'lit', 'envelope', 'approaching', 'ready', 'returning', 'extracting', 'lifting', 'reading', 'surpriseEntering', 'surprise', 'celebrating', 'celebrated']) {
    it(`ignores stale, repeated and out-of-order events in ${phase}`, () => {
      const state = Object.freeze({ phase, progress: .25 })
      for (const [action, allowed] of Object.entries(validPhase)) {
        if (allowed !== phase) expect(step(state, action, { value: .8 })).toBe(state)
      }
      expect(step(state, 'UNKNOWN')).toBe(state)
    })
  }

  it('only schedules transitions between user-controlled scenes', () => {
    expect(PHASE_TIMINGS).toEqual({ lighting: ['LIT', 1800], lit: ['FOCUS_ENVELOPE', 900], approaching: ['READY', 1200], returning: ['RETURNED', 380], extracting: ['EXTRACTED', 420], lifting: ['READ', 1100], surpriseEntering: ['SURPRISE_READY', 1100], celebrating: ['CELEBRATED', 1100] })
    for (const phase of ['dark', 'envelope', 'ready', 'reading', 'surprise', 'celebrated']) expect(PHASE_TIMINGS[phase]).toBeUndefined()
  })
  it.each(['BLOW', 'REVEAL'])('%s completes only an explicitly opened surprise', action => {
    const state = { phase: 'surprise', progress: 1 }
    const result = step(state, action)
    expect(result).toEqual({ phase: 'celebrating', progress: 1 })
    expect(step(result, action)).toBe(result)
    expect(step(result, 'CELEBRATED')).toEqual({ phase: 'celebrated', progress: 1 })
  })
  it('locks camera shots to the six scene groups and branches for the lamp surprise', () => {
    for (const [shot, phases] of Object.entries({ room: ['dark', 'lighting', 'lit', 'envelope', 'approaching', 'ready', 'returning', 'extracting'], letter: ['lifting', 'reading'], reverse: ['surpriseEntering', 'surprise', 'celebrating', 'celebrated'] })) {
      for (const phase of phases) expect(shotForPhase(phase, 'birthday')).toBe(shot)
    }
    for (const phase of ['surpriseEntering', 'surprise', 'celebrating', 'celebrated']) expect(shotForPhase(phase, 'justBecause')).toBe('lamp')
  })
  it.each([[-2, 0], [0, 0], [.399, .399], [1, 1], [3, 1]])('clamps finite drag %s to %s', (value, expected) => {
    expect(step(ready, 'DRAG', { value }).progress).toBe(expected)
  })
  it.each([[.399, 'returning', 0], [.4, 'extracting', 1], [.401, 'extracting', 1]])('settles a release at %s', (progress, phase, end) => {
    expect(step({ ...ready, progress }, 'RELEASE')).toEqual({ phase, progress: end })
  })
  it('cancel wins above the completion threshold and allows a fresh drag', () => {
    const cancelled = step({ ...ready, progress: .99 }, 'RELEASE', { cancel: true })
    expect(cancelled).toEqual({ phase: 'returning', progress: 0 })
    expect(step(cancelled, 'OPEN')).toBe(cancelled)
    expect(step(cancelled, 'RETURNED')).toEqual(ready)
  })
  it.each([NaN, undefined, 'invalid'])('rejects a nonnumeric drag value %s instead of poisoning scene coordinates', value => {
    const result = step(ready, 'DRAG', { value })
    expect(Number.isFinite(result.progress)).toBe(true)
  })
})

describe('independent letter validation contracts', () => {
  it('all seven Vietnamese demos validate, including a long letter and video', () => {
    expect(Object.keys(demos)).toHaveLength(7)
    for (const [occasion, letter] of Object.entries(demos)) {
      expect(validateLetter(letter).occasion).toBe(occasion)
      expect(occasions[occasion]).toBeTruthy()
    }
    expect(demos.birthday.message.join('\n').length).toBeGreaterThan(600)
    expect(demos.longDistance.kind).toBe('video')
  })
  it('normalizes absent occasion data without mutating the caller', () => {
    const letter = { ...demos.anniversary, occasionData: undefined }
    expect(validateLetter(letter).occasionData).toEqual({})
    expect(letter.occasionData).toBeUndefined()
  })
  it.each([null, {}, { ...demos.birthday, message: [42] }, { ...demos.birthday, kind: 'audio' }, { ...demos.birthday, occasion: 'other' }])('rejects missing or invalid required fields %#', value => {
    expect(() => validateLetter(value)).toThrow()
  })
  it.each(['javascript:alert(1)', '//untrusted.test/video', 'http://example.test/video', ''])('rejects unsupported video URL %s', videoUrl => {
    expect(() => validateLetter({ ...demos.longDistance, videoUrl })).toThrow()
  })
  it.each(['toString', 'constructor', '__proto__'])('rejects inherited object key as occasion: %s', occasion => {
    expect(() => validateLetter({ ...demos.birthday, occasion })).toThrow()
  })
  it.each([['anniversary', { photos: 'broken' }], ['anniversary', { photos: [42] }], ['longDistance', { places: {} }]])('rejects malformed %s optional content before render: %j', (occasion, occasionData) => {
    expect(() => validateLetter({ ...demos[occasion], occasionData })).toThrow()
  })
})

describe('independent DOM manual interaction contracts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', {configurable:true,value:960})
    Object.defineProperty(window, 'innerHeight', {configurable:true,value:540})
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches:true,addEventListener(){},removeEventListener(){}})))
  })
  afterEach(() => {cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
  const advance = async ms => {await act(async()=>{await vi.advanceTimersByTimeAsync(ms)})}
  const phase = () => document.querySelector('main').dataset.phase
  function mount(query='') {return render(<MemoryRouter initialEntries={[`/phong-thu?fallback=1${query}`]}><LetterRoom/></MemoryRouter>)}
  async function reachPaper(query='') {
    const view=mount(query)
    fireEvent.click(screen.getByRole('button',{name:'Chạm để bật đèn'}))
    await advance(2000);await advance(1000)
    expect(phase()).toBe('envelope')
    fireEvent.click(screen.getByRole('button',{name:'Chạm vào phong bì để mở thư'}))
    await advance(1500)
    expect(phase()).toBe('ready')
    return view
  }
  async function openLetter(query='') {
    const view=await reachPaper(query)
    fireEvent.keyDown(screen.getByRole('button',{name:'Kéo mép giấy lên'}),{key:'Enter'})
    await advance(500);await advance(1200);await advance(5600)
    expect(screen.getByRole('article',{name:'Lời chúc gửi Linh'})).toHaveFocus()
    return view
  }
  async function reveal(label, cue='Mở điều nhỏ dành cho bạn') {
    const trigger=screen.getByRole('button',{name:label})
    fireEvent.click(trigger);fireEvent.click(trigger)
    expect(phase()).toBe('surpriseEntering')
    await advance(1200)
    expect(phase()).toBe('surprise')
    fireEvent.click(screen.getByRole('button',{name:cue}))
    await advance(1200)
    expect(phase()).toBe('celebrated')
  }
  it.each([false,true])('waits for user at every manual boundary, reduced=%s',async reduced=>{
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:reduced,addEventListener(){},removeEventListener(){}})))
    mount()
    await advance(10000);expect(phase()).toBe('dark')
    const light=screen.getByRole('button',{name:'Chạm để bật đèn'})
    light.focus();expect(light).toHaveFocus()
    fireEvent.click(light);fireEvent.click(light)
    for(const [time,next] of [[1800,'lit'],[900,'envelope']]){await advance(reduced?25:time);expect(phase()).toBe(next)}
    await advance(10000);expect(phase()).toBe('envelope')
    fireEvent.click(screen.getByRole('button',{name:'Chạm vào phong bì để mở thư'}))
    await advance(reduced?25:1200);expect(phase()).toBe('ready')
    await advance(10000);expect(phase()).toBe('ready')
    const paper=screen.getByRole('button',{name:'Kéo mép giấy lên'})
    fireEvent.click(paper,{detail:0});fireEvent.click(paper,{detail:0})
    await advance(reduced?25:420);expect(phase()).toBe('lifting')
    await advance(reduced?25:1100);expect(phase()).toBe('reading')
    await advance(10000);expect(phase()).toBe('reading')
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })
  it.each(['Enter',' '])('opens paper with keyboard %j',async key=>{
    await reachPaper();const paper=screen.getByRole('button',{name:'Kéo mép giấy lên'})
    fireEvent.keyDown(paper,{key});fireEvent.keyDown(paper,{key})
    await advance(500);await advance(1200)
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })
  it.each([['short',30,false,false],['threshold',60,false,true],['cancel',100,true,false],['tap',0,false,true]])('settles captured %s gesture',async(_label,distance,cancel,opens)=>{
    await reachPaper();const paper=screen.getByRole('button',{name:'Kéo mép giấy lên'})
    let captured=false
    paper.setPointerCapture=vi.fn(()=>{captured=true});paper.hasPointerCapture=()=>captured;paper.releasePointerCapture=vi.fn(()=>{captured=false})
    function pointer(type,y,id=7){const event=new MouseEvent(type,{bubbles:true,button:0,clientX:100,clientY:y});Object.defineProperty(event,'pointerId',{value:id});fireEvent(paper,event)}
    pointer('pointerdown',200);pointer('pointermove',0,99)
    if(distance)pointer('pointermove',200-distance)
    pointer(cancel?'pointercancel':'pointerup',200-distance)
    await advance(500);await advance(1200)
    expect(paper.setPointerCapture).toHaveBeenCalledWith(7)
    expect(paper.releasePointerCapture).toHaveBeenCalledWith(7)
    expect(phase()).toBe(opens?'reading':'ready')
  })
  it('cleans timers on unmount',async()=>{const view=mount();fireEvent.click(screen.getByRole('button',{name:'Chạm để bật đèn'}));view.unmount();await advance(10000);expect(vi.getTimerCount()).toBe(0)})
  it('birthday waits for the candle and reveals the final note',async()=>{
    await openLetter('&occasion=birthday')
    fireEvent.click(screen.getByRole('button',{name:'Mở tấm thiệp nhỏ'}))
    await advance(1200);await advance(10000)
    expect(phase()).toBe('surprise')
    expect(screen.queryByText(demos.birthday.occasionData.message)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Chạm để tắt nến'}));await advance(1200)
    expect(screen.getByRole('status')).toHaveTextContent(demos.birthday.occasionData.message)
  })
  it.each([['anniversary','Mở kỷ niệm của chúng mình'],['thankYou','Lật góc thư'],['milestone','Đóng dấu cột mốc'],['encouragement','Mở khi cần'],['justBecause','Có một điều nhỏ nữa']])('opens %s only on request',async(occasion,label)=>{
    await openLetter(`&occasion=${occasion}`)
    await reveal(label,occasion==='justBecause'?'Chạm vào hình trên đèn':'Mở điều nhỏ dành cho bạn')
    expect(screen.getByRole('status')).toHaveTextContent(demos[occasion].occasionData.message)
    if(occasion==='anniversary'){expect(screen.getByText(demos.anniversary.occasionData.date)).toBeVisible();expect(screen.queryByRole('img')).not.toBeInTheDocument()}
  })
  it('empty data leaves a complete letter without surprise trigger',async()=>{
    const {container}=await openLetter('&empty=1')
    expect(screen.getByText('An',{selector:'strong'})).toBeVisible()
    expect(container.querySelector('.lr-surprise-trigger')).toBeNull()
  })
  it('renders one dedication with underline and complete accessible paragraphs',async()=>{
    const {container}=await openLetter()
    expect(screen.getAllByRole('heading',{name:'Gửi Linh,'})).toHaveLength(1)
    expect(screen.queryByText('Gửi bạn,')).not.toBeInTheDocument()
    expect(container.querySelector('.lr-title-ink svg path')).toBeInTheDocument()
    const content=container.querySelector('.lr-letter-content')
    expect(content).toHaveAttribute('aria-hidden','false');expect(content).not.toHaveAttribute('inert')
    expect(content.querySelector('.lr-glyph')).toBeNull()
    for(const paragraph of demos.birthday.message)expect(screen.getAllByText(paragraph)).toHaveLength(1)
  })
  it('video request, retry, captions, ended highlight and surprise remain available',async()=>{
    const {container}=await openLetter('&occasion=longDistance')
    expect(container.querySelector('video')).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Xem lời nhắn'}))
    const video=container.querySelector('video')
    expect(video).toHaveAttribute('controls');expect(video).toHaveAttribute('playsinline');expect(video).not.toHaveAttribute('muted')
    expect(video.querySelector('track')).toHaveAttribute('src',demos.longDistance.captionsUrl)
    fireEvent.error(video);expect(screen.getByText(/Video chưa tải được/)).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Mở hai ô cửa'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Thử lại'}));expect(container.querySelector('video')).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Xem lời nhắn'}));fireEvent.ended(container.querySelector('video'))
    expect(screen.getByRole('button',{name:'Mở hai ô cửa'})).toHaveClass('is-highlighted')
    await reveal('Mở hai ô cửa')
    expect(screen.getByRole('status')).toHaveTextContent(demos.longDistance.occasionData.places.join(' • '))
  })
})
