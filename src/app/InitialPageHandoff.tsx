import { useLayoutEffect, type ReactNode } from 'react'

/** Runs only when Suspense has committed the route (or its error screen). */
export default function InitialPageHandoff({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const initial = document.getElementById('initial-page')
    const root = document.getElementById('root')
    if (!initial || !root) return
    const hadFocus = initial.contains(document.activeElement)
    root.removeAttribute('inert')
    root.removeAttribute('aria-hidden')
    root.style.removeProperty('visibility')
    root.style.removeProperty('position')
    root.style.removeProperty('inset')
    initial.remove()
    if (hadFocus) {
      root.tabIndex = -1
      root.focus({ preventScroll: true })
      root.removeAttribute('tabindex')
    }
  }, [])
  return children
}
