import { useState } from 'react'
import { api } from '../api/client.js'
import { useApi } from '../api/useApi.js'
import { useSubmit } from '../auth/useForm.js'
import Field from '../components/Field'
import { useI18n } from '../i18n/index.js'
import Seo from '../seo/Seo.jsx'

const telHref = (phone) => `tel:${phone.replace(/[^0-9+]/g, '')}`

// Feedback 08/10, mục 4: trang /contact — kênh liên hệ + form (có mã đơn). Mọi thông tin liên hệ
// là dữ liệu thật do vận hành cấu hình (/api/site); thiếu mục nào thì không hiện mục đó, không bịa.
export default function ContactPage() {
  const { t, lang } = useI18n()
  const site = useApi('/site', lang)
  const business = site.status === 'ok' ? site.data : null
  const [form, setForm] = useState({ name: '', email: '', phone: '', orderCode: '', message: '' })
  const [sent, setSent] = useState(false)
  const { pending, error, fields, run } = useSubmit()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    const ok = await run(async () => {
      await api('/contact', { method: 'POST', body: form })
      return true
    })
    if (ok) {
      setSent(true)
      setForm({ name: '', email: '', phone: '', orderCode: '', message: '' })
    }
  }

  const channels = [
    business?.phone && { key: 'hotline', label: t('contact.hotline'), node: <a href={telHref(business.phone)}>{business.phone}</a> },
    business?.zalo && {
      key: 'zalo',
      label: t('contact.zalo'),
      node: (
        <a href={business.zalo} target="_blank" rel="noopener noreferrer">
          {t('contact.zaloOpen')}
        </a>
      ),
    },
    business?.supportEmail && { key: 'email', label: t('contact.email'), node: <a href={`mailto:${business.supportEmail}`}>{business.supportEmail}</a> },
    business?.hours && { key: 'hours', label: t('contact.hours'), node: business.hours },
    business?.workshopAddress && { key: 'workshop', label: t('contact.workshop'), node: business.workshopAddress },
    business?.address && { key: 'office', label: t('contact.office'), node: business.address },
  ].filter(Boolean)

  return (
    <section className="page-section medium contact-page">
      <Seo title={t('contact.title')} description={t('contact.description')} path="/contact" />
      <h1 className="page-title">{t('contact.title')}</h1>
      <p className="policy-intro">{t('contact.lead')}</p>

      {channels.length > 0 ? (
        <dl className="contact-channels">
          {channels.map((c) => (
            <div key={c.key}>
              <dt>{c.label}</dt>
              <dd>{c.node}</dd>
            </div>
          ))}
        </dl>
      ) : (
        site.status === 'ok' && <p className="notice">{t('contact.noChannels')}</p>
      )}
      {business?.social?.length > 0 && (
        <p className="social-links">
          {business.social.map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          ))}
        </p>
      )}
      <p className="field-hint">{t('contact.returnsNote')}</p>

      {business?.contactForm && (
        <form className="form contact-form" onSubmit={onSubmit} noValidate>
          <h2>{t('contact.formTitle')}</h2>
          {sent && (
            <p className="notice" role="status">
              {t('contact.sent')}
            </p>
          )}
          <Field label={t('contact.name')} autoComplete="name" required value={form.name} onChange={set('name')} error={fields.name} />
          <Field label={t('contact.emailLabel')} type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={fields.email} />
          <Field label={t('contact.phone')} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={fields.phone} />
          <Field label={t('contact.orderCode')} value={form.orderCode} onChange={set('orderCode')} error={fields.orderCode} />
          <Field as="textarea" rows={5} label={t('contact.message')} required value={form.message} onChange={set('message')} error={fields.message} maxLength={3000} />
          {error && !Object.keys(fields).length && (
            <p className="notice error" role="alert">
              {t(`errors.${error}`)}
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? t('contact.sending') : t('contact.submit')}
          </button>
        </form>
      )}
    </section>
  )
}
