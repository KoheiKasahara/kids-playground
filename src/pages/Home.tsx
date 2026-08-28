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
        こどもミニゲームは、幼児・子ども向けの無料ミニゲーム集です。国旗、都道府県、野菜、果物、はたらくくるま、色、算数などのテーマを、スマホやタブレットで楽しく遊びながら学べます。PWAに対応しているので、ホーム画面に追加すればオフラインでも遊べます。
      </p>
    </main>
  )
}
