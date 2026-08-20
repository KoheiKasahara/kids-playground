import { useEffect, useState } from 'react'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }

  return window.matchMedia(REDUCED_MOTION_QUERY)
}

function getReducedMotion(): boolean {
  return getMediaQueryList()?.matches ?? false
}

/** prefers-reduced-motion の変更を購読し、Three.js側にも同じ状態を渡す。 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(getReducedMotion)

  useEffect(() => {
    const mediaQueryList = getMediaQueryList()
    if (mediaQueryList === null) return undefined

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches)
    }

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange)
      return () => mediaQueryList.removeEventListener('change', handleChange)
    }

    mediaQueryList.addListener(handleChange)
    return () => mediaQueryList.removeListener(handleChange)
  }, [])

  return reducedMotion
}
