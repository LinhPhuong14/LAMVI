import { onCLS, onINP, onLCP } from 'web-vitals'
import { classifyPath } from '../seo/routes.js'

const names = new Set(['CLS', 'INP', 'LCP'])
const ratings = new Set(['good', 'needs-improvement', 'poor'])

// Technical measurements stay local until an approved durable RUM collector is configured.
// Do not retain DOM entries, CSS selectors, URLs, tokens, IDs or attribution objects.
export function safeVital(metric, pageKind) {
  if (!names.has(metric?.name) || !Number.isFinite(metric.value) || metric.value < 0 || !ratings.has(metric.rating)) return null
  return { name: metric.name, value: metric.value, rating: metric.rating, pageKind }
}

export function startVitals({ target = window, onMetric = () => {}, observers = { onCLS, onINP, onLCP } } = {}) {
  if (target.__LAMVI_WEB_VITALS__) return
  const pageKind = classifyPath(target.location.pathname).kind
  const latest = {}
  target.__LAMVI_WEB_VITALS__ = latest
  const report = (metric) => {
    const value = safeVital(metric, pageKind)
    if (!value) return
    latest[value.name] = value // at most three measurements, not a growing process queue
    try { onMetric(value) } catch { /* diagnostics cannot break shopping */ }
  }
  observers.onCLS(report)
  observers.onINP(report)
  observers.onLCP(report)
}
