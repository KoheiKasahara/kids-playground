import { useSyncExternalStore } from 'react'
import {
  DEFAULT_PINBALL_THEME_ID,
  resolvePinballTheme,
} from './themes'
import type { PinballThemeDefinition, PinballThemeId } from './themes/types'

export const PINBALL_THEME_STORAGE_KEY = 'kids-playground:pinball-theme'

let cachedThemeId: PinballThemeId | undefined
const listeners = new Set<() => void>()

function readFromStorage(): PinballThemeId {
  try {
    const raw = window.localStorage.getItem(PINBALL_THEME_STORAGE_KEY)
    // 未設定・壊れた値・未知のidは、選択UIや盤面を止めないよう既定テーマへ戻す。
    return resolvePinballTheme(raw).id
  } catch {
    // localStorage が使えない環境でも、メモリ上の既定テーマだけでゲームを続けられるようにする。
    return DEFAULT_PINBALL_THEME_ID
  }
}

export function getPinballThemeId(): PinballThemeId {
  if (cachedThemeId === undefined) {
    cachedThemeId = readFromStorage()
  }
  return cachedThemeId
}

export function setPinballThemeId(id: PinballThemeId): void {
  const next = resolvePinballTheme(id).id
  const previous = getPinballThemeId()
  cachedThemeId = next

  try {
    window.localStorage.setItem(PINBALL_THEME_STORAGE_KEY, next)
  } catch {
    // 保存に失敗しても、現在の画面だけはメモリ上のキャッシュで切り替えられるようにする。
  }

  if (previous !== next) {
    listeners.forEach((listener) => listener())
  }
}

export function subscribePinballThemeId(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePinballThemeId(): PinballThemeId {
  return useSyncExternalStore(
    subscribePinballThemeId,
    getPinballThemeId,
    () => DEFAULT_PINBALL_THEME_ID,
  )
}

export function usePinballTheme(): PinballThemeDefinition {
  return resolvePinballTheme(usePinballThemeId())
}

/** テストで localStorage を差し替えたあと、次の読み取りでキャッシュを更新するための関数。 */
export function resetPinballThemeCache(): void {
  cachedThemeId = undefined
}
