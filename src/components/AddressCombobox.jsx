import { useEffect, useId, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import './AddressCombobox.css'

const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D').toLocaleLowerCase()

// WAI-ARIA editable list autocomplete: input retains focus, selection is always a server code.
export default function AddressCombobox({ label, items, value, onChange, placeholder, disabled, loading, failed, retry, error }) {
  const id = useId()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const selected = items.find((item) => String(item.code) === String(value))
  const filtered = items.filter((item) => normalize(item.name).includes(normalize(query.trim())))
  const expanded = open && !disabled
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [expanded, active, id])
  function choose(item) {
    onChange(String(item.code))
    setOpen(false)
    setQuery('')
    setActive(-1)
  }
  function close() { setOpen(false); setQuery(''); setActive(-1) }
  function keyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActive((previous) => filtered.length ? previous < 0 ? event.key === 'ArrowDown' ? 0 : filtered.length - 1 : (previous + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : -1)
    } else if (event.key === 'Enter' && expanded) {
      event.preventDefault()
      if (active >= 0 && filtered[active]) choose(filtered[active])
    } else if (event.key === 'Escape') {
      if (expanded) event.preventDefault()
      close()
    }
  }
  return <div className="field address-combobox">
    <label htmlFor={id}>{label}</label>
    <input id={id} role="combobox" type="text" required disabled={disabled}
      autoComplete="off" aria-autocomplete="list" aria-expanded={expanded}
      aria-controls={`${id}-list`} aria-activedescendant={expanded && active >= 0 && filtered[active] ? `${id}-option-${active}` : undefined}
      aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-error` : failed || loading ? `${id}-status` : undefined}
      value={open ? query : selected?.name ?? ''} placeholder={placeholder}
      onFocus={() => { setOpen(true); setQuery(''); setActive(-1) }} onBlur={close}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); if (value) onChange('') }} onKeyDown={keyDown} />
    {expanded && <div className="address-options" role="listbox" id={`${id}-list`} aria-label={label}>
      {filtered.map((item, index) => <div role="option" key={item.code} id={`${id}-option-${index}`}
        aria-selected={String(item.code) === String(value)} className={index === active ? 'is-active' : ''}
        onPointerDown={(event) => event.preventDefault()} onClick={() => choose(item)}>{item.name}</div>)}
      {!filtered.length && !loading && !failed && <p role="status">{t('checkout.geoEmpty')}</p>}
    </div>}
    {error && <span id={`${id}-error`} className="field-error">{t(`errors.${error}`)}</span>}
    {(loading || failed) && <span id={`${id}-status`} className="field-hint" role={failed ? 'alert' : 'status'}>
      {loading ? t('checkout.geoLoading') : t('checkout.geoError')} {failed && <button type="button" onClick={retry}>{t('checkout.retry')}</button>}
    </span>}
  </div>
}
