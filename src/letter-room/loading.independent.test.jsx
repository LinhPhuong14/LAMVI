// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LetterRoom from './LetterRoom'

const deferred=vi.hoisted(()=>{
  let release
  const gate=new Promise(resolve=>{release=resolve})
  return {gate,release,imported:vi.fn(),create:vi.fn(),options:null,dispose:vi.fn(),setState:vi.fn()}
})
vi.mock('./scene',async()=>{
  deferred.imported()
  await deferred.gate
  return {createRoom:deferred.create}
})
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()})

describe('independent deferred room loading',()=>{
  it('keeps room busy and inert through module and background loading, then enables it only onReady',async()=>{
    Object.defineProperty(window,'innerWidth',{configurable:true,value:960})
    Object.defineProperty(window,'innerHeight',{configurable:true,value:540})
    vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener(){},removeEventListener(){}})))
    deferred.create.mockImplementation((_host,options)=>{
      deferred.options=options
      return {setState:deferred.setState,dispose:deferred.dispose,paperRect:()=>null}
    })
    const view=render(<MemoryRouter initialEntries={['/phong-thu?occasion=birthday']}><LetterRoom/></MemoryRouter>)
    const main=view.container.querySelector('main')
    const assertLoading=()=>{
      expect(main).toHaveAttribute('aria-busy','true')
      expect(main).not.toHaveClass('lr-scene-ready')
      const cue=view.container.querySelector('[aria-label="Chạm để bật đèn"]')
      // The scene subtree must prevent both pointer and keyboard interaction.
      expect(cue ? Boolean(cue.closest('[inert]')) || cue.disabled : true).toBe(true)
      expect(main).toHaveAttribute('data-phase','dark')
    }
    await waitFor(()=>expect(deferred.imported).toHaveBeenCalledTimes(1))
    assertLoading()
    expect(deferred.create).not.toHaveBeenCalled()
    await act(async()=>{deferred.release();await vi.dynamicImportSettled()})
    expect(deferred.create).toHaveBeenCalledTimes(1)
    assertLoading()
    await act(async()=>{deferred.options.onReady()})
    expect(main).toHaveAttribute('aria-busy','false')
    expect(main).toHaveClass('lr-scene-ready')
    const light=screen.getByRole('button',{name:'Chạm để bật đèn',exact:true})
    expect(light.closest('[inert]')).toBeNull()
    expect(light).toBeEnabled()
    fireEvent.click(light)
    expect(main).toHaveAttribute('data-phase','lighting')
    view.unmount()
    expect(deferred.dispose).toHaveBeenCalledTimes(1)
  })
})
