import { useEffect, useState } from 'react'
import Field from './Field'
import { api } from '../api/client.js'
import { useI18n } from '../i18n/index.js'

// G-46, D-99: chọn tỉnh/thành → phường/xã từ danh mục hành chính 2 cấp (server là nguồn sự thật)
function useGeo(path) {
  const [state, setState] = useState({ path: null, items: [], error: false })
  useEffect(() => {
    if (!path) return undefined
    let alive = true
    api(path)
      .then((r) => alive && setState({ path, items: r.items, error: false }))
      .catch(() => alive && setState({ path, items: [], error: true }))
    return () => {
      alive = false
    }
  }, [path])
  // Đổi path → coi như đang tải tới khi có kết quả mới
  return path && state.path === path ? state : { path, items: [], error: false, loading: Boolean(path) }
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
      <Field
        as="select"
        label={t('checkout.ward')}
        value={wardCode}
        onChange={(e) => onChange({ provinceCode, wardCode: e.target.value })}
        error={errors.wardCode}
        disabled={!provinceCode}
        autoComplete="address-level2"
        required
        hint={provinces.error || wards.error ? t('checkout.geoError') : undefined}
      >
        <option value="">{provinceCode ? t('checkout.chooseWard') : t('checkout.chooseProvinceFirst')}</option>
        {wards.items.map((w) => (
          <option key={w.code} value={w.code}>
            {w.name}
          </option>
        ))}
      </Field>
    </div>
  )
}
