import { candyTheme } from './candyTheme'
import { normalTheme } from './normalTheme'
import { oceanTheme } from './oceanTheme'
import { spaceTheme } from './spaceTheme'
import type { PinballThemeDefinition, PinballThemeId } from './types'

export const PINBALL_THEMES: readonly PinballThemeDefinition[] = [
  normalTheme,
  spaceTheme,
  oceanTheme,
  candyTheme,
]

export const DEFAULT_PINBALL_THEME_ID: PinballThemeId = 'normal'

export function findPinballTheme(id: string): PinballThemeDefinition | undefined {
  return PINBALL_THEMES.find((theme) => theme.id === id)
}

export function resolvePinballTheme(id: string | null | undefined): PinballThemeDefinition {
  return findPinballTheme(id ?? '') ?? normalTheme
}
