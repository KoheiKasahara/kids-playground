import { Link } from 'react-router-dom'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'
import styles from './Home.module.css'

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
      <p className={styles.description}>
        息子に遊ばせるために作ったミニゲーム集です。国旗や都道府県のクイズ、3Dの線路づくり・クルマづくり、すなばやスライムをさわる物理あそび、地球儀や太陽系の宇宙あそび、ピアノやおえかきまで、幼児・子ども向けのミニゲームを無料で遊べます。スマホやタブレットのブラウザですぐ遊べて、PWAに対応しているのでホーム画面に追加すればオフラインでも遊べます。
      </p>
    </main>
  )
}
