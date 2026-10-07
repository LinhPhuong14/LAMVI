import { useSyncExternalStore } from 'react'
import { useReducedMotionConfig } from 'framer-motion'

const subscribe = () => () => {}
const client = () => true
const server = () => false

// React uses the server snapshot for the first hydration render, then the client snapshot.
// Never branch SSR DOM on a browser-only media query or persisted account before this point.
export function useHydrated() { return useSyncExternalStore(subscribe, client, server) }
export function useHydratedReducedMotion() {
  const reduced = useReducedMotionConfig()
  const hydrated = useHydrated()
  return hydrated && reduced
}
