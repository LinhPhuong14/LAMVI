import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Field from '../components/Field'
import Lantern from '../components/Lantern'
import { GiftArt, HeroScene, LetterArt } from '../components/DashArt'
import DashSky from '../components/DashSky'
import Price from '../components/Price'
import { Lotus, Seal } from '../components/Motifs'
import { LanguageSwitcher } from '../components/SiteHeader'
import MayAvatar from '../may/MayAvatar'
import { HTML_LANG, LOCALES, useI18n } from '../i18n/index.js'
import Seo from '../seo/Seo.jsx'
import { useAuth } from '../auth/context.js'
import { useCart } from '../cart/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useMyOrders } from '../orders/useOrders.js'
import { StatusBadge } from '../orders/OrderStatus.jsx'
import { formatVnd } from '../lib/money.js'

// Ngày giờ theo giờ Việt Nam (như tháng ngân sách Mây) — [ASSUMPTION] ghi ở spec §5.2
const TZ = 'Asia/Ho_Chi_Minh'

// Tab lưu ở ?tab= để tải lại, chia sẻ link và nút Back đều giữ đúng mục
const TABS = ['overview', 'orders', 'may', 'profile']

// Biểu tượng nét mảnh cho từng tab (trang trí)
const ICONS = {
  overview: (
    <path d="M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z" />
  ),
  orders: (
    <>
      <path d="M12 2v2M9 20h6M12 20v2" />
      <path d="M8 5h8M8 19h8M7.5 5C5 8 5 16 7.5 19M16.5 5C19 8 19 16 16.5 19M12 5v14" />
    </>
  ),
  may: (
    <path d="M7 18c-2.4 0-4-1.7-4-3.8 0-2 1.5-3.5 3.4-3.7C6.9 7.9 9.1 6 12 6c2.5 0 4.6 1.7 5.1 4 2.1.1 3.9 1.8 3.9 4 0 2.2-1.7 4-4.1 4H7z" />
  ),
  profile: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7.5 17.5c1-2 2.6-3 4.5-3s3.5 1 4.5 3" />
    </>
  ),
}

function TabIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" className="dash-tab-icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  )
}

// Giao diện sáng/tối của dashboard: lựa chọn lưu ở trình duyệt, mặc định theo cài đặt thiết bị
const THEME_KEY = 'moc.dashTheme'

function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    // chế độ riêng tư: bỏ qua
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function saveTheme(v) {
  try {
    localStorage.setItem(THEME_KEY, v)
  } catch {
    // bỏ qua
  }
}

function ThemeIcon({ dark }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {dark ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </>
      ) : (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      )}
    </svg>
  )
}

// Chữ cái đầu của tên gọi (từ cuối trong họ tên Việt), dự phòng bằng email
function initialOf(fullName, email) {
  const words = (fullName ?? '').normalize('NFC').trim().split(/\s+/).filter(Boolean)
  const src = words.at(-1) ?? (email ?? '').trim()
  return src ? [...src][0].toLocaleUpperCase() : '·'
}

function ProfileForm({ profile, onSaved, initiallySaved = false }) {
  const { t } = useI18n()
  const { authedApi } = useAuth()
  const [form, setForm] = useState({
    fullName: profile.fullName ?? '',
    phone: profile.phone ?? '',
    preferredLocale: profile.preferredLocale,
  })
  const [saved, setSaved] = useState(initiallySaved)
  const { pending, error, fields, run } = useSubmit()
  const set = (k) => (e) => {
    setSaved(false)
    setForm({ ...form, [k]: e.target.value })
  }

  async function onSubmit(e) {
    e.preventDefault()
    const res = await run(() => authedApi('/me', { method: 'PATCH', body: form }))
    if (res) {
      setSaved(true)
      onSaved(res.profile)
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field label={t('auth.email')} value={profile.email} readOnly disabled />
      <Field label={t('auth.fullName')} value={form.fullName} onChange={set('fullName')} error={fields.fullName} />
      <Field label={t('auth.phone')} type="tel" value={form.phone} onChange={set('phone')} error={fields.phone} />
      <Field as="select" label={t('auth.preferredLocale')} value={form.preferredLocale} onChange={set('preferredLocale')}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(`locales.${l}`)}
          </option>
        ))}
      </Field>
      {error && !Object.keys(fields).length && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      {saved && (
        <p className="notice success" role="status">
          {t('account.saved')}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? t('auth.submitting') : t('account.save')}
      </button>
    </form>
  )
}

