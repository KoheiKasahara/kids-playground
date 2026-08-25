import { Link } from 'react-router-dom'
import styles from './Home.module.css'

type GameCard = {
  id: string
  title: string
  emoji: string
  path: string
}

const games: GameCard[] = [
  { id: 'flag-quiz', title: 'こっきクイズ', emoji: '🌏', path: '/games/flag-quiz' },
  { id: 'flag-pinball', title: 'こっきピンボール', emoji: '🎯', path: '/games/flag-pinball' },
  { id: 'flag-roll-adventure', title: 'こっきコロコロぼうけん', emoji: '🎢', path: '/games/flag-roll-adventure' },
  { id: 'domino-flag', title: 'こっきドミノ', emoji: '🁣', path: '/games/domino-flag' },
  { id: 'flag-roll-maze', title: 'こっきころころめいろ', emoji: '🌀', path: '/games/flag-roll-maze' },
  { id: 'flag-roll-puzzle', title: 'こっきコロコロパズル', emoji: '🧩', path: '/games/flag-roll-puzzle' },
  { id: 'vegetable-quiz', title: 'おやさいクイズ', emoji: '🥕', path: '/games/vegetable-quiz' },
  { id: 'fruit-quiz', title: 'くだものクイズ', emoji: '🍎', path: '/games/fruit-quiz' },
  {
    id: 'working-vehicle-quiz',
    title: 'はたらくくるまクイズ',
    emoji: '🚒',
    path: '/games/working-vehicle-quiz',
  },
  { id: 'math-quiz', title: 'さんすうクイズ', emoji: '🔢', path: '/games/math-quiz' },
  { id: 'color-mix-quiz', title: 'いろまぜクイズ', emoji: '🎨', path: '/games/color-mix-quiz' },
  { id: 'prefecture-quiz', title: '都道府県クイズ', emoji: '🗾', path: '/games/prefecture-quiz' },
  { id: 'world-travel-quiz', title: 'せかい旅行クイズ', emoji: '✈️', path: '/games/world-travel-quiz' },
  { id: 'japan-travel-quiz', title: 'にほん旅行クイズ', emoji: '🗾', path: '/games/japan-travel-quiz' },
  { id: 'earth-globe', title: 'ちきゅうぎ', emoji: '🌍', path: '/games/earth-globe' },
  { id: 'rail-builder', title: '3Dせんろづくり', emoji: '🚂', path: '/games/rail-builder' },
]

export default function Home() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>こどもミニゲーム</h1>
      <div className={styles.list}>
        {games.map((game) => (
          <Link key={game.id} to={game.path} className={styles.card}>
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
