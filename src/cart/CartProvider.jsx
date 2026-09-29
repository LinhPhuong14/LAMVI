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
  const localRef = useRef([])

  const quoteLocal = useCallback(async () => {
    const items = localRef.current
    if (!items.length) return setCart({ items: [], subtotalExclVat: 0, itemCount: 0, hasUnavailable: false, maxQuantity: MAX_QTY })
    setCart(await api('/cart/quote', { method: 'POST', body: { items }, lang }))
  }, [lang])

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

  useEffect(() => {
    let alive = true
    const load = async () => {
      if (!user) {
        localRef.current = loadLocalCart()
        await quoteLocal()
        return
      }
      const local = loadLocalCart()
      if (local.length) {
        // D-59: gộp giỏ trình duyệt vào tài khoản rồi xoá bản trình duyệt
        const merged = await authedApi(`/cart/merge?lang=${lang}`, { method: 'POST', body: { items: local } })
        saveLocalCart([])
        localRef.current = []
        if (alive) setCart(merged)
        return
      }
      const data = await authedApi(`/cart?lang=${lang}`)
      if (alive) setCart(data)
    }
    load().catch((err) => alive && setError(err.code ?? 'INTERNAL_ERROR'))
    return () => {
      alive = false
    }
  }, [user, authedApi, lang, quoteLocal])

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
        setCart(await authedApi(`/cart/items/${encodeURIComponent(slug)}?lang=${lang}`, { method: 'PUT', body: { quantity: q } }))
      }),
    [user, authedApi, lang, quoteLocal, run],
  )

  const add = useCallback(
    (slug, quantity = 1) => {
      const current = cart?.items.find((i) => i.slug === slug)?.quantity ?? localRef.current.find((i) => i.slug === slug)?.quantity ?? 0
      return setQuantity(slug, current + quantity)
    },
    [cart, setQuantity],
  )

  const remove = useCallback(
    (slug) =>
      run(async () => {
        if (!user) {
          localRef.current = localRef.current.filter((i) => i.slug !== slug)
          saveLocalCart(localRef.current)
          await quoteLocal()
          return
        }
        setCart(await authedApi(`/cart/items/${encodeURIComponent(slug)}?lang=${lang}`, { method: 'DELETE' }))
      }),
    [user, authedApi, lang, quoteLocal, run],
  )

  const value = useMemo(() => ({ cart, error, add, setQuantity, remove }), [cart, error, add, setQuantity, remove])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
