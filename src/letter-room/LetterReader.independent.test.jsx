// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import LetterReader from './LetterReader'
import { demos } from './data'

const advance = async ms => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
describe('independent body handwriting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches:false})))
  })
  afterEach(() => {cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()})
  it('segments Vietnamese combining marks, reveals sequentially across paragraphs and reads plain text once', async () => {
    const message = ['Gửi Ánh a\u0306\u0301,', 'Một chút thương.']
    const {container}=render(<LetterReader letter={{...demos.birthday,message}}/>)
    await advance(1100)
    const glyphs=[...container.querySelectorAll('.lr-body-ink-glyph')]
    expect(glyphs.some(g=>g.textContent==='a\u0306\u0301')).toBe(true)
    expect(glyphs.every(g=>g.closest('[aria-hidden="true"]'))).toBe(true)
    const plain=[...container.querySelectorAll('.lr-body-ink > .lr-sr-only')]
    expect(plain.map(p=>p.textContent)).toEqual(message)
    expect(glyphs.map(g=>g.textContent).join('')).toBe(message.join('').replace(/\s/g,''))
    const delays=glyphs.map(g=>parseFloat(g.style.getPropertyValue('--body-ink-delay')))
    expect(delays.every((delay,i)=>i===0||delay>delays[i-1])).toBe(true)
    expect(screen.getByRole('button',{name:'Mở tấm thiệp nhỏ'})).toBeEnabled()
  })
  it('falls back to NFC characters when Intl.Segmenter is unavailable', async () => {
    const original=Intl.Segmenter
    Object.defineProperty(Intl,'Segmenter',{configurable:true,writable:true,value:undefined})
    try {
    const text='Gửi Ánh a\u0306\u0301'
    const {container}=render(<LetterReader letter={{...demos.birthday,message:[text]}}/>)
    await advance(1100)
    const glyphs=[...container.querySelectorAll('.lr-body-ink-glyph')]
    expect(glyphs.map(g=>g.textContent).join('')).toBe(text.normalize('NFC').replace(/\s/g,''))
    expect(glyphs.some(g=>g.textContent==='ắ')).toBe(true)
    expect(container.querySelector('.lr-body-ink > .lr-sr-only').textContent).toBe(text)
    } finally {Object.defineProperty(Intl,'Segmenter',{configurable:true,writable:true,value:original})}
  })
  it('caps even a very long letter and offers immediate skip without blocking extras', async () => {
    const {container}=render(<LetterReader letter={{...demos.birthday,message:['Thương bạn. '.repeat(600)]}} afterLetter={<button>Xem lại cách làm đèn</button>}/>)
    await advance(1100)
    const delays=[...container.querySelectorAll('.lr-body-ink-glyph')].map(g=>parseFloat(g.style.getPropertyValue('--body-ink-delay')))
    expect(Math.max(...delays)+.28).toBeLessThanOrEqual(6)
    expect(screen.getByRole('button',{name:'Xem lại cách làm đèn'})).toBeEnabled()
    fireEvent.click(screen.getByRole('button',{name:'Hiện toàn bộ lá thư'}))
    expect(container.querySelector('.lr-body-ink')).toHaveClass('is-complete')
    expect(screen.queryByRole('button',{name:'Hiện toàn bộ lá thư'})).not.toBeInTheDocument()
  })
  it('finishes automatically and clears reveal timers on unmount', async () => {
    const view=render(<LetterReader letter={demos.birthday}/>)
    await advance(1100);await advance(6000)
    expect(view.container.querySelector('.lr-body-ink')).toHaveClass('is-complete')
    view.unmount();expect(vi.getTimerCount()).toBe(0)
  })
  it('reduced motion exposes all text and controls immediately with no skip', () => {
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})))
    const {container}=render(<LetterReader letter={demos.birthday}/>)
    expect(container.querySelector('.lr-letter-content')).not.toHaveAttribute('inert')
    expect(container.querySelector('.lr-body-ink')).toHaveClass('is-complete')
    expect(screen.getByRole('button',{name:'Mở tấm thiệp nhỏ'})).toBeEnabled()
    expect(screen.queryByRole('button',{name:'Hiện toàn bộ lá thư'})).not.toBeInTheDocument()
  })
  it('pauses glyphs while portrait and resumes without replacing accessible text', async () => {
    const view=render(<LetterReader letter={demos.birthday}/>)
    await advance(1100)
    const plain=view.container.querySelector('.lr-body-ink > .lr-sr-only')
    view.rerender(<LetterReader letter={demos.birthday} active={false}/>)
    expect(view.container.querySelector('.lr-body-ink-glyph').style.animationPlayState).toBe('paused')
    await advance(10000)
    expect(view.container.querySelector('.lr-body-ink')).not.toHaveClass('is-complete')
    view.rerender(<LetterReader letter={demos.birthday} active/>)
    expect(view.container.querySelector('.lr-body-ink > .lr-sr-only')).toBe(plain)
    expect(view.container.querySelector('.lr-body-ink-glyph').style.animationPlayState).toBe('running')
  })
})
