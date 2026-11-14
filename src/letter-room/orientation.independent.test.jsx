// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LetterRoom from './LetterRoom'

const scene = vi.hoisted(() => ({ imports: 0, createRoom: vi.fn(), setState: vi.fn(), dispose: vi.fn() }))
vi.mock('./scene', () => {
  scene.imports++
  return { createRoom: scene.createRoom }
})

function dimensions(width, height) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}
async function rotate(landscape, event = 'resize') {
  await act(async () => {
    dimensions(landscape ? 960 : 360, landscape ? 540 : 800)
    window.dispatchEvent(new Event(event))
  })
}
const advance = async ms => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
const mount = (fallback = false) => render(<MemoryRouter initialEntries={[`/phong-thu${fallback ? '?fallback=1' : ''}`]}><LetterRoom /></MemoryRouter>)
const phase = container => container.querySelector('main').dataset.phase

describe('independent orientation lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dimensions(360, 800)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })))
    scene.createRoom.mockReset().mockImplementation(() => ({ setState: scene.setState, dispose: scene.dispose, paperRect: () => null }))
    scene.setState.mockClear()
    scene.dispose.mockClear()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('never imports or creates the scene while initially portrait; landscape starts it once', async () => {
    const { container, unmount } = mount()
    await advance(10000)
    expect(scene.imports).toBe(0)
    expect(scene.createRoom).not.toHaveBeenCalled()
    expect(screen.getByRole('status', { name: 'Hướng dẫn xoay ngang màn hình' })).toHaveTextContent('Xoay ngang một chút nhé.')
    const viewport = container.querySelector('.lr-viewport')
    expect(viewport).toHaveAttribute('inert')
    expect(viewport).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button', { name: /Chạm để bật đèn/ })).not.toBeInTheDocument()
    expect(phase(container)).toBe('dark')
    await rotate(true)
    await vi.dynamicImportSettled()
    expect(scene.imports).toBe(1)
    expect(scene.createRoom).toHaveBeenCalledTimes(1)
    expect(viewport).not.toHaveAttribute('inert')
    expect(viewport).toHaveAttribute('aria-hidden', 'false')
    expect(screen.queryByRole('status', { name: 'Hướng dẫn xoay ngang màn hình' })).not.toBeInTheDocument()
    await rotate(false, 'orientationchange')
    expect(scene.setState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'dark', paused: true }))
    expect(scene.dispose).not.toHaveBeenCalled()
    await rotate(true, 'orientationchange')
    expect(scene.createRoom).toHaveBeenCalledTimes(1)
    expect(scene.setState).toHaveBeenLastCalledWith(expect.objectContaining({ paused: false }))
    unmount()
    expect(scene.dispose).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('preserves remaining phase duration across repeated rotation, reduced=%s', async reduced => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced, addEventListener() {}, removeEventListener() {} })))
    const { container } = mount()
    await rotate(true)
    await vi.dynamicImportSettled()
    fireEvent.click(screen.getByRole('button', { name: /Chạm để bật đèn/ }))
    const duration = reduced ? 25 : 1800
    await advance(reduced ? 10 : 400)
    await rotate(false)
    expect(phase(container)).toBe('lighting')
    expect(scene.setState).toHaveBeenLastCalledWith(expect.objectContaining({ paused: true }))
    await advance(10000)
    expect(phase(container)).toBe('lighting')
    await rotate(true)
    await advance(reduced ? 5 : 200)
    await rotate(false)
    await advance(10000)
    expect(phase(container)).toBe('lighting')
    await rotate(true)
    await advance(duration - (reduced ? 15 : 600) - 1)
    expect(phase(container)).toBe('lighting')
    await advance(1)
    expect(phase(container)).toBe('lit')
    await advance(reduced?25:900)
    expect(phase(container)).toBe('envelope')
    await advance(10000)
    expect(phase(container)).toBe('envelope')
    fireEvent.click(screen.getByRole('button',{name:'Chạm vào phong bì để mở thư'}))
    await advance(reduced?25:1200)
    expect(phase(container)).toBe('ready')
    fireEvent.click(screen.getByRole('button',{name:'Kéo mép giấy lên'}),{detail:0})
    for(const time of [420,1100,1100])await advance(reduced?25:time)
    expect(phase(container)).toBe('reading')
    const article = screen.getByRole('article')
    await rotate(false)
    await advance(10000)
    await rotate(true)
    expect(screen.getByRole('article')).toBe(article)
    expect(phase(container)).toBe('reading')
    expect(scene.createRoom).toHaveBeenCalledTimes(1)
  })

  it('fallback also pauses and resumes without constructing WebGL', async () => {
    const { container } = mount(true)
    await rotate(true)
    fireEvent.click(screen.getByRole('button', { name: /Chạm để bật đèn/ }))
    await advance(500)
    await rotate(false)
    await advance(10000)
    expect(phase(container)).toBe('lighting')
    await rotate(true)
    await advance(1299)
    expect(phase(container)).toBe('lighting')
    await advance(1)
    expect(phase(container)).toBe('lit')
    expect(scene.createRoom).not.toHaveBeenCalled()
  })
})
