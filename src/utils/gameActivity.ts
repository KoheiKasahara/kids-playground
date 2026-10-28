/**
 * 画面を離れたら停止し、戻ったら再開するための通知口。
 * 時計・入力・音などの資源は呼出元が所有する。初回にも現在の状態を通知する。
 */
export function observeGameActivity(onChange: (active: boolean) => void): () => void {
  let blurred = false
  let pageHidden = false
  let active: boolean | undefined
  const update = () => {
    const next = !document.hidden && !blurred && !pageHidden
    if (next !== active) {
      active = next
      onChange(next)
    }
  }
  const visibility = () => {
    // タブ復帰時はfocusがvisibilitychangeより先に来る環境でも再開できる。
    if (!document.hidden) blurred = false
    update()
  }
  const blur = () => { blurred = true; update() }
  const focus = () => { blurred = false; update() }
  const hide = () => { pageHidden = true; update() }
  const show = () => { pageHidden = false; blurred = false; update() }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('blur', blur)
  window.addEventListener('focus', focus)
  window.addEventListener('pagehide', hide)
  window.addEventListener('pageshow', show)
  update()
  return () => {
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('blur', blur)
    window.removeEventListener('focus', focus)
    window.removeEventListener('pagehide', hide)
    window.removeEventListener('pageshow', show)
  }
}
