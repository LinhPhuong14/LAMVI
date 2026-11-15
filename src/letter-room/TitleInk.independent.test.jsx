// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import TitleInk from './TitleInk'

const advance = async ms => {
  // Flush each browser timer turn so React does not batch the entire title clock.
  for (let remaining = ms; remaining > 0; remaining -= 80) {
    await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(80, remaining)) })
  }
}
beforeEach(()=>{vi.useFakeTimers();vi.spyOn(performance,'now').mockImplementation(()=>Date.now())})
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers()})

describe('independent TitleInk phases',()=>{
  it('writes centered, docks, then calls ready once after the docking interval',async()=>{
    const onReady=vi.fn()
    const view=render(<TitleInk name="Linh" active reduced={false} onReady={onReady}/>)
    const heading=screen.getByRole('heading',{name:'Gửi Linh,',level:2})
    expect(heading).not.toHaveClass('is-docked')
    expect(heading.querySelector('svg')).toBeNull()
    const text=heading.querySelector('.lr-title-dynamic')
    expect(text).toHaveAttribute('aria-hidden','true')
    expect(text).toHaveTextContent('Gửi Linh,')
    await advance(4750)
    expect(heading).not.toHaveClass('is-docked')
    expect(onReady).not.toHaveBeenCalled()
    await advance(50)
    expect(heading).toHaveClass('is-docked')
    await advance(650)
    expect(onReady).not.toHaveBeenCalled()
    await advance(150)
    expect(onReady).toHaveBeenCalledTimes(1)
    view.rerender(<TitleInk name="Linh" active reduced={false} onReady={onReady}/>)
    await advance(10000)
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('waits for the actual docking transition to finish before publishing ready once', async () => {
    const onReady=vi.fn()
    render(<TitleInk name="Linh" active reduced={false} onReady={onReady}/>)
    const heading=screen.getByRole('heading',{name:'Gửi Linh,'})
    class CSSTransition { constructor(playState) { this.playState=playState } }
    const transition=new CSSTransition('running')
    heading.getAnimations=vi.fn(()=>[transition])
    await advance(5600)
    expect(heading).toHaveClass('is-docked')
    expect(heading.getAnimations).toHaveBeenCalled()
    expect(onReady).not.toHaveBeenCalled()
    transition.playState='finished'
    fireEvent.transitionEnd(heading,{propertyName:'transform'})
    expect(onReady).toHaveBeenCalledTimes(1)
    fireEvent.transitionEnd(heading,{propertyName:'top'})
    await advance(1000)
    expect(onReady).toHaveBeenCalledTimes(1)
  })
  it('pauses the writing clock and resumes without resetting progress',async()=>{
    const onReady=vi.fn()
    const view=render(<TitleInk name="Linh" active reduced={false} onReady={onReady}/>)
    await advance(4000)
    view.rerender(<TitleInk name="Linh" active={false} reduced={false} onReady={onReady}/>)
    const heading=screen.getByRole('heading')
    expect(heading.style.animationPlayState).toBe('paused')
    expect(heading.querySelector('.lr-title-dynamic').style.animationPlayState).toBe('paused')
    await advance(20000)
    expect(heading).not.toHaveClass('is-docked')
    expect(onReady).not.toHaveBeenCalled()
    view.rerender(<TitleInk name="Linh" active reduced={false} onReady={onReady}/>)
    await advance(800)
    expect(heading).toHaveClass('is-docked')
    await advance(800)
    expect(onReady).toHaveBeenCalledTimes(1)
  })
  it('pauses while docked without making body ready early',async()=>{
    const onReady=vi.fn()
    const view=render(<TitleInk name="Linh" active reduced={false} onReady={onReady}/>)
    await advance(4800)
    view.rerender(<TitleInk name="Linh" active={false} reduced={false} onReady={onReady}/>)
    await advance(10000)
    expect(screen.getByRole('heading')).toHaveClass('is-docked')
    expect(onReady).not.toHaveBeenCalled()
    view.rerender(<TitleInk name="Linh" active reduced={false} onReady={onReady}/>)
    await advance(800)
    expect(onReady).toHaveBeenCalledTimes(1)
  })
  it('reduced motion docks and announces readiness immediately without a timer',()=>{
    const onReady=vi.fn()
    render(<TitleInk name="Linh" active reduced onReady={onReady}/>)
    expect(screen.getByRole('heading',{name:'Gửi Linh,'})).toHaveClass('is-docked')
    expect(onReady).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each(['Linh', 'Ngọc Ánh', 'A\u0306nh'])('font title for %s has a complete accessible Vietnamese name without duplicate text',async name=>{
    const onReady=vi.fn()
    const {container}=render(<TitleInk name={name} active reduced={false} onReady={onReady}/>)
    const heading=screen.getByRole('heading',{name:`Gửi ${name},`})
    expect(container.querySelector('svg')).toBeNull()
    expect(heading.querySelector('.lr-title-dynamic')).toHaveAttribute('aria-hidden','true')
    await advance(5600)
    expect(onReady).toHaveBeenCalledTimes(1)
  })
  it('unmount cancels pending clock updates and callbacks',async()=>{
    const onReady=vi.fn()
    const view=render(<TitleInk name="Linh" active reduced={false} onReady={onReady}/>)
    await advance(1000);view.unmount();await advance(10000)
    expect(onReady).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
