import { useEffect, useState } from 'react'
import Field from './Field'
import AddressCombobox from './AddressCombobox.jsx'
import { api } from '../api/client.js'
import { useI18n } from '../i18n/index.js'

// G-46, D-99: chọn tỉnh/thành → phường/xã từ danh mục hành chính 2 cấp (server là nguồn sự thật)
function useGeo(path) {
  const [state, setState] = useState({ path: null, items: [], error: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!path) return undefined
    let alive = true
    api(path)
      .then((r) => alive && setState({ path, items: r.items, error: false }))
      .catch(() => alive && setState({ path, items: [], error: true }))
    return () => {
      alive = false
    }
  }, [path, attempt])
  // Đổi path → coi như đang tải tới khi có kết quả mới
  return { ...(path && state.path === path ? state : { path, items: [], error: false, loading: Boolean(path) }), retry: () => { setState({ path: null, items: [], error: false }); setAttempt((n) => n + 1) } }
}

export default function AddressSelect({ provinceCode, wardCode, onChange, errors = {} }) {
  const { t } = useI18n()
  const provinces = useGeo('/geo/provinces')
  const wards = useGeo(provinceCode ? `/geo/provinces/${encodeURIComponent(provinceCode)}/wards` : null)
  return (
    <div className="admin-grid">
      <Field
        as="select"
        label={t('checkout.province')}
        value={provinceCode}
        onChange={(e) => onChange({ provinceCode: e.target.value, wardCode: '' })}
        error={errors.provinceCode}
        autoComplete="address-level1"
        required
      >
        <option value="">{t('checkout.chooseProvince')}</option>
        {provinces.items.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name}
          </option>
        ))}
      </Field>
      <AddressCombobox
        key={provinceCode}
        label={t('checkout.ward')}
        items={wards.items}
        value={wardCode}
        onChange={(code) => onChange({ provinceCode, wardCode: code })}
        error={errors.wardCode}
        disabled={!provinceCode}
        loading={wards.loading}
        failed={provinces.error || wards.error}
        retry={provinces.error ? provinces.retry : wards.retry}
        placeholder={provinceCode ? t('checkout.chooseWard') : t('checkout.chooseProvinceFirst')}
      />
    </div>
  )
}
