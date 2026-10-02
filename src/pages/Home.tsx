import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { GAME_CATALOG, gameRoutePath, type GameCatalogEntry } from '../games/gameCatalog'
import {
  toggleFavoriteGame,
  useFavoriteGameIds,
  useRecentGameIds,
} from './gameShelfStore'
import styles from './Home.module.css'
import { splitTileTitle, type TileTitleSplit } from './tileTitle'

const SITE_TITLE = 'こどもミニゲーム'

// アイコンの色（グラデーションの明るい側・濃い側、カード下の段の色）。
// カタログ順に虹の順で割り当てる。一覧は3〜8列になるため、どの列数でも割り切れない9色にして
// 上下に並ぶカードが同じ色にならないようにしている。
// おきにいり・さいきんの棚でも同じ色を使い、一覧のカードと見比べやすくする。
const TONES = [
  ['#ffa8a8', '#fa5252', '#ffd8d8'],
  ['#ffc078', '#fd7e14', '#ffe3c4'],
  ['#ffe066', '#fab005', '#fff0b3'],
  ['#8ce99a', '#40c057', '#d3f9d8'],
  ['#63e6be', '#12b886', '#c3fae8'],
  ['#74c0fc', '#228be6', '#d0ebff'],
  ['#91a7ff', '#4c6ef5', '#dbe4ff'],
  ['#b197fc', '#7950f2', '#e5dbff'],
  ['#faa2c1', '#e64980', '#ffdeeb'],
] as const

const GAME_ENTRIES = GAME_CATALOG.map((game, index) => {
  const [toneA, toneB, toneLedge] = TONES[index % TONES.length]
  const toneStyle = {
    '--tone-a': toneA,
    '--tone-b': toneB,
    '--tone-ledge': toneLedge,
  } as CSSProperties
  return { game, toneStyle, titleSplit: splitTileTitle(game.title) }
})
const GAME_ENTRY_BY_ID = new Map(GAME_ENTRIES.map((entry) => [entry.game.id, entry]))

type GameEntry = (typeof GAME_ENTRIES)[number]

function resolveEntries(gameIds: readonly string[]): GameEntry[] {
  return gameIds.flatMap((id) => GAME_ENTRY_BY_ID.get(id) ?? [])
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.6l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.16l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z" />
    </svg>
  )
}

function GameIcon({ game }: { game: GameCatalogEntry }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      <span className={styles.emoji}>{game.emoji}</span>
    </span>
  )
}

// 1行の名前も2行の名前も同じ高さの枠に収め、2行になるときはことばの切れ目で折り返す。
function TileTitle({ title, split }: { title: string; split: TileTitleSplit | null }) {
  return (
    <span className={styles.tileTitle}>
      <span className={styles.tileTitleText}>
        {split === null ? (
          title
        ) : (
          <>
            <span className={styles.titleSegment}>{split.head}</span>
            {split.spaced ? ' ' : <wbr />}
            <span className={styles.titleSegment}>{split.tail}</span>
          </>
        )}
      </span>
    </span>
  )
}

type GameShelfProps = {
  id: string
  icon: string
  title: string
  emptyText: string
  variant: 'favorite' | 'recent'
  gameIds: readonly string[]
}

function GameShelf({ id, icon, title, emptyText, variant, gameIds }: GameShelfProps) {
  const entries = resolveEntries(gameIds)
  const headingId = `${id}-heading`
  return (
    <section className={styles.shelf} data-variant={variant} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.shelfLabel}>
        <span className={styles.sectionIcon} aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      {/* 空でも同じ高さを保ち、ホームへ戻ったときの一覧位置（ScrollManager）をずらさない。 */}
      {entries.length === 0 ? (
        <p className={styles.shelfEmpty}>{emptyText}</p>
      ) : (
        <ul className={styles.shelfTrack}>
          {entries.map(({ game, toneStyle, titleSplit }) => (
            <li key={game.id} className={styles.shelfItem} style={toneStyle}>
              <Link to={gameRoutePath(game.slug)} className={styles.shelfLink}>
                <GameIcon game={game} />
                <TileTitle title={game.title} split={titleSplit} />
                {/* 一覧のカードと同じリンク名にならないよう、読み上げ用に棚の名前を添える。 */}
                <span className={styles.visuallyHidden}>（{title}）</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Home() {
  const favoriteIds = useFavoriteGameIds()
  const recentIds = useRecentGameIds()

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <header className={styles.hero}>
          <span className={styles.cloudA} aria-hidden="true" />
          <span className={styles.cloudB} aria-hidden="true" />
          <h1 className={styles.title} aria-label={SITE_TITLE}>
            {[...SITE_TITLE].map((char, index) => (
              <span
                key={index}
                className={styles.titleChar}
                style={{ '--char-index': index } as CSSProperties}
              >
                {char}
              </span>
            ))}
          </h1>
          <p className={styles.lead}>あそびたい ゲームを えらんでね</p>
        </header>

        <div className={styles.shelves}>
          <GameShelf
            id="favorite-games"
            icon="⭐"
            title="おきにいり"
            emptyText="☆を おすと ここに ならぶよ"
            variant="favorite"
            gameIds={favoriteIds}
          />
          <GameShelf
            id="recent-games"
            icon="🕒"
            title="さいきん あそんだ"
            emptyText="あそんだ ゲームが ここに でるよ"
            variant="recent"
            gameIds={recentIds}
          />
        </div>

        <section className={styles.allGames} aria-labelledby="all-games-heading">
          <h2 id="all-games-heading" className={styles.sectionTitle}>
            <span className={styles.sectionIcon} aria-hidden="true">
              🎮
            </span>
            ぜんぶの ゲーム
            <span className={styles.count}>{GAME_CATALOG.length}こ</span>
          </h2>
          <ul className={styles.grid}>
            {GAME_ENTRIES.map(({ game, toneStyle, titleSplit }) => {
              const isFavorite = favoriteIds.includes(game.id)
              return (
                <li key={game.id} className={styles.tile} style={toneStyle}>
                  <Link to={gameRoutePath(game.slug)} className={styles.tileLink}>
                    <GameIcon game={game} />
                    <TileTitle title={game.title} split={titleSplit} />
                  </Link>
                  {/* リンクの中にボタンを入れられないため、カードの右上に重ねて置く。 */}
                  <button
                    type="button"
                    className={styles.favoriteButton}
                    aria-pressed={isFavorite}
                    aria-label={`${game.title}を おきにいりに する`}
                    onClick={() => toggleFavoriteGame(game.id)}
                  >
                    <StarIcon />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <p className={styles.description}>
          息子に遊ばせるために作ったミニゲーム集です。国旗や都道府県のクイズ、3Dの線路づくり・クルマづくり、すなばやスライムをさわる物理あそび、地球儀や太陽系の宇宙あそび、ピアノやおえかきまで、幼児・子ども向けのミニゲームを無料で遊べます。スマホやタブレットのブラウザですぐ遊べて、PWAに対応しているのでホーム画面に追加すればオフラインでも遊べます。
        </p>
      </main>
    </div>
  )
}
