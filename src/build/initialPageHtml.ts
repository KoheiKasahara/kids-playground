import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'
import { HOME_INTRO_DESCRIPTION, SITE_NAME } from '../seo/siteMeta'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!)
}

/** Visible until the route commits; content comes from the same catalog as GameIntro. */
export function applyInitialPageHtml(html: string, pathname: string): string {
  const game = GAME_CATALOG.find((entry) => gameRoutePath(entry.slug) === pathname)
  const content = game
    ? `<h1>${escapeHtml(game.title)}</h1><h2>このゲームについて</h2><p>${escapeHtml(game.seo.description)}</p><h3>あそびかた</h3><ul>${game.intro.howToPlay.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul><p><a href="/">ほかのゲームを みる</a></p>`
    : `<h1>${escapeHtml(SITE_NAME)}</h1><p>${escapeHtml(HOME_INTRO_DESCRIPTION)}</p><h2>ぜんぶの ゲーム</h2><ul>${GAME_CATALOG.map((entry) => `<li><a href="${gameRoutePath(entry.slug)}">${escapeHtml(entry.title)}</a></li>`).join('')}</ul>`

  // Keep the initial document outside React's root so lazy imports cannot clear it.
  // The live route replaces it in a layout effect, before the browser paints.
  // Preserve layout measurements for game initialization while suppressing focus
  // and accessibility exposure of the not-yet-ready application.
  return html.replace('<div id="root"></div>', () =>
    `<main id="initial-page" style="max-width:60rem;margin:auto;padding:1.5rem;line-height:1.8">${content}</main><div id="root" inert aria-hidden="true" style="visibility:hidden;position:absolute;inset:0"></div>`)
}
