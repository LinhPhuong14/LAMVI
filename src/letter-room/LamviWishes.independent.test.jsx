// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import LamviWishes from './LamviWishes'

const occasions = ['birthday', 'anniversary', 'thankYou', 'milestone', 'encouragement', 'longDistance', 'justBecause']
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('independent LAMVI wishes', () => {
  it('provides 21 distinct Vietnamese wishes across the seven occasions', () => {
    const all=[]
    for(const occasion of occasions){
      const view=render(<LamviWishes occasion={occasion}/>)
      const group=[]
      for(let i=0;i<3;i++){
        const text=view.container.querySelector('.lr-wishes-quote').textContent
        expect(text.length).toBeGreaterThan(30)
        expect(text.length).toBeLessThan(150)
        group.push(text)
        fireEvent.click(screen.getByRole('button'))
      }
      expect(view.container.querySelector('.lr-wishes-quote').textContent).toBe(group[0])
      expect(new Set(group).size).toBe(3)
      all.push(...group);view.unmount()
    }
    expect(new Set(all).size).toBe(21)
  })
  it.each(occasions)('%s changes only on request and wraps after three wishes', occasion => {
    render(<LamviWishes occasion={occasion} />)
    const region = screen.getByRole('region', { name: 'Một lời chúc từ LAMVI' })
    expect(within(region).getByRole('heading', { name: 'Một lời chúc từ LAMVI', level: 3 })).toBeVisible()
    const button = within(region).getByRole('button', { name: 'Lời chúc tiếp theo' })
    expect(button).toHaveAttribute('type', 'button')
    const quotes=[]
    for (let index = 0; index < 4; index++) {
      const current = index % 3
      const text=region.querySelector('.lr-wishes-quote').textContent
      if(index===3)expect(text).toBe(quotes[0]);else quotes.push(text)
      expect(screen.getByLabelText(`Lời chúc ${current + 1} trong 3`)).toBeVisible()
      expect(screen.getAllByText(text)).toHaveLength(1)
      button.focus()
      expect(button).toHaveFocus()
      fireEvent.click(button, { detail: 0 })
      expect(button).toHaveFocus()
    }
  })
  it.each([undefined, null, '', 'unknown', 'constructor', '__proto__', 'toString'])('uses the just-because fallback for %s', occasion => {
    render(<LamviWishes occasion={occasion} />)
    expect(screen.getByRole('status')).toHaveTextContent('Không cần một ngày đặc biệt để dành cho bạn một điều ấm áp.')
    fireEvent.click(screen.getByRole('button', { name: 'Lời chúc tiếp theo' }))
    expect(screen.getByRole('status')).toHaveTextContent('Mong giữa ngày bận rộn, bạn vẫn có một phút ngồi yên bên ánh đèn.')
  })
  it('has no automatic rotation, timer or motion requirement', () => {
    vi.useFakeTimers()
    render(<LamviWishes occasion="birthday" />)
    act(() => { vi.advanceTimersByTime(120000) })
    expect(screen.getByRole('status')).toHaveTextContent('Tuổi mới, mong bạn có thêm những ngày được sống đúng điều mình thích.')
    expect(vi.getTimerCount()).toBe(0)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true')
  })
  it('resets to the first wish when the occasion changes', () => {
    const view = render(<LamviWishes occasion="birthday" />)
    fireEvent.click(screen.getByRole('button', { name: 'Lời chúc tiếp theo' }))
    view.rerender(<LamviWishes occasion="anniversary" />)
    expect(screen.getByRole('status')).toHaveTextContent('Mong mình còn nhiều ngày bình thường để cùng nhau nhớ lại.')
  })
  it('keeps multiple embedded cards independent with unique heading IDs', () => {
    render(<><LamviWishes occasion="birthday" /><LamviWishes occasion="encouragement" /></>)
    const regions = screen.getAllByRole('region', { name: 'Một lời chúc từ LAMVI' })
    expect(regions[0].getAttribute('aria-labelledby')).not.toBe(regions[1].getAttribute('aria-labelledby'))
    fireEvent.click(within(regions[0]).getByRole('button'))
    expect(within(regions[0]).getByRole('status')).toHaveTextContent('Chúc những điều bạn âm thầm vun vén sớm tìm được mùa nở hoa.')
    expect(within(regions[1]).getByRole('status')).toHaveTextContent('Hôm nay đi chậm một chút cũng được, bạn vẫn đang trên đường.')
  })
})
