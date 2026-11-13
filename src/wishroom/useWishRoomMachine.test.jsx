// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { canTransition, useWishRoomMachine } from './useWishRoomMachine.js'

describe('canTransition', () => {
  it('chỉ cho đi theo đúng thứ tự 6 trạng thái', () => {
    expect(canTransition('roomDark', 'roomLit')).toBe(true)
    expect(canTransition('roomDark', 'envelopeFocus')).toBe(false)
    expect(canTransition('letterOpen', 'postscriptOpen')).toBe(true)
    expect(canTransition('postscriptOpen', 'roomDark')).toBe(false)
  })
})

describe('useWishRoomMachine', () => {
  it('bắt đầu ở roomDark, không bận', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    expect(result.current.phase).toBe('roomDark')
    expect(result.current.busy).toBe(false)
  })

  it('request hợp lệ chuyển trạng thái và đặt busy=true', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    act(() => {
      const ok = result.current.request('roomLit')
      expect(ok).toBe(true)
    })
    expect(result.current.phase).toBe('roomLit')
    expect(result.current.busy).toBe(true)
  })

  it('request khi đang busy bị bỏ qua (chạm liên tiếp lúc chuyển cảnh — §5.3)', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    act(() => {
      result.current.request('roomLit')
    })
    act(() => {
      const ok = result.current.request('envelopeFocus')
      expect(ok).toBe(false)
    })
    expect(result.current.phase).toBe('roomLit') // vẫn ở trạng thái cũ, chưa settle
  })

  it('settle() mở lại thao tác, rồi mới đi tiếp được', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    act(() => {
      result.current.request('roomLit')
    })
    act(() => {
      result.current.settle()
    })
    expect(result.current.busy).toBe(false)
    act(() => {
      const ok = result.current.request('envelopeFocus')
      expect(ok).toBe(true)
    })
    expect(result.current.phase).toBe('envelopeFocus')
  })

  it('request sai cạnh (nhảy cóc) bị từ chối, không đổi busy', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    act(() => {
      const ok = result.current.request('letterOpen')
      expect(ok).toBe(false)
    })
    expect(result.current.phase).toBe('roomDark')
    expect(result.current.busy).toBe(false)
  })

  it('postscriptOpen chỉ tới được từ letterOpen', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    const steps = ['roomLit', 'envelopeFocus', 'letterReady', 'letterOpen']
    for (const step of steps) {
      act(() => {
        result.current.request(step)
      })
      act(() => {
        result.current.settle()
      })
    }
    expect(result.current.phase).toBe('letterOpen')
    act(() => {
      const ok = result.current.request('postscriptOpen')
      expect(ok).toBe(true)
    })
    expect(result.current.phase).toBe('postscriptOpen')
  })

  it('advance() đi tiếp được dù không qua settle() trước (bước nối tiếp từ callback bất đồng bộ)', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    act(() => {
      result.current.request('roomLit')
    })
    expect(result.current.busy).toBe(true) // chưa settle
    act(() => {
      result.current.advance('envelopeFocus')
    })
    expect(result.current.phase).toBe('envelopeFocus')
    expect(result.current.busy).toBe(false) // advance() luôn mở lại thao tác
  })

  it('advance() với cạnh không hợp lệ: không đổi trạng thái nhưng vẫn mở lại busy (không kẹt máy)', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    act(() => {
      result.current.request('roomLit')
    })
    act(() => {
      result.current.advance('postscriptOpen') // nhảy cóc từ roomLit, không hợp lệ
    })
    expect(result.current.phase).toBe('roomLit')
    expect(result.current.busy).toBe(false)
  })

  it('reset() đưa về roomDark', () => {
    const { result } = renderHook(() => useWishRoomMachine())
    act(() => {
      result.current.request('roomLit')
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.phase).toBe('roomDark')
    expect(result.current.busy).toBe(false)
  })
})