// Gom tin nhắn theo ngày (giờ VN); tin không có thời điểm xếp chung một nhóm không tiêu đề
function groupByDay(items, lang) {
  const locale = HTML_LANG[lang] ?? lang
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: TZ })
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ })
  const groups = []
  for (const m of items) {
    const d = m.createdAt ? new Date(m.createdAt) : null
    const valid = d && !Number.isNaN(d.getTime())
    const label = valid ? day.format(d) : ''
    const last = groups.at(-1)
    const msg = { ...m, time: valid ? time.format(d) : '' }
    // Tin không có thời điểm đi theo ngày đang đọc, để tiêu đề ngày không bị lặp
    if (last && (!label || last.label === label)) last.items.push(msg)
    else groups.push({ label, items: [msg] })
  }
  return groups
}

function ChatList({ items }) {
  const { t, lang } = useI18n()
  const listRef = useRef(null)
  const groups = useMemo(() => groupByDay(items, lang), [items, lang])

  // Mở ra ở tin mới nhất, như cuốn sổ lật tới trang đang viết
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [groups])

  return (
    <div className="dash-chat" ref={listRef} tabIndex={0} aria-label={t('accountMay.title')}>
      {groups.map((g, gi) => (
        <section key={gi} className="dash-chat-day">
          {g.label && (
            <h3 className="dash-chat-date">
              <span>{g.label}</span>
            </h3>
          )}
          <ol className="may-list may-history">
            {g.items.map((m, i) => (
              <li key={i} className={`may-msg may-${m.role} may-kind-${m.kind}`}>
                {m.role === 'user' && <span className="sr-only">{t('accountMay.you')}: </span>}
                {m.content}
                {m.time && <time className="dash-chat-time">{m.time}</time>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function MayEmpty() {
  const { t } = useI18n()
  return (
    <div className="dash-empty">
      <MayAvatar size={72} mood="sleepy" />
      <p>{t('accountMay.empty')}</p>
      <p className="dash-muted">{t('account.mayHint')}</p>
    </div>
  )
}

function Card({ title, id, tag, action, className = '', children }) {
  return (
    <article className={`dash-card ${className}`} aria-labelledby={id}>
      <header className="dash-card-head">
        <h2 id={id}>{title}</h2>
        {tag && <span className="dash-tag">{tag}</span>}
        {action}
      </header>
      {children}
    </article>
  )
}

// FR-ACC-002: đơn hàng của tôi. Dữ liệu do trang cha nạp một lần (dùng chung với ô số liệu).
function OrdersPanel({ status, items, error }) {
  const { t, lang, path } = useI18n()

  return (
    <Card title={t('account.orders')} id="dash-orders-title" className="dash-wide">
      {status === 'loading' && <p>{t('orders.loading')}</p>}
      {status === 'error' && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      {status === 'ok' && items.length === 0 && (
        <div className="dash-orders">
          <div className="dash-orders-art" aria-hidden="true">
            <Lantern size={88} tone="dusk" swing />
          </div>
          <div>
            <p>{t('orders.empty')}</p>
            <Link to={{ pathname: path('/'), hash: '#products' }} className="btn btn-ghost btn-compact">
              {t('cart.continue')}
            </Link>
          </div>
        </div>
      )}
      {status === 'ok' && items.length > 0 && (
        <ul className="order-list">
          {items.map((o) => (
            <li key={o.code} className="order-row">
              <div>
                <Link to={path(`/don-hang/${o.code}`)} className="product-link">
                  <strong>{o.code}</strong>
                </Link>
                <span className="field-hint">
                  {new Date(o.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-Hans' : lang)} ·{' '}
                  {o.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                </span>
              </div>
              <StatusBadge status={o.status} />
              <span className="order-row-total">{formatVnd(o.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// FR-ACC-004: lịch sử chat với Mây (D-19)
function MayPanel({ items }) {
  const { t } = useI18n()
  return (
    <Card title={t('accountMay.title')} id="dash-may-title">
      {items === null && <p className="dash-muted">{t('account.loading')}</p>}
      {items?.length === 0 && <MayEmpty />}
      {items?.length > 0 && <ChatList items={items} />}
    </Card>
  )
}

function ProfilePanel({ state, setState }) {
  const { t } = useI18n()
  return (
    <Card title={t('account.profile')} id="dash-profile-title" className="dash-profile">
      <div className="dash-profile-body">
        <div>
          {state.status === 'loading' && <p className="dash-muted">{t('account.loading')}</p>}
          {state.status === 'ok' && (
            <ProfileForm
              // Đổi key sau khi lưu để form hiển thị giá trị server đã chuẩn hoá (vd SĐT)
              key={`${state.profile.fullName}|${state.profile.phone}|${state.profile.preferredLocale}`}
              profile={state.profile}
              onSaved={(p) => setState({ status: 'ok', profile: p, saved: true })}
              initiallySaved={state.saved}
            />
          )}
        </div>
        <div className="dash-profile-art" aria-hidden="true">
          <LetterArt size={150} />
        </div>
      </div>
    </Card>
  )
}

function Overview({ cart, mayItems, profile, orders, go }) {
  const { t, path } = useI18n()
  const asked = mayItems?.filter((m) => m.role === 'user').length
  const count = cart?.itemCount
  const recent = mayItems?.slice(-2) ?? []

  return (
    <>
      <ul className="dash-stats" aria-label={t('account.overview')}>
        <li className="dash-stat" data-tone="amber" style={{ '--i': 0 }}>
          <span className="dash-stat-art" aria-hidden="true">
            <Lantern size={46} tone="amber" swing />
          </span>
          <span className="dash-stat-label">{t('account.statCart')}</span>
          <strong className="dash-stat-value">{count ?? '–'}</strong>
          <span className="dash-stat-sub">
            {count ? <Price amount={cart.subtotal} className="dash-stat-price" /> : t('account.cartEmpty')}
          </span>
          <Link to={path('/cart')} className="dash-stat-link">
            {t('cart.view')} <span aria-hidden="true">→</span>
          </Link>
        </li>
        <li className="dash-stat" data-tone="son" style={{ '--i': 1 }}>
          <span className="dash-stat-art" aria-hidden="true">
            <GiftArt size={52} />
          </span>
          <span className="dash-stat-label">{t('account.orders')}</span>
          <strong className="dash-stat-value">{orders?.length ?? '–'}</strong>
          <span className="dash-stat-sub">
            {orders?.length ? t(`orders.statuses.${orders[0].status}`) : t('orders.empty')}
          </span>
          <button type="button" className="dash-stat-link" onClick={() => go('orders')} aria-label={`${t('account.viewMore')}: ${t('account.orders')}`}>
            {t('account.viewMore')} <span aria-hidden="true">→</span>
          </button>
        </li>
        <li className="dash-stat" data-tone="cham" style={{ '--i': 2 }}>
          <span className="dash-stat-art" aria-hidden="true">
            <MayAvatar size={52} />
          </span>
          <span className="dash-stat-label">{t('account.statMay')}</span>
          <strong className="dash-stat-value">{asked ?? '–'}</strong>
          <span className="dash-stat-sub">{t('account.statMaySub')}</span>
          <button type="button" className="dash-stat-link" onClick={() => go('may')} aria-label={`${t('account.viewMore')}: ${t('account.tabs.may')}`}>
            {t('account.viewMore')} <span aria-hidden="true">→</span>
          </button>
        </li>
      </ul>

      <div className="dash-duo">
        <Card
          title={t('account.recentChat')}
          id="dash-recent-title"
          action={
            recent.length > 0 && (
              <button type="button" className="dash-head-link" onClick={() => go('may')}>
                {t('account.viewAll')}
              </button>
            )
          }
        >
          {mayItems === null && <p className="dash-muted">{t('account.loading')}</p>}
          {mayItems?.length === 0 && <MayEmpty />}
          {recent.length > 0 && (
            <ol className="may-list may-history dash-recent">
              {recent.map((m, i) => (
                <li key={i} className={`may-msg may-${m.role} may-kind-${m.kind}`}>
                  {m.role === 'user' && <span className="sr-only">{t('accountMay.you')}: </span>}
                  {m.content}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card
          title={t('account.profile')}
          id="dash-summary-title"
          
          action={
            <button type="button" className="dash-head-link" onClick={() => go('profile')}>
              {t('account.edit')}
            </button>
          }
        >
          {!profile && <p className="dash-muted">{t('account.loading')}</p>}
          {profile && (
            <dl className="dash-facts">
              <div>
                <dt>{t('auth.fullName')}</dt>
                <dd>{profile.fullName || '—'}</dd>
              </div>
              <div>
                <dt>{t('auth.email')}</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>{t('account.phone')}</dt>
                <dd>{profile.phone || t('account.notSet')}</dd>
              </div>
              <div>
                <dt>{t('auth.preferredLocale')}</dt>
                <dd>{t(`locales.${profile.preferredLocale}`)}</dd>
              </div>
            </dl>
          )}
        </Card>
      </div>
    </>
  )
}

// FR-ACC-001/002/004: trang tài khoản — ứng dụng nhỏ với tab dọc, không dùng header của trang giới thiệu
export default function AccountPage() {
  const { t, path } = useI18n()
  const { user, authedApi, logout } = useAuth()
  const { cart } = useCart()
  const myOrders = useMyOrders()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState({ status: 'loading' })
  const [mayItems, setMayItems] = useState(null)
  const [theme, setTheme] = useState(readTheme)
  const tabRefs = useRef({})
  const panelRef = useRef(null)

  const raw = params.get('tab')
  const tab = TABS.includes(raw) ? raw : 'overview'

  useEffect(() => {
    if (!user) return
    let alive = true
    authedApi('/me')
      .then((res) => alive && setState({ status: 'ok', profile: res.profile }))
      .catch((error) => alive && setState({ status: 'error', error }))
    authedApi('/may/history')
      .then((res) => alive && setMayItems(Array.isArray(res?.items) ? res.items : []))
      .catch(() => alive && setMayItems([]))
    return () => {
      alive = false
    }
  }, [user, authedApi])

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${path('/login')}?next=${next}`} replace />
  }

  function go(next, { focusTab = false } = {}) {
    setParams(next === 'overview' ? {} : { tab: next })
    if (focusTab) tabRefs.current[next]?.focus()
    else panelRef.current?.focus({ preventScroll: true })
    if (typeof window !== 'undefined' && window.scrollY > 0) window.scrollTo({ top: 0 })
  }

  // WAI-ARIA tabs: mũi tên lên/xuống (và trái/phải khi tab nằm ngang trên màn hẹp), Home, End
  function onTabKey(e) {
    const i = TABS.indexOf(tab)
    const map = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }
    if (!(e.key in map)) return
    e.preventDefault()
    go(TABS[(map[e.key] + TABS.length) % TABS.length], { focusTab: true })
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    saveTheme(next)
  }

  async function onLogout() {
    await logout()
    navigate(path('/'), { replace: true })
  }

  const profile = state.status === 'ok' ? state.profile : null
  const name = profile?.fullName?.trim()
  const email = profile?.email ?? user.email
  const asked = mayItems?.filter((m) => m.role === 'user').length
  const cartCount = cart?.itemCount ?? 0
  // FR-ACC-002: số đơn thật trên huy hiệu tab và ô số liệu (thay chỗ chờ G-40)
  const orders = myOrders.status === 'ok' ? myOrders.items : null
  const badges = { orders: orders?.length || null, may: asked || null }

  return (
    <div className="dash" data-theme={theme}>
      <Seo title={t('account.title')} noindex />
      <DashSky />

      <aside className="dash-side">
        <div className="dash-brand">
          <Link to={path('/')} className="nav-mark" aria-label="LAMVI">
            <Seal>LAMVI</Seal>
          </Link>
          <div className="dash-brand-tools">
            <LanguageSwitcher />
            <button
              type="button"
              className="dash-theme"
              onClick={toggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={t('account.themeDark')}
              title={theme === 'dark' ? t('account.themeLight') : t('account.themeDark')}
            >
              <ThemeIcon dark={theme === 'dark'} />
            </button>
          </div>
        </div>

        <div className="dash-user">
          <span className="dash-avatar" aria-hidden="true">
            <span>{initialOf(profile?.fullName, email)}</span>
          </span>
          <div className="dash-user-text">
            <strong>{name || t('account.greetingAnon')}</strong>
            {email && <span>{email}</span>}
          </div>
        </div>

        <div className="dash-tabs" role="tablist" aria-orientation="vertical" aria-label={t('account.navLabel')} onKeyDown={onTabKey}>
          {TABS.map((k) => (
            <button
              key={k}
              ref={(el) => (tabRefs.current[k] = el)}
              type="button"
              role="tab"
              id={`dash-tab-${k}`}
              aria-selected={tab === k}
              aria-controls="dash-panel"
              tabIndex={tab === k ? 0 : -1}
              className="dash-tab"
              onClick={() => go(k)}
            >
              <TabIcon name={k} />
              <span className="dash-tab-label">{t(`account.tabs.${k}`)}</span>
              {badges[k] != null && <span className={`dash-tab-badge${typeof badges[k] === 'string' ? ' is-text' : ''}`}>{badges[k]}</span>}
            </button>
          ))}
        </div>

        <Link to={{ pathname: path('/'), hash: '#products' }} className="dash-promo">
          <span className="dash-promo-art" aria-hidden="true">
            <Lantern size={60} tone="dusk" swing flicker />
          </span>
          <span className="dash-promo-text">{t('cart.continue')}</span>
        </Link>

        <div className="dash-side-foot">
          <Link to={path('/')} className="dash-side-link">
            <span aria-hidden="true">←</span> {t('account.backToShop')}
          </Link>
          <Link to={path('/cart')} className="dash-side-link">
            {cartCount > 0 ? t('cart.navCount', { n: cartCount }) : t('cart.nav')}
          </Link>
          <button className="dash-logout" type="button" onClick={onLogout}>
            {t('account.logout')}
          </button>
        </div>
      </aside>

      <section className="dash-main" id="dash-panel" role="tabpanel" aria-labelledby={`dash-tab-${tab}`} tabIndex={-1} ref={panelRef}>
        <header className="dash-top">
          <div>
            <p className="eyebrow">
              <Lotus />
              {name ? t('account.greeting', { name }) : t('account.greetingAnon')}
            </p>
            <h1 className="page-title">{t('account.title')}</h1>
            <p className="dash-top-sub">{t(`account.subtitle.${tab}`)}</p>
            {tab === 'overview' && (
              <div className="dash-actions">
                <Link to={{ pathname: path('/'), hash: '#products' }} className="btn btn-primary btn-small">
                  {t('cart.continue')}
                </Link>
                <button type="button" className="btn btn-ghost btn-small" onClick={() => go('may')}>
                  {t('account.tabs.may')}
                </button>
              </div>
            )}
          </div>
          <HeroScene />
        </header>

        {state.status === 'error' && (
          <p className="notice error" role="alert">
            {t(`errors.${state.error.code}`)}
          </p>
        )}

        <div className="dash-panel" key={tab}>
          {tab === 'overview' && <Overview cart={cart} mayItems={mayItems} profile={profile} orders={orders} go={go} />}
          {tab === 'orders' && <OrdersPanel status={myOrders.status} items={myOrders.items} error={myOrders.error} />}
          {tab === 'may' && <MayPanel items={mayItems} />}
          {tab === 'profile' && <ProfilePanel state={state} setState={setState} />}
        </div>
      </section>
    </div>
  )
}
