const GAME_ROOT_PATTERN = /^\/games\/[^/]+\/?$/

/** URL から、その画面のひとつ上のゲーム階層を求める。 */
export function gameBackPath(pathname: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (!path.startsWith('/games/')) return null
  if (GAME_ROOT_PATTERN.test(path)) return '/'

  const parts = path.split('/').filter(Boolean)
  const gameRoot = `/${parts.slice(0, 2).join('/')}`

  if (parts[1] === 'flag-quiz' || parts[1] === 'working-vehicle-quiz' || parts[1] === 'math-quiz') {
    return parts.length >= 4 ? `/${parts.slice(0, 3).join('/')}` : gameRoot
  }

  if (parts[1] === 'world-travel-quiz') {
    return parts.length >= 5 ? `/${parts.slice(0, 3).join('/')}/answer-mode` : gameRoot
  }

  if (parts[1] === 'prefecture-quiz' && parts[2] === 'puzzle') {
    return parts.length >= 5 ? `${gameRoot}/puzzle` : gameRoot
  }

  return gameRoot
}
