// @vitest-environment jsdom
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AddressCombobox from './AddressCombobox.jsx'

const items = [{ code: '1', name: 'Phường Ba Đình' }, { code: '2', name: 'Phường Sài Gòn' }]
function Harness(props) {
  const [value, setValue] = useState('')
  return <AddressCombobox label="Phường / xã" items={items} value={value} onChange={setValue} {...props} />
}
describe('Searchable address selection', () => {
  it('filters Vietnamese accents, selects via keyboard and submits only codes', () => {
    const changed = vi.fn()
    render(<Harness onChange={changed} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'ba dinh' } })
    expect(screen.getByRole('option', { name: 'Phường Ba Đình' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Phường Sài Gòn' })).toBeNull()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getByRole('option').id)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(changed).toHaveBeenLastCalledWith('1')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
  it('discards unselected search text on blur, Escape retains the committed selection', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.click(screen.getByRole('option', { name: 'Phường Ba Đình' }))
    expect(input).toHaveValue('Phường Ba Đình')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('Phường Ba Đình')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'unknown' } })
    expect(screen.getByRole('status')).toHaveTextContent('Không tìm thấy')
    fireEvent.blur(input)
    expect(input).toHaveValue('')
  })
  it('exposes loading and retry with accessible error description', () => {
    const retry = vi.fn()
    render(<Harness failed retry={retry} />)
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-describedby', screen.getByRole('alert').id)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
