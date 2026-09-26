import { Link } from 'react-router-dom'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'
import { canVibrate, setHapticsEnabled, useHapticsEnabled, vibrate } from '../utils/haptics'
import styles from './Home.module.css'

/** 振動（ぶるぶる）の ON/OFF。振動に対応した端末でだけ表示する（Issue #784 A7）。 */
function HapticsSetting() {
  const enabled = useHapticsEnabled()
  if (!canVibrate()) return null
  return (
    <button
      type="button"
      className={styles.setting}
      aria-pressed={enabled}
      onClick={() => {
        setHapticsEnabled(!enabled)
        if (!enabled) vibrate('tap')
      }}
    >
      <span aria-hidden="true">📳</span> ぶるぶる: {enabled ? 'オン' : 'オフ'}
    </button>
  )
}

export default function Home() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>こどもミニゲーム</h1>
      <div className={styles.list}>
        {GAME_CATALOG.map((game) => (
          <Link key={game.id} to={gameRoutePath(game.slug)} className={styles.card}>
            <span className={styles.emoji} aria-hidden="true">
              {game.emoji}
            </span>
            <span className={styles.cardTitle}>{game.title}</span>
          </Link>
        ))}
      </div>
      <HapticsSetting />
      <p className={styles.description}>
        息子に遊ばせるために作ったミニゲーム集です。国旗や都道府県のクイズ、3Dの線路づくり・クルマづくり、すなばやスライムをさわる物理あそび、地球儀や太陽系の宇宙あそび、ピアノやおえかきまで、幼児・子ども向けのミニゲームを無料で遊べます。スマホやタブレットのブラウザですぐ遊べて、PWAに対応しているのでホーム画面に追加すればオフラインでも遊べます。
      </p>
    </main>
  )
}
