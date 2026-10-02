import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import { CartContext, MAX_QTY, loadLocalCart, saveLocalCart } from './context.js'

// FR-CART-001, D-59: vãng lai → giỏ trình duyệt (server tính giá qua /cart/quote);
// đã đăng nhập → giỏ server; lúc đăng nhập thì gộp giỏ trình duyệt vào giỏ server.
export default function CartProvider({ children }) {
  const { user, authedApi } = useAuth()
  const { lang } = useI18n()
  // SSR + lần render đầu: chưa đọc localStorage (tránh lệch hydrate)
  const [cart, setCart] = useState(null)
  const [error, setError] = useState(null)
  // Sự kiện "vừa thêm" cho bong bóng của Mây (D-83); `id` tăng mỗi lần để thêm cùng món vẫn hiện lại
  const [lastAdded, setLastAdded] = useState(null)
  const localRef = useRef([])
  // Mỗi lần nạp/đổi giỏ tăng mã; kết quả của yêu cầu cũ (vd quote chậm về sau khi đã đăng nhập) bị bỏ
  const seq = useRef(0)
  const apply = useCallback((id, data) => {
    if (id === seq.current) setCart(data)
  }, [])

  const quoteLocal = useCallback(
    async (id = ++seq.current) => {
      const items = localRef.current
      if (!items.length) {
        return apply(id, { items: [], subtotal: 0, itemCount: 0, hasUnavailable: false, maxQuantity: MAX_QTY })
      }
      apply(id, await api('/cart/quote', { method: 'POST', body: { items }, lang }))
    },
    [lang, apply],
  )

  const run = useCallback(async (fn) => {
    setError(null)
    try {
      await fn()
      return true
    } catch (err) {
      setError(err.code ?? 'INTERNAL_ERROR')
      return false
    }
  }, [])

  // Nạp lại giỏ từ server. Dùng ở lần đầu và sau khi đặt hàng xong (server đã dọn giỏ).
  const load = useCallback(async () => {
    const id = ++seq.current
    const doLoad = async () => {
      if (!user) {
        localRef.current = loadLocalCart()
        await quoteLocal(id)
        return
      }
      localRef.current = []
      const local = loadLocalCart()
      if (local.length) {
        try {
          // D-59: gộp giỏ trình duyệt vào tài khoản rồi xoá bản trình duyệt
          const merged = await authedApi(`/cart/merge?lang=${lang}`, { method: 'POST', body: { items: local } })
          saveLocalCart([])
          return apply(id, merged)
        } catch (err) {
          // Gộp lỗi (vd bảo trì 503): vẫn hiện giỏ tài khoản, giữ giỏ trình duyệt để gộp lần sau
          if (err.status === 401) throw err
        }
      }
      apply(id, await authedApi(`/cart?lang=${lang}`))
    }
    // Lần nạp mới tăng mã → kết quả của lần nạp cũ tự bị bỏ (apply kiểm tra mã)
    await doLoad().catch((err) => id === seq.current && setError(err.code ?? 'INTERNAL_ERROR'))
  }, [user, authedApi, lang, quoteLocal, apply])

  useEffect(() => {
    load()
  }, [load])

  const setQuantity = useCallback(
    (slug, quantity) =>
      run(async () => {
        const q = Math.max(1, Math.min(MAX_QTY, quantity))
        if (!user) {
          const items = localRef.current.filter((i) => i.slug !== slug)
          const idx = localRef.current.findIndex((i) => i.slug === slug)
          items.splice(idx < 0 ? items.length : idx, 0, { slug, quantity: q })
          localRef.current = items
          saveLocalCart(items)
          await quoteLocal()
          return
        }
        const id = ++seq.current
        apply(id, await authedApi(`/cart/items/${encodeURIComponent(slug)}?lang=${lang}`, { method: 'PUT', body: { quantity: q } }))
      }),
    [user, authedApi, lang, quoteLocal, run, apply],
  )

  const add = useCallback(
    async (slug, quantity = 1) => {
      const current = cart?.items.find((i) => i.slug === slug)?.quantity ?? localRef.current.find((i) => i.slug === slug)?.quantity ?? 0
      const ok = await setQuantity(slug, current + quantity)
      if (ok) setLastAdded((prev) => ({ slug, quantity, id: (prev?.id ?? 0) + 1 }))
      return ok
    },
    [cart, setQuantity],
  )

  const dismissAdded = useCallback(() => setLastAdded(null), [])

  const remove = useCallback(
    (slug) =>
      run(async () => {
        if (!user) {
          localRef.current = localRef.current.filter((i) => i.slug !== slug)
          saveLocalCart(localRef.current)
          await quoteLocal()
          return
        }
        const id = ++seq.current
        apply(id, await authedApi(`/cart/items/${encodeURIComponent(slug)}?lang=${lang}`, { method: 'DELETE' }))
      }),
    [user, authedApi, lang, quoteLocal, run, apply],
  )

  const value = useMemo(
    () => ({ cart, error, add, setQuantity, remove, reload: load, lastAdded, dismissAdded }),
    [cart, error, add, setQuantity, remove, load, lastAdded, dismissAdded],
  )
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
