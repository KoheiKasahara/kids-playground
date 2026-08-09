import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'

type GameCard = {
  id: string
  title: string
  emoji: string
  path: string
}

const games: GameCard[] = [
  { id: 'flag-quiz', title: 'こっきクイズ', emoji: '🌏', path: '/games/flag-quiz' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>こどもミニゲーム</h1>
      <div className={styles.list}>
        {games.map((game) => (
          <button
            key={game.id}
            type="button"
            className={styles.card}
            onClick={() => navigate(game.path)}
          >
            <span className={styles.emoji} aria-hidden="true">
              {game.emoji}
            </span>
            <span className={styles.cardTitle}>{game.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
